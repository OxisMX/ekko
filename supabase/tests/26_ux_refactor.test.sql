begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

-- UX refactor: favorites, profile edit, merchant profile, push validity options, metric series.
-- Relies on supabase/seed.sql: C1 (PIN 1234) active with relations to U1, U3, U4; C2 active; C3 inactive.
create function pg_temp.customer(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', sub, 'role', 'authenticated', 'app_metadata', '{"role":"customer"}'::jsonb)::text, true);
$$;
create function pg_temp.as_c1() returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', '10000000-0000-0000-0000-0000000000c1', 'role', 'authenticated',
    'session_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'app_metadata', jsonb_build_object('role', 'merchant', 'merchant_id', '20000000-0000-0000-0000-0000000000c1'))::text, true);
$$;
create function pg_temp.field_of(p_sql text) returns text language plpgsql as $$
declare v_detail text;
begin execute p_sql; return null;
exception when others then get stacked diagnostics v_detail = pg_exception_detail; return (v_detail::jsonb) ->> 'field'; end $$;
create function pg_temp.seed_object(p_bucket text, p_name text) returns void language sql security definer as $$
  insert into storage.objects (bucket_id, name) values (p_bucket, p_name);
$$;
create function pg_temp.prof(p_first text, p_last text, p_avatar text default null, p_push boolean default true)
returns jsonb language sql as $$ select public.update_profile(p_first, p_last, p_avatar, p_push); $$;
create function pg_temp.mprof(p_maps text default 'https://maps.example/new', p_logo text default 'merchants/c1/logo')
returns jsonb language sql as $$
  select public.update_merchant_profile('  Café Nuevo ', 'cafeterias_postres', 'Descripción nueva.', p_maps, 'https://reviews.example/new', p_logo, 'merchants/c1/cover');
$$;
create function pg_temp.customer_id(p_auth_user text) returns uuid language sql security definer as $$
  select id from public.customers where auth_user_id = p_auth_user::uuid;
$$;

create function pg_temp.email_of(p_user text) returns text language sql security definer as $$
  select email::text from auth.users where id = p_user::uuid;
$$;

select set_config('app.fake_now', '2027-05-10 12:00:00-06', true);

-- Privileges
select ok(not has_function_privilege('anon', 'public.toggle_favorite(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_profile(text,text,text,boolean)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_merchant_profile()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_metrics_series(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_metrics_series(text)', 'EXECUTE'), 'privileges');
select ok(not has_table_privilege('authenticated', 'public.customer_favorites', 'SELECT')
  and not has_table_privilege('anon', 'public.customer_favorites', 'SELECT'), 'favorites table has no direct access');

set local role authenticated;

-- Favorites
select pg_temp.customer('10000000-0000-0000-0000-0000000000a1');
select is(public.toggle_favorite('20000000-0000-0000-0000-0000000000c2'), '{"is_favorite": true}'::jsonb, 'toggle on');
select is(public.list_merchants('alpha') -> 'items' -> 0 ->> 'id', '20000000-0000-0000-0000-0000000000c2', 'favorite comes first');
select is(public.list_merchants('alpha') -> 'items' -> 0 -> 'is_favorite', 'true'::jsonb, 'first item is flagged');
select is((select count(*) from jsonb_array_elements(public.list_merchants('alpha') -> 'items') e where (e -> 'is_favorite')::boolean), 1::bigint, 'only one favorite flagged');
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c2') -> 'merchant' -> 'is_favorite', 'true'::jsonb, 'detail carries is_favorite');
select pg_temp.customer('10000000-0000-0000-0000-0000000000a2');
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c2') -> 'merchant' -> 'is_favorite', 'false'::jsonb, 'favorites are per customer');
select pg_temp.customer('10000000-0000-0000-0000-0000000000a1');
select is(public.toggle_favorite('20000000-0000-0000-0000-0000000000c2'), '{"is_favorite": false}'::jsonb, 'toggle off');
select is((select count(*) from jsonb_array_elements(public.list_merchants('alpha') -> 'items') e where (e -> 'is_favorite')::boolean), 0::bigint, 'no favorites after toggle off');
select throws_ok($$ select public.toggle_favorite('20000000-0000-0000-0000-0000000000c3') $$, 'P0001', 'E-05', 'inactive merchant cannot be favorited');
select throws_ok($$ select public.toggle_favorite(gen_random_uuid()) $$, 'P0001', 'E-05', 'unknown merchant');
select pg_temp.as_c1();
select throws_ok($$ select public.toggle_favorite('20000000-0000-0000-0000-0000000000c2') $$, 'P0001', 'E-19', 'merchant cannot toggle favorites');

-- Customer profile
select pg_temp.customer('10000000-0000-0000-0000-0000000000a1');
select is(pg_temp.prof('  Anita ', 'Uno', null, false) - 'email', jsonb_build_object(
  'first_name', 'Anita', 'last_name', 'Uno', 'birth_date', '1995-03-14', 'auth_provider', 'email', 'email_verified', true,
  'profile_complete', true, 'avatar_path', null, 'push_opt_in', false), 'update_profile saves names and push_opt_in, birth_date untouched');
select is(public.get_my_profile() ->> 'email', pg_temp.email_of('10000000-0000-0000-0000-0000000000a1'), 'email untouched');
select is(pg_temp.field_of($$ select pg_temp.prof('A', 'Uno') $$), 'first_name', 'first name too short');
select is(pg_temp.field_of($$ select pg_temp.prof('Ana', repeat('x', 51)) $$), 'last_name', 'last name too long');
select is(pg_temp.field_of($$ select pg_temp.prof('Ana', 'Uno', '10000000-0000-0000-0000-0000000000a2/x.png') $$), 'avatar_path', 'avatar in another user folder');
select is(pg_temp.field_of($$ select pg_temp.prof('Ana', 'Uno', '10000000-0000-0000-0000-0000000000a1/ghost.png') $$), 'avatar_path', 'avatar without uploaded object');
reset role;
select pg_temp.seed_object('customer-avatars', '10000000-0000-0000-0000-0000000000a1/me.png');
set local role authenticated;
select pg_temp.customer('10000000-0000-0000-0000-0000000000a1');
select is(pg_temp.prof('Ana', 'Uno', '10000000-0000-0000-0000-0000000000a1/me.png') ->> 'avatar_path', '10000000-0000-0000-0000-0000000000a1/me.png', 'own avatar accepted');
select is(pg_temp.prof('Ana', 'Uno', null) -> 'avatar_path', 'null'::jsonb, 'avatar can be removed');
select is(pg_temp.field_of($$ select public.update_profile('Ana', 'Uno', null, null) $$), 'push_opt_in', 'push_opt_in is required');

-- Merchant profile
select pg_temp.customer('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.get_merchant_profile() $$, 'P0001', 'E-19', 'customer cannot read merchant profile');
select pg_temp.as_c1();
select throws_ok($$ select public.get_merchant_profile() $$, 'P0001', 'E-16', 'get requires admin session');
select throws_ok($$ select pg_temp.mprof() $$, 'P0001', 'E-16', 'update requires admin session');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock');
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_merchant_profile()) k),
  array['category', 'cover_path', 'description', 'logo_path', 'maps_url', 'name', 'reviews_url'], 'profile shape');
