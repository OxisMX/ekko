begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- local_today across midnight in America/Mexico_City (basis for TC-047/TC-048)
set local app.fake_now = '2026-10-20 23:59:00-06';
select is(app.local_today(), '2026-10-20'::date, '23:59 local is still 2026-10-20');
select is(app.local_now(), '2026-10-20 23:59:00'::timestamp, 'local_now is Mexico City wall-clock time');
set local app.fake_now = '2026-10-21 00:01:00-06';
select is(app.local_today(), '2026-10-21'::date, '00:01 local is already 2026-10-21');
set local app.fake_now = '2026-10-20 06:30:00+00';
select is(app.local_today(), '2026-10-20'::date, '06:30 UTC on Oct 20 is local Oct 20');
set local app.fake_now = '2026-10-21 05:30:00+00';
select is(app.local_today(), '2026-10-20'::date, '05:30 UTC on Oct 21 is still local Oct 20 (same local day)');
set local app.fake_now = '';

-- app.raise: the §3.1 contract
select throws_ok($$ select app.raise('E-04', '{"next_available_on":"2026-10-21"}') $$, 'P0001', 'E-04', 'raise uses P0001 and code as message');
create function pg_temp.raised_detail() returns text language plpgsql as $$
declare d text;
begin
  perform app.raise('E-04', '{"next_available_on":"2026-10-21"}');
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return d;
end $$;
select is(pg_temp.raised_detail()::jsonb, '{"next_available_on":"2026-10-21"}'::jsonb, 'raise puts the jsonb detail in DETAIL');
select throws_ok($$ select app.raise('E-99') $$, 'P0001', 'E-99', 'raise works without detail');

-- is_email_verified
select ok(app.is_email_verified(row(null, null, null, null, null, null, 'google', 'active', null, null, null, null, true)::public.customers), 'google counts as verified');
select ok(app.is_email_verified(row(null, null, null, null, null, null, 'apple', 'active', null, null, null, null, true)::public.customers), 'apple counts as verified');
select ok(not app.is_email_verified(row(null, null, null, null, null, null, 'email', 'active', null, null, null, null, true)::public.customers), 'email without email_verified_at is not verified');
select ok(app.is_email_verified(row(null, null, null, null, null, '2026-01-01', 'email', 'active', null, null, null, null, true)::public.customers), 'email with email_verified_at is verified');

-- peppered_hash (TC-195); the test does not depend on seed.sql for the pepper
select vault.create_secret('test-pepper', 'hash_pepper')
where not exists (select 1 from vault.secrets where name = 'hash_pepper');
select isnt(app.peppered_hash('device-1'), sha256(convert_to('device-1', 'UTF8')), 'peppered_hash differs from plain sha256');
select is(app.peppered_hash('device-1'), app.peppered_hash('device-1'), 'peppered_hash is deterministic');
select is(length(app.peppered_hash('device-1')), 32, 'peppered_hash is a 32-byte sha256');

-- random_code (TC-110)
create temp table codes as select app.random_code()::text as c from generate_series(1, 10000);
select is_empty($$ select c from codes where c !~ '^[2-9A-HJKMNP-Z]{6}$' $$, '10,000 codes use only the 31-symbol alphabet and length 6');
select is((select count(distinct s) from codes, regexp_split_to_table(c, '') s)::int, 31, 'all 31 symbols appear');
select is(pg_typeof(app.random_code())::text, 'character', 'random_code returns char(6)');
select is((select provolatile from pg_proc where oid = 'app.random_code()'::regprocedure)::text, 'v', 'random_code is VOLATILE');

-- current_customer / current_merchant (claims simulated; app.* is only reachable through SECURITY DEFINER RPCs)
set local request.jwt.claims = '';
select throws_ok($$ select app.current_customer() $$, 'P0001', 'E-18', 'current_customer without claims raises E-18');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated","app_metadata":{"role":"merchant","merchant_id":"00000000-0000-0000-0000-00000000e101"}}';
select throws_ok($$ select app.current_customer() $$, 'P0001', 'E-19', 'current_customer with a merchant JWT raises E-19');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated","app_metadata":{"role":"customer"}}';
select throws_ok($$ select app.current_merchant() $$, 'P0001', 'E-19', 'current_merchant with a customer JWT raises E-19');

-- happy path for current_customer and require_active_merchant (E-05)
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000e002');
select is((app.current_customer()).auth_user_id, '00000000-0000-0000-0000-00000000e002'::uuid, 'current_customer returns the active customer row');
insert into auth.users (id, raw_app_meta_data) values ('00000000-0000-0000-0000-00000000e001', '{"role":"merchant"}');
insert into public.merchants (
  id, auth_user_id, name, category, description, address, logo_path, cover_path,
  maps_url, reviews_url, subscription_status, billing_period, paid_until, is_active
) values (
  '00000000-0000-0000-0000-00000000e101', '00000000-0000-0000-0000-00000000e001',
  'Fn Test', 'otros', 'd', 'a', 'l', 'c', 'm', 'r', 'inactive', 'annual', '2030-01-01', false
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated","app_metadata":{"role":"merchant","merchant_id":"00000000-0000-0000-0000-00000000e101"}}';
select throws_ok($$ select app.require_active_merchant() $$, 'P0001', 'E-05', 'require_active_merchant raises E-05 for an inactive merchant');

delete from vault.secrets where name = 'hash_pepper';
select throws_ok($$ select app.peppered_hash('x') $$, 'P0001', 'E-99', 'peppered_hash raises E-99 when the pepper is missing');

select * from finish();
rollback;
