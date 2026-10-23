-- UI proposals backend: card progress in the catalog (A-19) and in the QR status (P-20), coupon status
-- polling (A-65), previous-period metrics (P-23) and push reach (P-40).

-- WHY read-only instead of app.roll_cycle: list_merchants and get_qr_status are STABLE and must not write.
-- An expired or missing cycle reads as 0 stamps against the current program config, which is what the
-- lazy rollover (RN-25, RN-29) would produce on the next real read. NULL = no relation with the merchant.
create function app.card_progress(p_customer_id uuid, p_merchant_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'stamps', case when cy.id is not null then cy.stamps_count else 0 end,
    'stamps_required', coalesce(cy.stamps_required, lp.stamps_required),
    'reward_title', coalesce(cy.reward_title, lp.reward_title))
  from public.customer_merchants cm
  join public.loyalty_programs lp on lp.merchant_id = cm.merchant_id
  left join public.card_cycles cy
    on cy.customer_id = cm.customer_id and cy.merchant_id = cm.merchant_id
   and cy.status = 'active' and cy.expires_at > app.now()
  where cm.customer_id = p_customer_id and cm.merchant_id = p_merchant_id;
$$;
revoke execute on function app.card_progress(uuid, uuid) from public, anon, authenticated;

-- A-19. Same body as ux_refactor; adds progress.
create or replace function public.list_merchants(
  p_seed text,
  p_query text default null,
  p_category public.merchant_category default null,
  p_offset integer default 0,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_query text := nullif(pg_catalog.btrim(p_query), '');
  v_pattern text;
  v_result jsonb;
begin
  if p_seed is null or pg_catalog.char_length(p_seed) not between 1 and 64 then
    perform app.raise('E-23', '{"field":"seed"}');
  end if;
  if p_limit is null or p_limit not between 1 and 20 then
    perform app.raise('E-23', '{"field":"limit"}');
  end if;
  if p_offset is null or p_offset < 0 then
    perform app.raise('E-23', '{"field":"offset"}');
  end if;

  -- WHY: the query is a literal substring; LIKE wildcards typed by the user must not match anything.
  if v_query is not null then
    v_pattern := '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
      app.search_text(v_query), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  -- One extra row (limit + 1) tells whether another page exists (has_more).
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(r.item order by r.ord) filter (where r.ord <= p_offset + p_limit), '[]'::jsonb),
    'has_more', pg_catalog.count(*) > p_limit
  ) into v_result
  from (
    select
      jsonb_build_object(
        'id', m.id, 'name', m.name, 'category', m.category, 'description', m.description,
        'logo_path', m.logo_path, 'cover_path', m.cover_path, 'maps_url', m.maps_url,
        'is_favorite', fav.is_favorite,
        'progress', app.card_progress(v_customer.id, m.id)
      ) as item,
      -- RN-52: stable random order per session seed; id breaks (improbable) md5 ties. Favorites go
      -- first, and inside each group the seeded order is kept so pagination stays stable.
      pg_catalog.row_number() over (order by fav.is_favorite desc, pg_catalog.md5(m.id::text || p_seed), m.id) as ord
    from public.merchants m
    cross join lateral (
      select exists (select 1 from public.customer_favorites f
                     where f.customer_id = v_customer.id and f.merchant_id = m.id) as is_favorite
    ) fav
    where m.is_visible
      and (p_category is null or m.category = p_category)
      and (v_pattern is null or app.search_text(m.name) like v_pattern)
    order by ord
    offset p_offset
    limit p_limit + 1
  ) r;

  return v_result;
end;
$$;