select is(pg_temp.field_of($$ select pg_temp.mprof('http://maps.example/x') $$), 'maps_url', 'non-https url rejected');
select is(pg_temp.field_of($$ select pg_temp.mprof('https://' || repeat('a', 500)) $$), 'maps_url', 'url over 500 chars rejected');
select is(pg_temp.field_of($$ select pg_temp.mprof(p_logo => 'merchants/20000000-0000-0000-0000-0000000000c1/brand/ghost') $$), 'logo_path', 'logo without uploaded object');
reset role;
select pg_temp.seed_object('merchant-media', 'merchants/20000000-0000-0000-0000-0000000000c1/brand/lg_540.webp');
set local role authenticated;
select pg_temp.as_c1();
select is(pg_temp.mprof(p_logo => 'merchants/20000000-0000-0000-0000-0000000000c1/brand/lg') ->> 'logo_path', 'merchants/20000000-0000-0000-0000-0000000000c1/brand/lg', 'uploaded logo accepted');
select is(public.get_merchant_profile() ->> 'name', 'Café Nuevo', 'name trimmed and saved');

-- Push validity options and custom stamp
select is(public.update_card_config(6::smallint, 6::smallint, 'P', 'D', 'T', null, 6::smallint, null) ->> 'push_coupon_validity_hours', '6', 'validity 6 accepted');
select is(pg_temp.field_of($$ select public.update_card_config(6::smallint, 6::smallint, 'P', 'D', 'T', null, 30::smallint, null) $$), 'push_coupon_validity_hours', 'validity 30 rejected');
select is(pg_temp.field_of($$ select public.update_card_config(6::smallint, 6::smallint, 'P', 'D', 'T', null, 24::smallint, 'merchants/20000000-0000-0000-0000-0000000000c1/card/ghost') $$), 'stamp_image_path', 'stamp image must exist');

