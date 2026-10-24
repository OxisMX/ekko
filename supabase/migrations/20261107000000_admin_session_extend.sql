-- Manual "extend session" for the admin window (RN-64 follow-up).

-- WHY greatest: an admin RPC must never SHORTEN a window the merchant extended on purpose.
create or replace function app.require_admin_session()
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
  set expires_at = greatest(a.expires_at, v_now + interval '5 minutes')
  where a.merchant_id = v_merchant.id and a.auth_session_id = app.current_session_id() and a.expires_at > v_now;
  if not found then
    perform app.raise('E-16');
  end if;
end;
$$;

-- WHY cap at 15 min from now: an unattended tablet must not stay unlocked indefinitely.
create function public.extend_admin_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_now timestamptz := app.now();
  v_until timestamptz;
begin
  update private.merchant_admin_sessions a
  set expires_at = least(greatest(a.expires_at, v_now) + interval '5 minutes', v_now + interval '15 minutes')
  where a.merchant_id = v_merchant.id and a.auth_session_id = app.current_session_id() and a.expires_at > v_now
  returning a.expires_at into v_until;
  if v_until is null then
    perform app.raise('E-16');
  end if;
  return jsonb_build_object('expires_at', v_until);
end;
$$;

revoke execute on function public.extend_admin_session() from public, anon;
grant execute on function public.extend_admin_session() to authenticated;
