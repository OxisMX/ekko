begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- Relies on supabase/seed.sql: U3 birthday in the seed's local month (day 1), relations with C1
-- (birthday benefit) and C2 (none). U4 has C1 and the inactive C3. U1 has C1, birthday in March.
create function pg_temp.login(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', sub, 'role', 'authenticated', 'app_metadata', '{"role":"customer"}'::jsonb)::text, true);
$$;
create function pg_temp.set_clock(p_at timestamptz) returns void language sql security definer as $$
  select set_config('app.fake_now', p_at::text, true);
$$;
create function pg_temp.birthdays(p_auth uuid) returns setof public.coupons language sql security definer as $$
  select cp.* from public.coupons cp join public.customers c on c.id = cp.customer_id
  where c.auth_user_id = p_auth and cp.source = 'birthday';
$$;
create function pg_temp.set_birth(p_auth uuid, p_date date) returns void language sql security definer as $$
  update public.customers set birth_date = p_date where auth_user_id = p_auth;
$$;
create function pg_temp.set_benefit(p_active boolean) returns void language sql security definer as $$
  update public.merchants set is_active = p_active where id = '20000000-0000-0000-0000-0000000000c1';
$$;

select pg_temp.set_clock('2027-05-10 12:00:00-06');
select pg_temp.set_birth('10000000-0000-0000-0000-0000000000a3', '1992-05-20');
select pg_temp.set_birth('10000000-0000-0000-0000-0000000000a4', '1990-05-02');
set local role authenticated;

select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(public.ensure_birthday_coupons(), '{"created":0}'::jsonb, 'wrong month: nothing');

select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select is(public.ensure_birthday_coupons(), '{"created":1}'::jsonb, 'right month: only C1 has a benefit');
select is(public.ensure_birthday_coupons(), '{"created":0}'::jsonb, 'idempotent');
select is((select (title, description, merchant_id, birthday_year, status) from pg_temp.birthdays('10000000-0000-0000-0000-0000000000a3')),
  ('Regalo de cumpleaños'::text, 'Un postre gratis en tu mes de cumpleaños'::text, '20000000-0000-0000-0000-0000000000c1'::uuid, 2027::smallint, 'active'::public.coupon_status),
  'coupon copy from birthday_benefit');
select is((select expires_at from pg_temp.birthdays('10000000-0000-0000-0000-0000000000a3')),
  '2027-05-31 23:59:59-06'::timestamptz, 'expires last second of the local month');
select matches((select code::text from pg_temp.birthdays('10000000-0000-0000-0000-0000000000a3')), '^[2-9A-HJKMNP-Z]{6}$', 'valid code');

-- Next year creates another one
reset role;
select pg_temp.set_clock('2028-05-10 12:00:00-06');
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select is(public.ensure_birthday_coupons(), '{"created":1}'::jsonb, 'next year creates a new coupon');

-- Inactive merchant: U4 has C1 and inactive C3 (no benefit either); deactivate C1 -> 0
reset role;
select pg_temp.set_benefit(false);
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a4');
select is(public.ensure_birthday_coupons(), '{"created":0}'::jsonb, 'inactive merchant: nothing');
reset role;
select pg_temp.set_benefit(true);
set local role authenticated;
select is(public.ensure_birthday_coupons(), '{"created":1}'::jsonb, 'active again: created');

-- No birth date
reset role;
select pg_temp.set_birth('10000000-0000-0000-0000-0000000000a1', null);
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(public.ensure_birthday_coupons(), '{"created":0}'::jsonb, 'no birth_date: nothing');

-- Anonymous
reset role;
set local role anon;
select throws_ok($$ select public.ensure_birthday_coupons() $$, '42501', null, 'anon cannot execute');
select * from finish();
rollback;
