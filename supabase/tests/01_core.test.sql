begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- app.now()
select ok(
  abs(extract(epoch from app.now() - clock_timestamp())) < 5,
  'app.now() returns real time when app.fake_now is unset'
);
set local app.fake_now = '2026-01-01 12:00:00-06';
select is(app.now(), '2026-01-01 12:00:00-06'::timestamptz, 'app.now() returns app.fake_now when set');
set local app.fake_now = '';
select ok(
  abs(extract(epoch from app.now() - clock_timestamp())) < 5,
  'app.now() falls back to real time when app.fake_now is empty'
);

-- Schema isolation
select ok(not has_schema_privilege('anon', 'private', 'USAGE'), 'anon has no USAGE on private');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated has no USAGE on private');
select ok(not has_schema_privilege('anon', 'app', 'USAGE'), 'anon has no USAGE on app');
select ok(not has_schema_privilege('authenticated', 'app', 'USAGE'), 'authenticated has no USAGE on app');

-- Fixtures
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3');

set local app.fake_now = '2025-06-01 12:00:00-06';
insert into public.merchants (
  id, auth_user_id, name, category, description, address, logo_path, cover_path,
  maps_url, reviews_url, subscription_status, billing_period, paid_until
) values (
  '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
  'Cafe Prueba', 'cafeterias_postres', 'desc', 'addr', 'logo', 'cover',
  'https://maps.example', 'https://reviews.example', 'active', 'annual', '2026-06-01'
);

-- CHECK constraints
select throws_ok(
  $$ insert into public.loyalty_programs (merchant_id, stamps_required, reward_title, reward_description, terms)
     values ('00000000-0000-0000-0000-0000000000b1', 3, 't', 'd', 'x') $$,
  '23514', null, 'stamps_required 3 rejected'
);
select throws_ok(
  $$ insert into public.loyalty_programs (merchant_id, stamps_required, reward_title, reward_description, terms)
     values ('00000000-0000-0000-0000-0000000000b1', 11, 't', 'd', 'x') $$,
  '23514', null, 'stamps_required 11 rejected'
);
select throws_ok(
  $$ insert into public.loyalty_programs (merchant_id, cycle_months, reward_title, reward_description, terms)
     values ('00000000-0000-0000-0000-0000000000b1', 2, 't', 'd', 'x') $$,
  '23514', null, 'cycle_months 2 rejected'
);
select throws_ok(
  $$ insert into public.loyalty_programs (merchant_id, cycle_months, reward_title, reward_description, terms)
     values ('00000000-0000-0000-0000-0000000000b1', 13, 't', 'd', 'x') $$,
  '23514', null, 'cycle_months 13 rejected'
);
select throws_ok(
  $$ insert into public.merchants (
       auth_user_id, name, category, description, address, logo_path, cover_path, maps_url,
       reviews_url, subscription_status, billing_period, paid_until, push_coupon_validity_hours
     ) values (
       '00000000-0000-0000-0000-0000000000a2', 'x', 'otros', 'd', 'a', 'l', 'c', 'm', 'r',
       'active', 'annual', '2026-06-01', 23
     ) $$,
  '23514', null, 'push_coupon_validity_hours 23 rejected'
);
select throws_ok(
  $$ insert into public.merchants (
       auth_user_id, name, category, description, address, logo_path, cover_path, maps_url,
       reviews_url, subscription_status, billing_period, paid_until, push_coupon_validity_hours
     ) values (
       '00000000-0000-0000-0000-0000000000a3', 'x', 'otros', 'd', 'a', 'l', 'c', 'm', 'r',
       'active', 'annual', '2026-06-01', 49
     ) $$,
  '23514', null, 'push_coupon_validity_hours 49 rejected'
);

-- created_at / updated_at follow app.now()
select is(
  (select created_at from public.merchants where id = '00000000-0000-0000-0000-0000000000b1'),
  '2025-06-01 12:00:00-06'::timestamptz,
  'created_at is set from app.now()'
);
set local app.fake_now = '2026-01-01 12:00:00-06';
update public.merchants set name = 'Cafe Prueba 2' where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select updated_at from public.merchants where id = '00000000-0000-0000-0000-0000000000b1'),
  '2026-01-01 12:00:00-06'::timestamptz,
  'updated_at changes on update via trigger'
);

select * from finish();
rollback;
