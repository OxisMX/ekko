create schema private;
create schema app;

revoke all on schema private from public, anon, authenticated;
revoke all on schema app from public, anon, authenticated;

create type public.merchant_category as enum (
  'restaurantes', 'cafeterias_postres', 'bares_snacks', 'barberias', 'belleza',
  'spas', 'deporte_salud', 'servicios', 'otros'
);
create type public.subscription_status as enum ('active', 'past_due', 'inactive');
create type public.billing_period as enum ('quarterly', 'annual');
create type public.customer_status as enum ('active', 'deleted');
create type public.relation_origin as enum ('add_card', 'first_stamp');
create type public.cycle_status as enum ('active', 'completed', 'expired');
create type public.wheel_prize_type as enum ('coupon', 'extra_stamp');
create type public.coupon_source as enum ('card_reward', 'wheel', 'push', 'birthday');
create type public.coupon_status as enum ('active', 'redeemed');
create type public.campaign_status as enum ('pending', 'sending', 'sent', 'failed');
create type public.device_platform as enum ('ios', 'android');

-- WHY: ADR-13 requires a controllable clock; no function may call now() directly.
-- It lives here (not in 008) because the updated_at trigger below, used by 003, needs it.
-- app.fake_now can only be set from a direct SQL session (pgTAP/local), never through
-- PostgREST, so staging and production effectively ignore it.
create function app.now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(pg_catalog.current_setting('app.fake_now', true), '')::timestamptz, pg_catalog.now());
$$;

create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = app.now();
  return new;
end;
$$;
