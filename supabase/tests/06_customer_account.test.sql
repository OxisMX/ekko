begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- Returns the DETAIL of the error raised by `sql` (null if it does not raise). throws_ok only
-- checks errcode and message; the E-23 contract also carries {"field": ...} in details.
create function pg_temp.error_detail(sql text) returns jsonb language plpgsql as $$
declare v_detail text;
begin
  execute sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return nullif(v_detail, '')::jsonb;
end;
$$;

-- Fixtures
set local app.fake_now = '2026-10-20 12:00:00-06';
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000e001', 'ana@ekko.test', '{"provider":"email"}'),
  ('00000000-0000-0000-0000-00000000e002', 'gus@ekko.test', '{"provider":"google"}'),
  ('00000000-0000-0000-0000-00000000e003', 'teen@ekko.test', '{"provider":"email"}'),
  ('00000000-0000-0000-0000-00000000e004', 'm@ekko.test', '{"role":"merchant"}');

-- Privileges
select ok(not has_function_privilege('anon', 'public.complete_profile(text, text, date)', 'EXECUTE'), 'anon cannot execute complete_profile');
select ok(not has_function_privilege('anon', 'public.get_my_profile()', 'EXECUTE'), 'anon cannot execute get_my_profile');
select ok(not has_function_privilege('anon', 'public.register_device(text, public.device_platform, text, boolean)', 'EXECUTE'), 'anon cannot execute register_device');
select ok(has_function_privilege('authenticated', 'public.complete_profile(text, text, date)', 'EXECUTE'), 'authenticated can execute complete_profile');
select ok(has_function_privilege('authenticated', 'public.get_my_profile()', 'EXECUTE'), 'authenticated can execute get_my_profile');
select ok(has_function_privilege('authenticated', 'public.register_device(text, public.device_platform, text, boolean)', 'EXECUTE'), 'authenticated can execute register_device');

set local role authenticated;

-- Merchant JWT -> E-19 on all three
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e004","role":"authenticated","app_metadata":{"role":"merchant"}}';
select throws_ok($$ select public.complete_profile('Ana', 'Ruiz', '2000-01-01') $$, 'P0001', 'E-19', 'merchant JWT: complete_profile raises E-19');
select throws_ok($$ select public.get_my_profile() $$, 'P0001', 'E-19', 'merchant JWT: get_my_profile raises E-19');
select throws_ok($$ select public.register_device(repeat('a', 64), 'ios') $$, 'P0001', 'E-19', 'merchant JWT: register_device raises E-19');

-- Email customer, empty profile
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e001","role":"authenticated","app_metadata":{"role":"customer"}}';
select is(
  public.get_my_profile(),
  '{"first_name":null,"last_name":null,"birth_date":null,"email":"ana@ekko.test","auth_provider":"email","email_verified":false,"profile_complete":false,"avatar_path":null,"push_opt_in":false}'::jsonb,
  'get_my_profile: new email customer has an incomplete, unverified profile'
);

-- Name validation (E-23 with field)
select throws_ok($$ select public.complete_profile(' A ', 'Ruiz', '2000-01-01') $$, 'P0001', 'E-23', 'first_name of 1 char after trim raises E-23');
select is(pg_temp.error_detail($$ select public.complete_profile(' A ', 'Ruiz', '2000-01-01') $$), '{"field":"first_name"}'::jsonb, 'short first_name reports field first_name');
select is(pg_temp.error_detail($$ select public.complete_profile(repeat('a', 51), 'Ruiz', '2000-01-01') $$), '{"field":"first_name"}'::jsonb, '51-char first_name reports field first_name');
select is(pg_temp.error_detail($$ select public.complete_profile(null, 'Ruiz', '2000-01-01') $$), '{"field":"first_name"}'::jsonb, 'null first_name reports field first_name');
select is(pg_temp.error_detail($$ select public.complete_profile('Ana', '   ', '2000-01-01') $$), '{"field":"last_name"}'::jsonb, 'blank last_name reports field last_name');
select is(pg_temp.error_detail($$ select public.complete_profile('Ana', repeat('b', 51), '2000-01-01') $$), '{"field":"last_name"}'::jsonb, '51-char last_name reports field last_name');
select is(pg_temp.error_detail($$ select public.complete_profile('Ana', 'Ruiz', null) $$), '{"field":"birth_date"}'::jsonb, 'null birth_date on an empty profile reports field birth_date');

-- TC-003: turns 18 tomorrow (local date 2026-10-20)
select throws_ok($$ select public.complete_profile('Ana', 'Ruiz', '2008-10-21') $$, 'P0001', 'E-07', 'TC-003: turning 18 tomorrow raises E-07');
-- Local date, not UTC: 2026-10-21 03:00 UTC is still 2026-10-20 in Mexico City
set local app.fake_now = '2026-10-21 03:00:00+00';
select throws_ok($$ select public.complete_profile('Ana', 'Ruiz', '2008-10-21') $$, 'P0001', 'E-07', 'TC-003: age uses the Mexico City date, not UTC');
set local app.fake_now = '2026-10-20 12:00:00-06';

