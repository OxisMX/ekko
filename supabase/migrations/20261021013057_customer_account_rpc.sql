-- Backend §4.1: customer account and device RPCs (Sprint 2). sign_out_device, ensure_birthday_coupons
-- and list_my_redemptions ship with their own sprints.
-- E-23 "Datos inválidos" (details {"field": ...}) is the input-validation error of these RPCs.

create function public.complete_profile(p_first_name text, p_last_name text, p_birth_date date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_first_name text := pg_catalog.btrim(p_first_name);
  v_last_name text := pg_catalog.btrim(p_last_name);
begin
  if v_first_name is null or pg_catalog.char_length(v_first_name) not between 2 and 50 then
    perform app.raise('E-23', '{"field":"first_name"}');
  end if;
  if v_last_name is null or pg_catalog.char_length(v_last_name) not between 2 and 50 then
    perform app.raise('E-23', '{"field":"last_name"}');
  end if;

  -- WHY: RN-04. Once set, birth_date only changes through Oxis support; a different value from
  -- the app is ignored silently (TC-007) and is not validated.
  if v_customer.birth_date is null then
    if p_birth_date is null then
      perform app.raise('E-23', '{"field":"birth_date"}');
    end if;
    -- WHY: date + interval handles Feb 29 (2008-02-29 + 18 y = 2026-02-28); exactly 18 today is
    -- allowed (TC-002), 18 tomorrow is not (TC-003). Local date per ADR-13.
    if p_birth_date + interval '18 years' > app.local_today() then
      perform app.raise('E-07');
    end if;
  end if;

  update public.customers c
  set first_name = v_first_name,
      last_name = v_last_name,
      birth_date = coalesce(c.birth_date, p_birth_date)
  where c.id = v_customer.id;

  return '{"profile_complete": true}'::jsonb;
end;
$$;

create function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
begin
  return jsonb_build_object(
    'first_name', v_customer.first_name,
    'last_name', v_customer.last_name,
    'birth_date', v_customer.birth_date,
    'email', (select u.email from auth.users u where u.id = v_customer.auth_user_id),
    'auth_provider', v_customer.auth_provider,
    'email_verified', app.is_email_verified(v_customer),
    'profile_complete', v_customer.first_name is not null
      and v_customer.last_name is not null
      and v_customer.birth_date is not null
  );
end;
$$;

create function public.register_device(
  p_device_id_digest text,
  p_platform public.device_platform,
  p_expo_push_token text default null,
  p_push_enabled boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
begin
  -- The app sends the SHA-256 hex of its device_id; anything else is not a digest.
  if p_device_id_digest is null or p_device_id_digest !~ '^[0-9a-f]{64}$' then
    perform app.raise('E-23', '{"field":"device_id_digest"}');
  end if;
  if p_platform is null then
    perform app.raise('E-23', '{"field":"platform"}');
  end if;

  insert into public.customer_devices as d (
    customer_id, device_hash, platform, expo_push_token, push_enabled, last_seen_at
  ) values (
    v_customer.id, app.peppered_hash(p_device_id_digest), p_platform, p_expo_push_token,
    coalesce(p_push_enabled, false), app.now()
  )
  on conflict (customer_id, device_hash) do update
  set platform = excluded.platform,
      -- WHY: a launch without a fresh token (permission pending, token fetch failed) must not
      -- wipe the last known one.
      expo_push_token = coalesce(excluded.expo_push_token, d.expo_push_token),
      push_enabled = excluded.push_enabled,
      last_seen_at = excluded.last_seen_at,
      signed_out_at = null;

  return '{"ok": true}'::jsonb;
end;
$$;

-- WHY: Supabase grants EXECUTE on new public functions to anon by default.
revoke execute on function public.complete_profile(text, text, date) from public, anon;
revoke execute on function public.get_my_profile() from public, anon;
revoke execute on function public.register_device(text, public.device_platform, text, boolean) from public, anon;
grant execute on function public.complete_profile(text, text, date) to authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.register_device(text, public.device_platform, text, boolean) to authenticated;
