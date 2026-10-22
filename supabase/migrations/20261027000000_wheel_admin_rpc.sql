-- Backend §4.2 get_wheel / spin_wheel (S8), §4.5 unlock_admin / lock_admin and §3 app.require_admin_session.

-- Session of the JWT (auth.sessions id). WHY E-19 when absent: an admin session is bound to a
-- device session, so a token without session_id can never hold one.
create function app.current_session_id()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_session_id is null then
    perform app.raise('E-19');
  end if;
  return v_session_id;
end;
$$;

-- RN-64: every use extends the admin session 5 minutes (inactivity timeout); S9+ RPCs call this first.
create function app.require_admin_session()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_now timestamptz := app.now();
begin
  update private.merchant_admin_sessions a
  set expires_at = v_now + interval '5 minutes'
  where a.merchant_id = v_merchant.id and a.auth_session_id = app.current_session_id() and a.expires_at > v_now;
  if not found then
    perform app.raise('E-16');
  end if;
end;
$$;

revoke execute on function app.current_session_id() from public, anon, authenticated;
revoke execute on function app.require_admin_session() from public, anon, authenticated;

-- WHY no raise without relation: same as get_merchant_detail, the answer is status 'no_relation'
-- (the wheel preview is public for visible merchants). E-05 only for a merchant the caller
-- cannot see at all. Weights and benefit copy never leave private.wheel_prizes.
create function public.get_wheel(p_merchant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_merchant public.merchants;
  v_has_relation boolean;
begin
  select m.* into v_merchant from public.merchants m where m.id = p_merchant_id;
  v_has_relation := exists (
    select 1 from public.customer_merchants cm where cm.customer_id = v_customer.id and cm.merchant_id = p_merchant_id);
  if v_merchant.id is null or not (v_has_relation or (v_merchant.is_active and v_merchant.is_visible)) then
    perform app.raise('E-05');
  end if;

  return jsonb_build_object(
    'segments', coalesce((
      select jsonb_agg(jsonb_build_object('index', s.idx, 'label', s.label) order by s.idx)
      from (
        select (pg_catalog.row_number() over (order by wp.position, wp.id) - 1)::int as idx, wp.label
        from private.wheel_prizes wp where wp.merchant_id = p_merchant_id and wp.is_active
      ) s
    ), '[]'::jsonb),
    'status', case when v_has_relation then app.wheel_status(v_customer, v_merchant) else 'no_relation' end);
end;
$$;

create function public.spin_wheel(p_merchant_id uuid, p_device_id_digest text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_merchant public.merchants;
  v_device_hash bytea;
  v_email_hash bytea;
  v_prizes private.wheel_prizes[];
  v_total bigint;
  v_limit bigint;
  v_roll bigint;
  v_bytes bytea;
  v_index int := 0;
  v_prize private.wheel_prizes;
  v_spin_id uuid;
  v_coupon_id uuid;
begin
  if p_device_id_digest is null or p_device_id_digest !~ '^[0-9a-f]{64}$' then
    perform app.raise('E-23', '{"field":"device_id_digest"}');
  end if;

  select m.* into v_merchant from public.merchants m where m.id = p_merchant_id;
  -- WHY E-05 without relation: the wheel is only spun from a card the customer holds.
  perform 1 from public.customer_merchants cm
  where cm.customer_id = v_customer.id and cm.merchant_id = p_merchant_id
  for update; -- also serializes with claim_visit's read of pending_extra_stamps
  if not found or not v_merchant.is_active then
    perform app.raise('E-05');
  end if;
  if not app.is_email_verified(v_customer) then
    perform app.raise('E-06');
  end if;

  v_device_hash := app.peppered_hash(p_device_id_digest);
  -- RN-09: the hash survives account deletion, so a re-registered email cannot spin again.
  select app.peppered_hash(pg_catalog.lower(pg_catalog.btrim(u.email))) into v_email_hash
  from auth.users u where u.id = v_customer.auth_user_id;

  -- RN-07 / RN-09. The unique constraints cover the concurrent case (handled at the insert).
  if exists (
    select 1 from public.wheel_spins ws
    where ws.merchant_id = p_merchant_id
      and (ws.customer_id = v_customer.id or ws.device_hash = v_device_hash or ws.email_hash = v_email_hash)
  ) then
    perform app.raise('E-09');
  end if;

  select pg_catalog.array_agg(wp order by wp.position, wp.id) into v_prizes
  from private.wheel_prizes wp where wp.merchant_id = p_merchant_id and wp.is_active;
  if v_prizes is null then
    perform app.raise('E-05'); -- no active segments: wheel unavailable
  end if;
  select pg_catalog.sum(p.weight) into v_total from pg_catalog.unnest(v_prizes) p;

  -- RN-34: server-side draw. Rejection sampling over 32 random bits removes modulo bias.
  v_limit := 4294967296 - 4294967296 % v_total;
  loop
    v_bytes := extensions.gen_random_bytes(4);
    v_roll := pg_catalog.get_byte(v_bytes, 0)::bigint * 16777216 + pg_catalog.get_byte(v_bytes, 1)::bigint * 65536
      + pg_catalog.get_byte(v_bytes, 2)::bigint * 256 + pg_catalog.get_byte(v_bytes, 3)::bigint;
    exit when v_roll < v_limit;
  end loop;
  v_roll := v_roll % v_total;

  loop
    v_index := v_index + 1;
    v_prize := v_prizes[v_index];
    exit when v_roll < v_prize.weight;
    v_roll := v_roll - v_prize.weight;
  end loop;

  begin
    insert into public.wheel_spins (customer_id, merchant_id, prize_id, device_hash, email_hash, spun_at)
    values (v_customer.id, p_merchant_id, v_prize.id, v_device_hash, v_email_hash, app.now())
    returning id into v_spin_id;
  exception when unique_violation then
    perform app.raise('E-09'); -- concurrent spin by account, device or email hash
  end;

  if v_prize.prize_type = 'extra_stamp' then
    -- RN-36: applied by the next valid claim_visit.
    update public.customer_merchants cm set pending_extra_stamps = cm.pending_extra_stamps + 1
    where cm.customer_id = v_customer.id and cm.merchant_id = p_merchant_id;
  else
    -- RN-35: 48 h coupon. A code collision within the merchant regenerates the code.
    for v_attempt in 1..5 loop
      begin
        insert into public.coupons (customer_id, merchant_id, source, spin_id, title, description, code, issued_at, expires_at)
        values (v_customer.id, p_merchant_id, 'wheel', v_spin_id, v_prize.benefit_title, v_prize.benefit_description,
                app.random_code(), app.now(), app.now() + interval '48 hours')
        returning id into v_coupon_id;
        exit;
      exception when unique_violation then
        null; -- code collision; retry with a new code
      end;
    end loop;
    if v_coupon_id is null then
      perform app.raise('E-99', '{"reason":"coupon code collisions"}');
    end if;
  end if;

  return jsonb_build_object('segment_index', v_index - 1, 'prize_type', v_prize.prize_type,
    'label', v_prize.label, 'coupon_id', v_coupon_id);
end;
$$;

-- RN-62..RN-65. Uses current_merchant (not require_active_merchant), like get_merchant_session.
create function public.unlock_admin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_session_id uuid := app.current_session_id();
  v_security private.merchant_security;
  v_now timestamptz := app.now();
  v_until timestamptz := app.now() + interval '5 minutes';
begin
  -- WHY E-23 before counting: a malformed PIN is a client bug, not a guess.
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    perform app.raise('E-23', '{"field":"pin"}');
  end if;

  -- WHY FOR UPDATE: concurrent guesses serialize on the counter (RN-63).
  select s.* into v_security from private.merchant_security s where s.merchant_id = v_merchant.id for update;

  if v_security.pin_locked_until > v_now then
    perform app.raise('E-15', jsonb_build_object('locked_until', v_security.pin_locked_until));
  end if;
  -- WHY reset: an expired lock starts a fresh set of 5 attempts.
  if v_security.pin_locked_until is not null then
    v_security.pin_failed_count := 0;
    v_security.pin_locked_until := null;
  end if;

  if v_security.pin_hash is distinct from extensions.crypt(p_pin, v_security.pin_hash) then
    v_security.pin_failed_count := v_security.pin_failed_count + 1;
    if v_security.pin_failed_count >= 5 then
      v_security.pin_locked_until := v_now + interval '15 minutes';
    end if;
    update private.merchant_security s
    set pin_failed_count = v_security.pin_failed_count, pin_locked_until = v_security.pin_locked_until
    where s.merchant_id = v_merchant.id;

    -- WHY return instead of raise: a raise would roll back the counter update (RN-63).
    if v_security.pin_locked_until is not null then
      return jsonb_build_object('ok', false, 'error', 'E-15', 'locked_until', v_security.pin_locked_until);
    end if;
    return jsonb_build_object('ok', false, 'error', 'E-14', 'remaining', 5 - v_security.pin_failed_count);
  end if;

  update private.merchant_security s set pin_failed_count = 0, pin_locked_until = null where s.merchant_id = v_merchant.id;
  insert into private.merchant_admin_sessions (merchant_id, auth_session_id, expires_at)
  values (v_merchant.id, v_session_id, v_until)
  on conflict (auth_session_id) do update set expires_at = excluded.expires_at, merchant_id = excluded.merchant_id;

  return jsonb_build_object('ok', true, 'admin_unlocked_until', v_until);
end;
$$;

create function public.lock_admin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  delete from private.merchant_admin_sessions a
  where a.merchant_id = v_merchant.id and a.auth_session_id = app.current_session_id();
  return jsonb_build_object('ok', true);
end;
$$;

-- WHY: Supabase grants EXECUTE on new public functions to anon by default.
revoke execute on function public.get_wheel(uuid) from public, anon;
revoke execute on function public.spin_wheel(uuid, text) from public, anon;
revoke execute on function public.unlock_admin(text) from public, anon;
revoke execute on function public.lock_admin() from public, anon;
grant execute on function public.get_wheel(uuid) to authenticated;
grant execute on function public.spin_wheel(uuid, text) to authenticated;
grant execute on function public.unlock_admin(text) to authenticated;
grant execute on function public.lock_admin() to authenticated;
