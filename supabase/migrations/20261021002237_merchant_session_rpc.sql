-- Backend §4.4, brought forward to S1 for the panel login (F-20).
-- Uses current_merchant (not require_active_merchant): an inactive merchant must still log in
-- and see P-12.
create function public.get_merchant_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_now timestamptz := app.now();
  v_session_id text := auth.jwt() ->> 'session_id';
  v_security private.merchant_security;
begin
  select ms.* into v_security
  from private.merchant_security ms
  where ms.merchant_id = v_merchant.id;

  return jsonb_build_object(
    'merchant', jsonb_build_object(
      'id', v_merchant.id,
      'name', v_merchant.name,
      'logo_path', v_merchant.logo_path
    ),
    'is_active', v_merchant.is_active,
    'admin_unlocked_until', (
      select max(a.expires_at)
      from private.merchant_admin_sessions a
      where a.merchant_id = v_merchant.id
        and a.auth_session_id::text = v_session_id
        and a.expires_at > v_now
    ),
    'pin_locked_until',
      case when v_security.pin_locked_until > v_now then v_security.pin_locked_until end,
    'validator_locked_until',
      case when v_security.validator_locked_until > v_now then v_security.validator_locked_until end
  );
end;
$$;

-- WHY: Supabase grants EXECUTE on new public functions to anon by default.
revoke execute on function public.get_merchant_session() from public, anon;
grant execute on function public.get_merchant_session() to authenticated;
