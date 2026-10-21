begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- TC-010: public signup can only write user_metadata; a "role: merchant" there is ignored
insert into auth.users (id, raw_app_meta_data, raw_user_meta_data) values (
  '00000000-0000-0000-0000-00000000d001',
  '{"provider":"email","providers":["email"]}',
  '{"role":"merchant"}'
);
select is(
  (select raw_app_meta_data ->> 'role' from auth.users where id = '00000000-0000-0000-0000-00000000d001'),
  'customer', 'TC-010: public signup gets app_metadata.role = customer'
);
select is(
  (select auth_provider from public.customers where auth_user_id = '00000000-0000-0000-0000-00000000d001'),
  'email', 'TC-010: public signup creates a customers row with the provider'
);
select ok(
  (select first_name is null and birth_date is null and email_verified_at is null
   from public.customers where auth_user_id = '00000000-0000-0000-0000-00000000d001'),
  'new customer starts with an empty profile and unverified email'
);

-- Google signup records its provider
insert into auth.users (id, raw_app_meta_data) values (
  '00000000-0000-0000-0000-00000000d003', '{"provider":"google","providers":["google"]}'
);
select is(
  (select auth_provider from public.customers where auth_user_id = '00000000-0000-0000-0000-00000000d003'),
  'google', 'OAuth signup stores auth_provider from app_metadata.provider'
);

-- Admin-created merchant (service_role sets app_metadata)
insert into auth.users (id, raw_app_meta_data) values (
  '00000000-0000-0000-0000-00000000d002', '{"provider":"email","providers":["email"],"role":"merchant"}'
);
select is_empty(
  $$ select 1 from public.customers where auth_user_id = '00000000-0000-0000-0000-00000000d002' $$,
  'an admin-created merchant gets no customers row'
);
select is(
  (select raw_app_meta_data ->> 'role' from auth.users where id = '00000000-0000-0000-0000-00000000d002'),
  'merchant', 'an admin-created merchant keeps role = merchant'
);

-- ADR-14 contract on the GoTrue internal table
select has_column('auth', 'mfa_amr_claims', 'session_id', 'contract: auth.mfa_amr_claims.session_id exists');
select has_column('auth', 'mfa_amr_claims', 'authentication_method', 'contract: auth.mfa_amr_claims.authentication_method exists');

-- ADR-14: password login does not verify, OTP does (TC-015)
insert into auth.sessions (id, user_id) values
  ('00000000-0000-0000-0000-00000000d101', '00000000-0000-0000-0000-00000000d001'),
  ('00000000-0000-0000-0000-00000000d102', '00000000-0000-0000-0000-00000000d001');
insert into auth.mfa_amr_claims (id, session_id, created_at, updated_at, authentication_method)
values (gen_random_uuid(), '00000000-0000-0000-0000-00000000d101', now(), now(), 'password');
select is(
  (select email_verified_at from public.customers where auth_user_id = '00000000-0000-0000-0000-00000000d001'),
  null, 'ADR-14: a password session does not set email_verified_at'
);
set local app.fake_now = '2026-10-20 12:00:00-06';
insert into auth.mfa_amr_claims (id, session_id, created_at, updated_at, authentication_method)
values (gen_random_uuid(), '00000000-0000-0000-0000-00000000d102', now(), now(), 'otp');
select is(
  (select email_verified_at from public.customers where auth_user_id = '00000000-0000-0000-0000-00000000d001'),
  '2026-10-20 12:00:00-06'::timestamptz, 'ADR-14 / TC-015: an OTP session sets email_verified_at'
);

select * from finish();
rollback;
