-- Backend §4.5 get_metrics / list_qr_log (US-27, P-05, P-11), §4.6 anonymize_customer (RN-08, F-15)
-- and §9 KPI views for Oxis (schema private, no API access).

------------------------------------------------------------------------------------------------
-- Panel: metrics and QR log (PIN-protected sections; inactive merchants may read, like get_push_status)
------------------------------------------------------------------------------------------------

-- WHY a visit is a used QR token: claim_visit marks the token used once per visit, while one visit
-- can grant several stamps (RN-36 bonus), so counting stamps would inflate visits.
create function public.get_metrics(p_range text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_since timestamptz := app.now() - interval '30 days';
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
    'push_remaining_this_month', app.push_remaining(v_merchant.id));
end;
$$;

-- Statuses match get_qr_status. WHY 'invalidated' is listed: generating a new QR replaces the previous
-- pending one, and the log must say so instead of showing it as pending or expired.
create function public.list_qr_log(p_offset integer default 0, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  perform app.require_admin_session();
  if p_offset is null or p_offset < 0 then
    perform app.raise('E-23', '{"field":"offset"}');
  elsif p_limit is null or p_limit not between 1 and 50 then
    perform app.raise('E-23', '{"field":"limit"}');
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'created_at', x.created_at, 'expires_at', x.expires_at, 'used_at', x.used_at,
      'status', case
        when x.used_at is not null then 'used'
        when x.invalidated_at is not null then 'invalidated'
        when x.expires_at <= app.now() then 'expired'
        else 'pending' end) order by x.created_at desc, x.id)
    from (
      select t.* from public.visit_qr_tokens t
      where t.merchant_id = v_merchant.id
      order by t.created_at desc, t.id
      offset p_offset limit p_limit
    ) x), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_metrics(text) from public, anon;
revoke execute on function public.list_qr_log(integer, integer) from public, anon;
grant execute on function public.get_metrics(text) to authenticated;
grant execute on function public.list_qr_log(integer, integer) to authenticated;

------------------------------------------------------------------------------------------------
-- Account deletion (service_role only, called by the delete-account Edge Function)
------------------------------------------------------------------------------------------------

-- Backend 6.4. Returns true when it anonymized now, false when the customer was already deleted.
-- WHY idempotent: delete-account may be retried when the Auth user deletion fails after this step.
create function public.anonymize_customer(p_customer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  select c.* into v_customer from public.customers c where c.id = p_customer_id for update;
  if not found then
    perform app.raise('E-23', '{"field":"customer_id"}');
  end if;
  if v_customer.status = 'deleted' then
    return false;
  end if;

  update public.customers
  set first_name = null, last_name = null, birth_date = null, status = 'deleted', deleted_at = app.now()
  where id = p_customer_id;

  -- device_hash stays (RN-07); the token goes so the account stops receiving push.
  update public.customer_devices set expo_push_token = null, push_enabled = false where customer_id = p_customer_id;
  delete from public.coupons where customer_id = p_customer_id and status = 'active';
  update public.card_cycles set status = 'expired', closed_at = app.now()
  where customer_id = p_customer_id and status = 'active';
  delete from public.customer_merchants where customer_id = p_customer_id;
  -- stamps, wheel_spins (email_hash, device_hash, RN-09) and redeemed coupons stay under the anonymous id.
  return true;
end;
$$;

revoke execute on function public.anonymize_customer(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_customer(uuid) to service_role;

------------------------------------------------------------------------------------------------
-- KPI views for Oxis (Studio / SQL). WHY no grants: schema private has no usage for API roles.
------------------------------------------------------------------------------------------------

-- Active and visible merchants by local month of creation.
create view private.kpi_merchants as
select pg_catalog.date_trunc('month', m.created_at at time zone 'America/Mexico_City')::date as month,
       count(*) filter (where m.is_active and m.is_visible) as active_visible_merchants
from public.merchants m
group by 1;

create view private.kpi_customers as
select count(*) filter (where c.status = 'active') as registered_customers
from public.customers c;

-- Visit stamps (bonus excluded, RN-36) per ISO week (Monday start) of the local date.
create view private.kpi_weekly_stamps as
select pg_catalog.date_trunc('week', s.local_date)::date as week_start, count(*) as stamps
from public.stamps s
where not s.is_bonus
group by 1;

-- WHY closed = redeemed or expired: a coupon still valid has not had its chance yet.
create view private.kpi_reward_redemption as
select count(*) filter (where c.status = 'redeemed') as redeemed,
       count(*) as issued_closed,
       round(100.0 * count(*) filter (where c.status = 'redeemed') / nullif(count(*), 0), 1) as redemption_pct
from public.coupons c
where c.source = 'card_reward' and (c.status = 'redeemed' or c.expires_at <= app.now());

create view private.kpi_coupon_redemption as
select count(*) filter (where c.status = 'redeemed') as redeemed,
       count(*) as issued_closed,
       round(100.0 * count(*) filter (where c.status = 'redeemed') / nullif(count(*), 0), 1) as redemption_pct
from public.coupons c
where c.source in ('wheel', 'push', 'birthday') and (c.status = 'redeemed' or c.expires_at <= app.now());

-- RN-70: 15 grace days after paid_until. Lists merchants due within 15 days or already overdue.
create view private.merchants_billing as
select m.id as merchant_id, m.name, m.subscription_status, m.is_active, m.paid_until,
       m.paid_until - app.local_today() as days_to_due,
       case when m.paid_until < app.local_today() then 'overdue' else 'expiring' end as billing_state,
       case when m.paid_until < app.local_today()
            then greatest(15 + (m.paid_until - app.local_today()), 0) end as grace_days_left
from public.merchants m
where m.paid_until <= app.local_today() + 15;
