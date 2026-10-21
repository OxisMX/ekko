begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Fixtures
set local app.fake_now = '2026-10-20 12:00:00-06';
insert into auth.users (id, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000c001', '{"role":"merchant"}'),
  ('00000000-0000-0000-0000-00000000c002', '{}');
insert into public.merchants (
  id, auth_user_id, name, category, description, address, logo_path, cover_path,
  maps_url, reviews_url, subscription_status, billing_period, paid_until, is_active
) values (
  '00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c001',
  'Session Test', 'otros', 'd', 'a', 'logo/x', 'c', 'm', 'r', 'inactive', 'annual', '2030-01-01', false
);
insert into private.merchant_security (merchant_id, pin_hash, pin_locked_until, validator_locked_until)
values ('00000000-0000-0000-0000-00000000c101', 'x', '2026-10-20 12:05:00-06', '2026-10-20 11:00:00-06');
insert into private.merchant_admin_sessions (merchant_id, auth_session_id, expires_at) values
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c201', '2026-10-20 12:03:00-06'),
  ('00000000-0000-0000-0000-00000000c101', '00000000-0000-0000-0000-00000000c202', '2026-10-20 11:59:00-06');

-- Privileges
select ok(not has_function_privilege('anon', 'public.get_merchant_session()', 'EXECUTE'), 'anon cannot execute get_merchant_session');
select ok(has_function_privilege('authenticated', 'public.get_merchant_session()', 'EXECUTE'), 'authenticated can execute get_merchant_session');
-- Supabase grants EXECUTE on new public functions to anon by default: guard every one of them.
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE') $$,
  'anon cannot execute any function in public'
);

set local role authenticated;

-- Merchant JWT, inactive merchant still gets a session (P-12)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated","session_id":"00000000-0000-0000-0000-00000000c201","app_metadata":{"role":"merchant","merchant_id":"00000000-0000-0000-0000-00000000c101"}}';
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.get_merchant_session()) k),
  array['admin_unlocked_until', 'is_active', 'merchant', 'pin_locked_until', 'validator_locked_until'],
  'returns the documented keys'
);
select is(
  public.get_merchant_session() -> 'merchant',
  '{"id":"00000000-0000-0000-0000-00000000c101","name":"Session Test","logo_path":"logo/x"}'::jsonb,
  'merchant object has id, name and logo_path'
);
select is(public.get_merchant_session() -> 'is_active', 'false'::jsonb, 'an inactive merchant can still read its session');
select is(
  (public.get_merchant_session() ->> 'admin_unlocked_until')::timestamptz, '2026-10-20 12:03:00-06'::timestamptz,
  'admin_unlocked_until comes from the admin session of the JWT session_id'
);
select is(
  (public.get_merchant_session() ->> 'pin_locked_until')::timestamptz, '2026-10-20 12:05:00-06'::timestamptz,
  'a future pin lock is returned'
);
select is(public.get_merchant_session() -> 'validator_locked_until', 'null'::jsonb, 'a past validator lock is null');

-- Customer JWT
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000c002","role":"authenticated","app_metadata":{"role":"customer"}}';
select throws_ok($$ select public.get_merchant_session() $$, 'P0001', 'E-19', 'a customer JWT raises E-19');

select * from finish();
rollback;