-- P-20. Same body as the claim_visit migration; a used token adds the customer's card aggregates (no PII).
create or replace function public.get_qr_status(p_qr_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_qr public.visit_qr_tokens;
  v_progress jsonb;
begin
  select t.* into v_qr from public.visit_qr_tokens t where t.id = p_qr_id and t.merchant_id = v_merchant.id;
  if not found then
    perform app.raise('E-19');
  end if;

  if v_qr.used_at is not null then
    v_progress := app.card_progress(v_qr.used_by_customer_id, v_merchant.id);
    return jsonb_build_object('status', 'used',
      'stamps', v_progress -> 'stamps',
      'stamps_required', v_progress -> 'stamps_required',
      'reward_available', exists (
        select 1 from public.coupons c
        where c.customer_id = v_qr.used_by_customer_id and c.merchant_id = v_merchant.id
          and c.source = 'card_reward' and c.status = 'active' and c.expires_at > app.now()));
  end if;

  return jsonb_build_object('status', case
    when v_qr.invalidated_at is not null then 'invalidated'
    when v_qr.expires_at <= app.now() then 'expired'
    else 'pending'
  end);
end;
$$;

-- A-65. WHY a separate RPC from reveal_coupon_code: polling must not hit the reveal limits and must
-- still answer once the coupon is redeemed (reveal raises E-11). E-12 for missing/foreign ids (IDOR).
create function public.get_coupon_status(p_coupon_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_coupon public.coupons;
begin
  select c.* into v_coupon from public.coupons c where c.id = p_coupon_id and c.customer_id = v_customer.id;
  if not found then
    perform app.raise('E-12');
  end if;
  return jsonb_build_object('status', v_coupon.status, 'redeemed_at', v_coupon.redeemed_at);
end;
$$;
revoke execute on function public.get_coupon_status(uuid) from public, anon;
grant execute on function public.get_coupon_status(uuid) to authenticated;

-- P-23. Same body as metrics_delete_account; adds previous (the 30 days before the window; null for 'all').
create or replace function public.get_metrics(p_range text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_since timestamptz := app.now() - interval '30 days';
  v_before timestamptz := app.now() - interval '60 days';
begin
  perform app.require_admin_session();
  if p_range is null or p_range not in ('30d', 'all') then
    perform app.raise('E-23', '{"field":"range"}');
  end if;

  -- RN-66: only aggregates leave this function.
  return jsonb_build_object(
    'visits', (select count(*) from public.visit_qr_tokens t
               where t.merchant_id = v_merchant.id and t.used_at is not null
                 and (p_range = 'all' or t.used_at >= v_since)),
    'redemptions', (select count(*) from public.coupons c
                    where c.merchant_id = v_merchant.id and c.status = 'redeemed'
                      and (p_range = 'all' or c.redeemed_at >= v_since)),
    -- RN-67: always the last 30 days; customers whose account was deleted do not count.
    'active_customers', (select count(distinct t.used_by_customer_id) from public.visit_qr_tokens t
                         join public.customers cu on cu.id = t.used_by_customer_id and cu.status = 'active'
                         where t.merchant_id = v_merchant.id and t.used_at >= v_since),
    'push_remaining_this_month', app.push_remaining(v_merchant.id),
    'previous', case when p_range = 'all' then null else jsonb_build_object(
      'visits', (select count(*) from public.visit_qr_tokens t
                 where t.merchant_id = v_merchant.id and t.used_at >= v_before and t.used_at < v_since),
      'redemptions', (select count(*) from public.coupons c
                      where c.merchant_id = v_merchant.id and c.status = 'redeemed'
                        and c.redeemed_at >= v_before and c.redeemed_at < v_since)) end);
end;
$$;

-- P-40. Same body as offers_push; adds eligible_recipients with the get_push_recipients filter.
-- WHY customers and not devices: it answers "how many people get the notification", like the sender.
create or replace function public.get_push_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  perform app.require_admin_session();
  return jsonb_build_object(
    'remaining_this_month', app.push_remaining(v_merchant.id),
    'limit', 5,
    'resets_on', (app.push_month_start() + interval '1 month')::date,
    'recipients_count', (select count(*) from app.push_recipient_ids(v_merchant.id)),
    'eligible_recipients', (
      select count(*) from app.push_recipient_ids(v_merchant.id) r(id)
      join public.customers cu on cu.id = r.id and cu.push_opt_in
      where exists (select 1 from public.customer_devices d
                    where d.customer_id = r.id and d.push_enabled
                      and d.expo_push_token is not null and d.signed_out_at is null)),
    'push_coupon_validity_hours', v_merchant.push_coupon_validity_hours);
end;
$$;
