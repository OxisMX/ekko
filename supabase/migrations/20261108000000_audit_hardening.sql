-- Audit hardening: P-S1 escalating PIN lockout, A-R2 richer list_my_cards, P-S5 session revocation.

------------------------------------------------------------------------------------------------
-- P-S1. Escalating PIN lockout
------------------------------------------------------------------------------------------------

-- pin_lockouts only resets on a correct PIN; pin_failed_since_success feeds the owner notice.
alter table private.merchant_security
  add column pin_lockouts int not null default 0,
  add column pin_failed_since_success int not null default 0;

-- Same body as wheel_admin_rpc; the lock grows 15 min -> 1 h -> 24 h and success reports the failures.
create or replace function public.unlock_admin(p_pin text)
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
  -- WHY reset only the round: an expired lock starts 5 fresh attempts but keeps pin_lockouts, so the next lock is longer.
  if v_security.pin_locked_until is not null then
    v_security.pin_failed_count := 0;
    v_security.pin_locked_until := null;
  end if;

  if v_security.pin_hash is distinct from extensions.crypt(p_pin, v_security.pin_hash) then
    v_security.pin_failed_count := v_security.pin_failed_count + 1;
    if v_security.pin_failed_count >= 5 then
      v_security.pin_lockouts := v_security.pin_lockouts + 1;
      v_security.pin_locked_until := v_now + case v_security.pin_lockouts
        when 1 then interval '15 minutes' when 2 then interval '1 hour' else interval '24 hours' end;
    end if;
    update private.merchant_security s
    set pin_failed_count = v_security.pin_failed_count, pin_locked_until = v_security.pin_locked_until,
        pin_lockouts = v_security.pin_lockouts, pin_failed_since_success = s.pin_failed_since_success + 1
    where s.merchant_id = v_merchant.id;

    -- WHY return instead of raise: a raise would roll back the counter update (RN-63).
    if v_security.pin_locked_until is not null then
      return jsonb_build_object('ok', false, 'error', 'E-15', 'locked_until', v_security.pin_locked_until);
    end if;
    return jsonb_build_object('ok', false, 'error', 'E-14', 'remaining', 5 - v_security.pin_failed_count);
  end if;

  update private.merchant_security s
  set pin_failed_count = 0, pin_locked_until = null, pin_lockouts = 0, pin_failed_since_success = 0
  where s.merchant_id = v_merchant.id;
  insert into private.merchant_admin_sessions (merchant_id, auth_session_id, expires_at)
  values (v_merchant.id, v_session_id, v_until)
  on conflict (auth_session_id) do update set expires_at = excluded.expires_at, merchant_id = excluded.merchant_id;

  return jsonb_build_object('ok', true, 'admin_unlocked_until', v_until,
    'failed_attempts', v_security.pin_failed_since_success);
end;
$$;

------------------------------------------------------------------------------------------------
-- A-R2. list_my_cards carries everything a wallet card paints
------------------------------------------------------------------------------------------------

-- Same body as ux_refactor; adds stamps, reward_title, background_path and pending_extra_stamps
-- (same sources as get_merchant_detail's card) so the wallet needs no per-card detail call.
create or replace function public.list_my_cards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_now timestamptz := app.now();
begin
  -- WHY every relation, including unavailable merchants: RN-71 shows them as "No disponible".
  -- Lazy cycle rollover (TRD §7.2) runs per relation so expired partial stamps read as 0 (RN-25).
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'merchant_id', card.merchant_id,
        'merchant_name', card.merchant_name,
        'logo_path', card.logo_path,
        'stamp_image_path', card.stamp_image_path,
        'background_path', card.background_path,
        'merchant_available', card.merchant_available,
        'stamps_count', card.stamps_count,
        'stamps_required', card.stamps_required,
        'stamps', card.stamps,
        'reward_title', card.reward_title,
        'pending_extra_stamps', card.pending_extra_stamps,
        'cycle_expires_at', card.cycle_expires_at,
        'reward_available', card.reward_available,
        'wheel_status', card.wheel_status
      )
      order by card.reward_available desc, card.merchant_available desc, card.created_at desc, card.merchant_id
    )
    from (
      select
        m.id as merchant_id, m.name as merchant_name, m.logo_path, lp.stamp_image_path,
        lp.card_background_path as background_path, cm.created_at, cm.pending_extra_stamps,
        m.is_active and m.is_visible as merchant_available,
        cy.stamps_count, cy.stamps_required, cy.expires_at as cycle_expires_at, cy.reward_title,
        (select coalesce(jsonb_agg(jsonb_build_object('granted_at', s.granted_at, 'is_bonus', s.is_bonus) order by s.granted_at), '[]'::jsonb)
         from public.stamps s where s.cycle_id = cy.id) as stamps,
        exists (
          select 1 from public.coupons c
          where c.customer_id = v_customer.id and c.merchant_id = m.id and c.source = 'card_reward'
            and c.status = 'active' and c.expires_at > v_now
        ) as reward_available,
        app.wheel_status(v_customer, m) as wheel_status
      from public.customer_merchants cm
      join public.merchants m on m.id = cm.merchant_id
      join public.loyalty_programs lp on lp.merchant_id = m.id
      cross join lateral app.roll_cycle(cm.customer_id, cm.merchant_id) cy
      where cm.customer_id = v_customer.id
    ) card
  ), '[]'::jsonb);
end;
$$;

------------------------------------------------------------------------------------------------
-- P-S5. Ops: sign out every session of a user (scripts/revoke-sessions.ts)
------------------------------------------------------------------------------------------------

create function public.revoke_user_sessions(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  -- WHY explicit: merchant_admin_sessions.auth_session_id has no FK to auth.sessions.
  delete from private.merchant_admin_sessions a
  where a.auth_session_id in (select s.id from auth.sessions s where s.user_id = p_user_id);
  -- auth.refresh_tokens.session_id cascades from auth.sessions.
  delete from auth.sessions s where s.user_id = p_user_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