-- Metric series
select is(pg_temp.field_of($$ select public.get_metrics_series('7d') $$), 'range', 'invalid range');
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_metrics_series('30d')) k), array['active_customers', 'coupons', 'visits'], 'series shape');
select is((jsonb_array_length(public.get_metrics_series('30d') -> 'visits'), jsonb_array_length(public.get_metrics_series('all') -> 'visits'),
  jsonb_array_length(public.get_metrics_series('30d') -> 'active_customers'))::text, '(30,26,12)', 'bucket counts');
select is(public.get_metrics_series('30d') -> 'visits' -> 29, '{"bucket": "2027-05-10", "count": 0}'::jsonb, 'empty buckets are zero-filled');

reset role;
insert into public.visit_qr_tokens (merchant_id, token_hash, created_at, expires_at, used_at, used_by_customer_id)
values ('20000000-0000-0000-0000-0000000000c1', '\x01', app.now(), app.now() + interval '1 minute', app.now(),
        pg_temp.customer_id('10000000-0000-0000-0000-0000000000a1'));
set local role authenticated;
select pg_temp.as_c1();
select is(public.get_metrics_series('30d') -> 'visits' -> 29, '{"bucket": "2027-05-10", "count": 1}'::jsonb, 'a visit lands in today bucket');
select is(public.get_metrics_series('all') -> 'visits' -> 25 ->> 'bucket', '2027-05-10', 'weekly bucket is the Monday of the week');
select is(public.get_metrics_series('all') -> 'active_customers' -> 11 -> 'count', '1'::jsonb, 'active customer counted in the week');

-- Push recipients: U1 opts out, U3 keeps the default.
reset role;
update public.customers set push_opt_in = false where id = pg_temp.customer_id('10000000-0000-0000-0000-0000000000a1');
insert into public.customer_devices (customer_id, device_hash, platform, expo_push_token, push_enabled)
select pg_temp.customer_id(u), convert_to(u, 'UTF8'), 'android', 'ExponentPushToken[' || right(u, 2) || ']', true
from unnest(array['10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a3']) u;
create temp table campaign as
select (public.create_push_campaign('20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001',
  jsonb_build_object('idempotency_key', '00000000-0000-0000-0000-000000000001', 'title', 'Hola', 'body', 'Hoy 2x1.',
    'coupon', jsonb_build_object('title', 't', 'description', 'd', 'terms', 't', 'validity_hours', 6))) ->> 'campaign_id')::uuid as id;
select is((select array_agg(customer_id) from public.get_push_recipients((select id from campaign))),
  array[pg_temp.customer_id('10000000-0000-0000-0000-0000000000a3')], 'push_opt_in = false is excluded from the push');
select is(pg_temp.field_of($$ select public.create_push_campaign('20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001',
  jsonb_build_object('idempotency_key', '00000000-0000-0000-0000-000000000002', 'title', 'Hola', 'body', 'x',
    'coupon', jsonb_build_object('title', 't', 'description', 'd', 'terms', 't', 'validity_hours', 30))) $$), 'coupon_validity_hours', 'campaign validity 30 rejected');

select * from finish();
rollback;
