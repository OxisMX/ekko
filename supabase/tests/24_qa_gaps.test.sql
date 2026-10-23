begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- S14: QA plan cases that no other file covered (see the coverage matrix in docs/ekko_plan_qa.md).
-- Relies on supabase/seed.sql: C1 active, C3 inactive with an active coupon for U4, U3 birthday in the
-- seed month, U1/U3/U4 related to C1.
create function pg_temp.customer(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', sub, 'role', 'authenticated', 'app_metadata', '{"role":"customer"}'::jsonb)::text, true);
$$;
create function pg_temp.merchant(n text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '10000000-0000-0000-0000-0000000000' || n, 'role', 'authenticated',
    'session_id', 'aaaaaaaa-0000-0000-0000-0000000000' || n,
    'app_metadata', jsonb_build_object('role', 'merchant', 'merchant_id', '20000000-0000-0000-0000-0000000000' || n))::text, true);
$$;
create function pg_temp.exec(p_sql text) returns void language plpgsql security definer as $$
begin execute p_sql; end $$;
create function pg_temp.coupon_code(p_user text, p_merchant text) returns text language sql security definer as $$
  select c.code::text from public.coupons c join public.customers cu on cu.id = c.customer_id
  where cu.auth_user_id = ('10000000-0000-0000-0000-0000000000' || p_user)::uuid
    and c.merchant_id = ('20000000-0000-0000-0000-0000000000' || p_merchant)::uuid and c.source = 'card_reward';
$$;

-- RQ-2: app.fake_codes lists the codes returned one per call, then the generator is random again.
select setval('app.fake_code_seq', 1, false);
set local app.fake_codes = 'ABCDEF,GHJKMN';
select is(app.random_code()::text, 'ABCDEF', 'RQ-2 first seeded code');
select is(app.random_code()::text, 'GHJKMN', 'RQ-2 second seeded code');
select matches(app.random_code()::text, '^[2-9A-HJKMNP-Z]{6}$', 'RQ-2 queue exhausted: random code again');

-- TC-111: a collision within the merchant regenerates the code instead of failing.
set local app.fake_now = '2027-05-10 12:00:00-06';
update public.customers set birth_date = '1992-05-20' where auth_user_id = '10000000-0000-0000-0000-0000000000a3';
insert into public.coupons (customer_id, merchant_id, source, birthday_year, title, description, code, expires_at)
select id, '20000000-0000-0000-0000-0000000000c1', 'birthday', 1999, 't', 'd', 'AAAAAA', app.now() + interval '1 day'
from public.customers where auth_user_id = '10000000-0000-0000-0000-0000000000a1';
select setval('app.fake_code_seq', 1, false);
set local app.fake_codes = 'AAAAAA,BBBBBB';
set local role authenticated;
select pg_temp.customer('10000000-0000-0000-0000-0000000000a3');
select is(public.ensure_birthday_coupons(), '{"created":1}'::jsonb, 'TC-111 the colliding code is skipped and a new one is used');
reset role;
select is((select cp.code::text from public.coupons cp join public.customers c on c.id = cp.customer_id
  where c.auth_user_id = '10000000-0000-0000-0000-0000000000a3' and cp.source = 'birthday'), 'BBBBBB', 'TC-111 the regenerated code was stored');
set local app.fake_codes = '';

-- TC-134: a 29 February birthday in a non-leap year still gets the February coupon.
set local app.fake_now = '2029-02-10 12:00:00-06';
update public.customers set birth_date = '2000-02-29' where auth_user_id = '10000000-0000-0000-0000-0000000000a3';
set local role authenticated;
select pg_temp.customer('10000000-0000-0000-0000-0000000000a3');
select is(public.ensure_birthday_coupons(), '{"created":1}'::jsonb, 'TC-134 29 February birthday, non-leap year');
select is(public.ensure_birthday_coupons(), '{"created":0}'::jsonb, 'TC-131 a second opening in the month creates nothing');
reset role;
set local app.fake_now = '';

