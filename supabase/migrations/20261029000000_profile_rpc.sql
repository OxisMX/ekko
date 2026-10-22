-- Backend §4.1 sign_out_device, list_my_redemptions (Sprint 10, profile screen).

-- F-16: on sign-out the device stops receiving push. WHY no insert: a missing row means the device
-- never registered, so there is nothing to silence and signing out must not fail.
create function public.sign_out_device(p_device_id_digest text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
begin
  if p_device_id_digest is null or p_device_id_digest !~ '^[0-9a-f]{64}$' then
    perform app.raise('E-23', '{"field":"device_id_digest"}');
  end if;

  update public.customer_devices
  set expo_push_token = null, signed_out_at = app.now()
  where customer_id = v_customer.id and device_hash = app.peppered_hash(p_device_id_digest);

  return '{"ok": true}'::jsonb;
end;
$$;

-- Redemption history. WHY E-23 instead of clamping the limit: same contract as list_merchants, the
-- client learns about a wrong page size instead of silently getting fewer rows.
-- WHY no is_active filter: the history belongs to the customer even if the merchant went inactive (RN-72).
create function public.list_my_redemptions(p_offset integer default 0, p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
begin
  if p_offset is null or p_offset < 0 then
    perform app.raise('E-23', '{"field":"offset"}');
  elsif p_limit is null or p_limit not between 1 and 50 then
    perform app.raise('E-23', '{"field":"limit"}');
  end if;

  return coalesce((
    select jsonb_agg(r.row order by r.redeemed_at desc, r.id)
    from (
      select c.id, c.redeemed_at, jsonb_build_object(
        'coupon_id', c.id, 'merchant_name', m.name, 'title', c.title,
        'source', c.source, 'redeemed_at', c.redeemed_at) as row
      from public.coupons c join public.merchants m on m.id = c.merchant_id
      where c.customer_id = v_customer.id and c.status = 'redeemed'
      order by c.redeemed_at desc, c.id
      offset p_offset limit p_limit
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.sign_out_device(text) from public, anon;
revoke execute on function public.list_my_redemptions(integer, integer) from public, anon;
grant execute on function public.sign_out_device(text) to authenticated;
grant execute on function public.list_my_redemptions(integer, integer) to authenticated;
