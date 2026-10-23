begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

set local app.fake_now = '2026-10-20 12:00:00-06';

-- Google user (names in metadata), Apple user (no names), email customer later linked to Google,
-- merchant that later signs in with Google (identity linked, no new auth.users row).
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000f0001', 'goo@ekko.test', '{"provider":"google","providers":["google"]}',
    '{"full_name":"Gabi Mora Ruiz","given_name":"Gabi","family_name":"Mora Ruiz","email_verified":true}'),
  ('00000000-0000-0000-0000-0000000f0002', 'app@ekko.test', '{"provider":"apple","providers":["apple"]}', '{}'),
  ('00000000-0000-0000-0000-0000000f0003', 'mail@ekko.test', '{"provider":"email"}', '{"full_name":"Spoof Name"}'),
  ('00000000-0000-0000-0000-0000000f0004', 'shop@ekko.test', '{"role":"merchant","provider":"email"}', '{}');
insert into auth.identities (id, user_id, provider, provider_id, identity_data) values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000f0001', 'google', 'g1', '{"sub":"g1"}'),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000f0003', 'google', 'g3', '{"sub":"g3"}'),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000f0004', 'google', 'g4', '{"sub":"g4"}');

select is((select raw_app_meta_data ->> 'role' from auth.users where id = '00000000-0000-0000-0000-0000000f0001'), 'customer', 'google user gets role customer');
select is(
  (select array[first_name, last_name, auth_provider] from public.customers where auth_user_id = '00000000-0000-0000-0000-0000000f0001'),
  array['Gabi', 'Mora Ruiz', 'google'], 'google customer: names prefilled from metadata');
select is((select birth_date from public.customers where auth_user_id = '00000000-0000-0000-0000-0000000f0001'), null, 'google customer: birth_date null');
select is(
  (select array[first_name, last_name] from public.customers where auth_user_id = '00000000-0000-0000-0000-0000000f0002'),
  array[null, null]::text[], 'apple customer without names: names null');
select is(
  (select first_name from public.customers where auth_user_id = '00000000-0000-0000-0000-0000000f0003'),
  null, 'email signup: metadata names are not prefilled');
select is((select count(*)::int from public.customers where auth_user_id = '00000000-0000-0000-0000-0000000f0004'), 0, 'merchant with google identity: no customer row');

set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f0001","role":"authenticated","app_metadata":{"role":"customer"}}';
select is(
  public.get_my_profile() - 'email',
  '{"first_name":"Gabi","last_name":"Mora Ruiz","birth_date":null,"auth_provider":"google","email_verified":true,"profile_complete":false,"avatar_path":null,"push_opt_in":true}'::jsonb,
  'google customer: verified (RN-05) but profile incomplete');
select throws_ok($$ select public.complete_profile('Gabi', 'Mora Ruiz', '2015-01-01') $$, 'P0001', 'E-07', 'under 18 -> E-07');
select is(public.complete_profile('Gabi', 'Mora Ruiz', '2000-01-01'), '{"profile_complete": true}'::jsonb, 'complete_profile with 18+ date');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f0002","role":"authenticated","app_metadata":{"role":"customer"}}';
select is((public.get_my_profile() ->> 'email_verified')::boolean, true, 'apple customer is verified');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f0003","role":"authenticated","app_metadata":{"role":"customer"}}';
select is((public.get_my_profile() ->> 'email_verified')::boolean, true, 'email customer that links google becomes verified');
select throws_ok($$ select public.get_merchant_session() $$, 'P0001', 'E-19', 'social customer cannot call panel RPCs');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000f0004","role":"authenticated","app_metadata":{"role":"merchant"}}';
select throws_ok($$ select public.get_my_profile() $$, 'P0001', 'E-19', 'merchant signed in with google: customer RPCs raise E-19');

select * from finish();
rollback;
