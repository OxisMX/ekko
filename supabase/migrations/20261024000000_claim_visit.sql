-- Backend §3 app.grant_stamps, §4.3 claim_visit and §4.4 get_qr_status (S5).

-- RR-2: the original claim_visit result, replayed when the same customer retries the token.
-- WHY no grant: column privileges on visit_qr_tokens are per column (merchant_detail_rpc), so
-- authenticated (and the panel's Realtime payload) never sees it.
alter table public.visit_qr_tokens add column claim_result jsonb;

-- Caller must hold the cycle row (app.roll_cycle locks it). With p_is_bonus = false the first stamp
-- is the visit stamp (carries the token, counts for the daily limit) and the rest are bonus (RN-36).
create function app.grant_stamps(p_cycle public.card_cycles, p_count int, p_qr_token_id uuid, p_is_bonus boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.card_cycles;
  v_added int;
  v_coupon_id uuid;
begin
  select c.* into v_cycle from public.card_cycles c where c.id = p_cycle.id and c.status = 'active' for update;
  if not found then
    perform app.raise('E-99', '{"reason":"grant_stamps on a non-active cycle"}');
  end if;

  -- RN-36: stamps beyond the card total are lost.
  v_added := least(greatest(p_count, 0), v_cycle.stamps_required - v_cycle.stamps_count);

  insert into public.stamps (cycle_id, customer_id, merchant_id, qr_token_id, is_bonus, local_date, granted_at)
  select v_cycle.id, v_cycle.customer_id, v_cycle.merchant_id,
         case when n = 1 and not p_is_bonus then p_qr_token_id end,
         p_is_bonus or n > 1, app.local_today(), app.now()
  from pg_catalog.generate_series(1, v_added) n;

  update public.card_cycles c set stamps_count = c.stamps_count + v_added where c.id = v_cycle.id
  returning * into v_cycle;

  if v_cycle.stamps_count >= v_cycle.stamps_required then
    update public.card_cycles c set status = 'completed', closed_at = app.now() where c.id = v_cycle.id;

    -- RN-26: reward coupon for 30 days with the cycle's copy (RN-29). A code collision within the
    -- merchant (unique (merchant_id, code)) regenerates the code.
    for v_attempt in 1..5 loop
      begin
        insert into public.coupons (customer_id, merchant_id, source, cycle_id, title, description, terms, code, issued_at, expires_at)
        values (v_cycle.customer_id, v_cycle.merchant_id, 'card_reward', v_cycle.id, v_cycle.reward_title,
                v_cycle.reward_description, v_cycle.terms, app.random_code(), app.now(), app.now() + interval '30 days')
        returning id into v_coupon_id;
        exit;
      exception when unique_violation then
        null; -- code collision; retry with a new code
      end;
    end loop;
    if v_coupon_id is null then
      perform app.raise('E-99', '{"reason":"coupon code collisions"}');
    end if;

    -- RN-26: the card restarts at 0 immediately.
    perform app.roll_cycle(v_cycle.customer_id, v_cycle.merchant_id);
  end if;

  return jsonb_build_object(
    'stamps_added', v_added,
    'stamps_count', v_cycle.stamps_count,
    'stamps_required', v_cycle.stamps_required,
    'cycle_completed', v_coupon_id is not null,
    'reward_coupon_id', v_coupon_id
  );
end;
$$;

revoke execute on function app.grant_stamps(public.card_cycles, int, uuid, boolean) from public, anon, authenticated;

create function public.claim_visit(p_token text, p_device_id_digest text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_token public.visit_qr_tokens;
  v_merchant public.merchants;
  v_relation_created boolean;
  v_pending smallint;
  v_cycle public.card_cycles;
  v_result jsonb;
begin
  if p_device_id_digest is null or p_device_id_digest !~ '^[0-9a-f]{64}$' then
    perform app.raise('E-23', '{"field":"device_id_digest"}');
  end if;

  -- WHY FOR UPDATE: two scans of the same token serialize here; the loser re-reads used_at (TC-044).
  select t.* into v_token
  from public.visit_qr_tokens t
  where t.token_hash = pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8'))
  for update;
  if not found then
    perform app.raise('E-08');
  end if;

  if v_token.used_at is not null then
    -- RR-2: a retry by the same customer replays the original answer, even after the 60 s.
    if v_token.used_by_customer_id = v_customer.id and v_token.claim_result is not null then
      return v_token.claim_result;
    end if;
    perform app.raise('E-03');
  end if;
  -- WHY <=: same "pending" boundary as generate_visit_qr (expires_at > now).
  if v_token.invalidated_at is not null or v_token.expires_at <= app.now() then
    perform app.raise('E-02');
  end if;

  select m.* into v_merchant from public.merchants m where m.id = v_token.merchant_id;
  if not v_merchant.is_active then
    perform app.raise('E-05'); -- RN-71; the exception rolls back, the token stays unused
  end if;

  insert into public.customer_merchants (customer_id, merchant_id, origin)
  values (v_customer.id, v_merchant.id, 'first_stamp')
  on conflict do nothing;
  v_relation_created := found;

  -- Lock the relation so a concurrent spin_wheel cannot add an extra stamp we then reset unseen.
  select cm.pending_extra_stamps into v_pending
  from public.customer_merchants cm
  where cm.customer_id = v_customer.id and cm.merchant_id = v_merchant.id
  for update;

  v_cycle := app.roll_cycle(v_customer.id, v_merchant.id);

  -- RN-17; the unique index stamps_one_per_day_idx covers the concurrent case below.
  if exists (
    select 1 from public.stamps s
    where s.customer_id = v_customer.id and s.merchant_id = v_merchant.id and not s.is_bonus and s.local_date = app.local_today()
  ) then
    perform app.raise('E-04', jsonb_build_object('next_available_on', app.local_today() + 1));
  end if;

  begin
    v_result := app.grant_stamps(v_cycle, 1 + v_pending, v_token.id, false);
  exception when unique_violation then
    perform app.raise('E-04', jsonb_build_object('next_available_on', app.local_today() + 1));
  end;

  if v_pending > 0 then
    update public.customer_merchants cm set pending_extra_stamps = 0
    where cm.customer_id = v_customer.id and cm.merchant_id = v_merchant.id;
  end if;

  v_result := jsonb_build_object('merchant_id', v_merchant.id, 'merchant_name', v_merchant.name)
    || v_result
    || jsonb_build_object('relation_created', v_relation_created, 'wheel_status', app.wheel_status(v_customer, v_merchant));

  update public.visit_qr_tokens t
  set used_at = app.now(), used_by_customer_id = v_customer.id, claim_result = v_result
  where t.id = v_token.id;

  -- WHY no insert: the device row belongs to register_device (it knows the platform); an
  -- unregistered device does not block the visit.
  update public.customer_devices d set last_seen_at = app.now()
  where d.customer_id = v_customer.id and d.device_hash = app.peppered_hash(p_device_id_digest);

  return v_result;
end;
$$;

create function public.get_qr_status(p_qr_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_qr public.visit_qr_tokens;
begin
  select t.* into v_qr from public.visit_qr_tokens t where t.id = p_qr_id and t.merchant_id = v_merchant.id;
  if not found then
    perform app.raise('E-19');
  end if;

  return jsonb_build_object('status', case
    when v_qr.used_at is not null then 'used'
    when v_qr.invalidated_at is not null then 'invalidated'
    when v_qr.expires_at <= app.now() then 'expired'
    else 'pending'
  end);
end;
$$;

-- WHY: Supabase grants EXECUTE on new public functions to anon by default.
revoke execute on function public.claim_visit(text, text) from public, anon;
revoke execute on function public.get_qr_status(uuid) from public, anon;
grant execute on function public.claim_visit(text, text) to authenticated;
grant execute on function public.get_qr_status(uuid) to authenticated;
