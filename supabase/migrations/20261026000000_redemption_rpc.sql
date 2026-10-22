-- Backend §4.3 list_my_coupons / reveal_coupon_code and §4.4 lookup_redemption / confirm_redemption (S7).

create function public.list_my_coupons(p_merchant_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
begin
  -- WHY no is_active filter: RN-71, an issued benefit stays redeemable; merchant_available lets the UI say so.
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', c.id, 'merchant_id', c.merchant_id, 'merchant_name', m.name, 'source', c.source,
        'title', c.title, 'description', c.description, 'terms', c.terms, 'expires_at', c.expires_at,
        'merchant_available', m.is_active and m.is_visible
      )
      order by c.expires_at, c.id
    )
    from public.coupons c
    join public.merchants m on m.id = c.merchant_id
    where c.customer_id = v_customer.id and c.status = 'active' and c.expires_at > app.now()
      and (p_merchant_id is null or c.merchant_id = p_merchant_id)
  ), '[]'::jsonb);
end;
$$;

create function public.reveal_coupon_code(p_coupon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_coupon public.coupons;
  v_merchant_name text;
begin
  -- WHY the same E-12 for "missing" and "someone else's": do not reveal that the id exists (IDOR).
  select c.* into v_coupon from public.coupons c where c.id = p_coupon_id and c.customer_id = v_customer.id;
  if not found then
    perform app.raise('E-12');
  end if;
  if not app.is_email_verified(v_customer) then
    perform app.raise('E-06');
  end if;
  if v_coupon.status = 'redeemed' then
    perform app.raise('E-11');
  end if;
  if v_coupon.expires_at <= app.now() then
    perform app.raise('E-10');
  end if;

  select m.name into v_merchant_name from public.merchants m where m.id = v_coupon.merchant_id;
  return jsonb_build_object('code', v_coupon.code, 'expires_at', v_coupon.expires_at,
    'title', v_coupon.title, 'merchant_name', v_merchant_name);
end;
$$;

create function public.lookup_redemption(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant(); -- RN-71: inactive merchants may still redeem
  v_security private.merchant_security;
  v_code text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_code, '')));
  v_coupon public.coupons;
  v_now timestamptz := app.now();
begin
  -- WHY FOR UPDATE: concurrent guesses serialize on the counter, so nobody gets more than 10 tries.
  select s.* into v_security from private.merchant_security s where s.merchant_id = v_merchant.id for update;

  if v_security.validator_locked_until > v_now then
    perform app.raise('E-13', jsonb_build_object('locked_until', v_security.validator_locked_until));
  end if;

  select c.* into v_coupon from public.coupons c where c.merchant_id = v_merchant.id and c.code = v_code;

  if not found then
    -- WHY return instead of raise: a raise would roll back this counter update (RN-39 anti-guessing).
    -- NOTE: a hit never resets the counter, so alternating hits and misses cannot evade the lock.
    if v_security.code_window_started_at is null or v_security.code_window_started_at + interval '5 minutes' <= v_now then
      v_security.code_failed_count := 1;
      v_security.code_window_started_at := v_now;
    else
      v_security.code_failed_count := v_security.code_failed_count + 1;
    end if;

    if v_security.code_failed_count >= 10 then
      v_security.validator_locked_until := v_now + interval '5 minutes';
    end if;

    update private.merchant_security s
    set code_failed_count = v_security.code_failed_count,
        code_window_started_at = v_security.code_window_started_at,
        validator_locked_until = v_security.validator_locked_until
    where s.merchant_id = v_merchant.id;

    if v_security.code_failed_count >= 10 then
      return jsonb_build_object('ok', false, 'error', 'E-13', 'locked_until', v_security.validator_locked_until);
    end if;
    return jsonb_build_object('ok', false, 'error', 'E-12', 'remaining', 10 - v_security.code_failed_count);
  end if;

  -- A found code is not a guess: E-11/E-10 raise and do not count.
  if v_coupon.status = 'redeemed' then
    perform app.raise('E-11');
  end if;
  if v_coupon.expires_at <= v_now then
    perform app.raise('E-10');
  end if;

  return jsonb_build_object(
    'ok', true, 'coupon_id', v_coupon.id,
    'customer_full_name', (select pg_catalog.concat_ws(' ', cu.first_name, cu.last_name) from public.customers cu where cu.id = v_coupon.customer_id),
    'title', v_coupon.title, 'description', v_coupon.description, 'terms', v_coupon.terms,
    'source', v_coupon.source, 'expires_at', v_coupon.expires_at);
end;
$$;

create function public.confirm_redemption(p_coupon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant(); -- RN-71: inactive merchants may still redeem
  v_coupon public.coupons;
  v_now timestamptz := app.now();
begin
  select c.* into v_coupon from public.coupons c
  where c.id = p_coupon_id and c.merchant_id = v_merchant.id
  for update;
  if not found then
    perform app.raise('E-12');
  end if;

  if v_coupon.status = 'redeemed' then
    -- WHY 60 s: a double tap or a network retry from the same till gets the original answer.
    if v_coupon.redeemed_at > v_now - interval '60 seconds' then
      return jsonb_build_object('redeemed_at', v_coupon.redeemed_at);
    end if;
    perform app.raise('E-11');
  end if;
  if v_coupon.expires_at <= v_now then
    perform app.raise('E-10');
  end if;

  update public.coupons c set status = 'redeemed', redeemed_at = v_now where c.id = v_coupon.id;
  return jsonb_build_object('redeemed_at', v_now);
end;
$$;

-- WHY: Supabase grants EXECUTE on new public functions to anon by default.
revoke execute on function public.list_my_coupons(uuid) from public, anon;
revoke execute on function public.reveal_coupon_code(uuid) from public, anon;
revoke execute on function public.lookup_redemption(text) from public, anon;
revoke execute on function public.confirm_redemption(uuid) from public, anon;
grant execute on function public.list_my_coupons(uuid) to authenticated;
grant execute on function public.reveal_coupon_code(uuid) to authenticated;
grant execute on function public.lookup_redemption(text) to authenticated;
grant execute on function public.confirm_redemption(uuid) to authenticated;