-- TC-097 / TC-200 / TC-202: API roles have no table access to private data or to other tenants' rows.
set local role authenticated;
select pg_temp.customer('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select * from private.wheel_prizes $$, '42501', null, 'TC-097 customer cannot read private.wheel_prizes');
select throws_ok($$ select * from public.customers $$, '42501', null, 'TC-200 customer cannot query customers directly');
select throws_ok($$ select * from public.stamps $$, '42501', null, 'TC-200 customer cannot query stamps directly');
select throws_ok($$ select * from public.card_cycles $$, '42501', null, 'TC-200 customer cannot query card_cycles directly');
select pg_temp.merchant('c1');
select throws_ok($$ select * from public.customers $$, '42501', null, 'TC-202 merchant cannot read customers');
select throws_ok($$ select * from public.stamps $$, '42501', null, 'TC-202 merchant cannot read stamps');
select throws_ok($$ select * from public.coupons $$, '42501', null, 'TC-202 merchant cannot read coupons');
select throws_ok($$ select * from public.push_campaigns $$, '42501', null, 'TC-200 merchant cannot query push_campaigns directly');
reset role;

-- TC-181 / TC-121: an inactive merchant still validates and redeems its coupons (RN-71).
select pg_temp.exec(format($$ set local app.test_code = %L $$, pg_temp.coupon_code('a4', 'c3')));
set local role authenticated;
select pg_temp.merchant('c3');
select is(public.lookup_redemption(current_setting('app.test_code')) ->> 'ok', 'true', 'TC-181 inactive merchant can look up a redemption');
select set_config('app.test_coupon', public.lookup_redemption(current_setting('app.test_code')) ->> 'coupon_id', true) is null;
select isnt(public.confirm_redemption(current_setting('app.test_coupon')::uuid) ->> 'redeemed_at', null,
  'TC-121 inactive merchant can confirm a redemption');
select isnt(public.confirm_redemption(current_setting('app.test_coupon')::uuid) ->> 'redeemed_at', null,
  'TC-120 the same till retrying within 60 s gets the original answer');
select set_config('request.jwt.claims', jsonb_build_object('sub', '10000000-0000-0000-0000-0000000000c3', 'role', 'authenticated',
  'session_id', 'bbbbbbbb-0000-0000-0000-0000000000c3',
  'app_metadata', jsonb_build_object('role', 'merchant', 'merchant_id', '20000000-0000-0000-0000-0000000000c3'))::text, true);
select throws_ok($$ select public.confirm_redemption(current_setting('app.test_coupon')::uuid) $$,
  'P0001', 'E-11', 'TC-120 another tablet confirming within 60 s gets E-11');

-- TC-180: unlock_admin is allowed while inactive by design (backend §unlock_admin); every write RPC then
-- rejects with E-05. Deviation from the QA plan wording, recorded in its appendix.
select is(public.unlock_admin('1234') ->> 'ok', 'true', 'TC-180 inactive merchant can unlock (documented)');
select throws_ok($$ select public.upsert_menu_category(null, 'Nueva', null) $$, 'P0001', 'E-05', 'TC-180 ...but cannot edit the menu (E-05)');
reset role;

-- TC-183: reactivation leaves stamps, cycles and coupons intact.
create temp table before_toggle as
select (select count(*) from public.stamps) as stamps, (select count(*) from public.card_cycles) as cycles, (select count(*) from public.coupons) as coupons;
update public.merchants set is_active = false where id = '20000000-0000-0000-0000-0000000000c1';
update public.merchants set is_active = true where id = '20000000-0000-0000-0000-0000000000c1';
select results_eq(
  $$ select (select count(*) from public.stamps), (select count(*) from public.card_cycles), (select count(*) from public.coupons) $$,
  $$ select stamps, cycles, coupons from before_toggle $$,
  'TC-183 deactivate + reactivate keeps stamps, cycles and coupons'
);

select * from finish();
rollback;