-- TC-002: turns 18 today; names are trimmed (exactly 2 and 50 chars are valid)
select is(public.complete_profile('  An  ', '  ' || repeat('r', 50) || ' ', '2008-10-20'), '{"profile_complete":true}'::jsonb, 'TC-002: turning 18 today is accepted');
reset role;
select is(
  (select array[first_name, last_name, birth_date::text] from public.customers where auth_user_id = '00000000-0000-0000-0000-00000000e001'),
  array['An', repeat('r', 50), '2008-10-20'],
  'names are stored trimmed and birth_date is set'
);
set local role authenticated;
select is(public.get_my_profile() -> 'profile_complete', 'true'::jsonb, 'get_my_profile: profile_complete true after complete_profile');
select is(public.get_my_profile() ->> 'birth_date', '2008-10-20', 'get_my_profile returns birth_date as ISO date');

-- TC-007: birth_date immutable, names editable
select is(public.complete_profile('Daniela', 'Ruiz', '1990-01-01'), '{"profile_complete":true}'::jsonb, 'TC-007: a different birth_date is ignored silently');
reset role;
select is(
  (select array[first_name, last_name, birth_date::text] from public.customers where auth_user_id = '00000000-0000-0000-0000-00000000e001'),
  array['Daniela', 'Ruiz', '2008-10-20'],
  'TC-007: names updated, birth_date unchanged'
);
set local role authenticated;
select lives_ok($$ select public.complete_profile('Daniela', 'Ruiz', '2015-01-01') $$, 'TC-007: an ignored birth_date is not age-checked');
select lives_ok($$ select public.complete_profile('Daniela', 'Ruiz', null) $$, 'a null birth_date is fine once it is set');

-- Google customer counts as verified
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e002","role":"authenticated","app_metadata":{"role":"customer"}}';
select is(public.get_my_profile() -> 'email_verified', 'true'::jsonb, 'get_my_profile: google customer is email_verified');
select is(public.get_my_profile() ->> 'auth_provider', 'google', 'get_my_profile: auth_provider is google');

-- register_device
select is(pg_temp.error_detail($$ select public.register_device(repeat('A', 64), 'ios') $$), '{"field":"device_id_digest"}'::jsonb, 'uppercase digest reports field device_id_digest');
select throws_ok($$ select public.register_device(repeat('a', 63), 'ios') $$, 'P0001', 'E-23', '63-char digest raises E-23');
select throws_ok($$ select public.register_device(null, 'ios') $$, 'P0001', 'E-23', 'null digest raises E-23');
select is(public.register_device(repeat('a', 64), 'ios', 'ExponentPushToken[x]', true), '{"ok":true}'::jsonb, 'register_device returns ok');
set local app.fake_now = '2026-10-20 13:00:00-06';
select is(public.register_device(repeat('a', 64), 'android', null, false), '{"ok":true}'::jsonb, 'second register_device returns ok');

reset role;
select is(
  (select count(*)::int from public.customer_devices d join public.customers c on c.id = d.customer_id
   where c.auth_user_id = '00000000-0000-0000-0000-00000000e002'),
  1, 'the same device upserts into a single row'
);
select is(
  (select d.device_hash from public.customer_devices d join public.customers c on c.id = d.customer_id
   where c.auth_user_id = '00000000-0000-0000-0000-00000000e002'),
  app.peppered_hash(repeat('a', 64)), 'device_hash is the peppered hash of the digest'
);
select is(
  (select array[d.platform::text, d.expo_push_token, d.push_enabled::text, d.last_seen_at::text]
   from public.customer_devices d join public.customers c on c.id = d.customer_id
   where c.auth_user_id = '00000000-0000-0000-0000-00000000e002'),
  array['android', 'ExponentPushToken[x]', 'false', '2026-10-20 13:00:00-06'::timestamptz::text],
  'upsert updates platform, push_enabled and last_seen_at, and keeps the token on a null'
);
update public.customer_devices set signed_out_at = app.now();
set local role authenticated;
select lives_ok($$ select public.register_device(repeat('a', 64), 'ios', 'ExponentPushToken[y]', true) $$, 'third register_device after sign-out');
reset role;
select is(
  (select array[d.expo_push_token, coalesce(d.signed_out_at::text, 'null')] from public.customer_devices d where d.device_hash = app.peppered_hash(repeat('a', 64)) and d.expo_push_token is not null),
  array['ExponentPushToken[y]', 'null'], 'a new token overwrites and signed_out_at is cleared'
);

-- Another customer with the same device gets its own row
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000e003","role":"authenticated","app_metadata":{"role":"customer"}}';
select lives_ok($$ select public.register_device(repeat('a', 64), 'ios') $$, 'another customer registers the same device');
reset role;
select is((select count(*)::int from public.customer_devices where device_hash = app.peppered_hash(repeat('a', 64))), 2, 'one row per (customer, device)');

select * from finish();
rollback;
