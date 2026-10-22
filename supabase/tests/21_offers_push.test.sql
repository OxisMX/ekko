begin;
create extension if not exists pgtap with schema extensions;
select plan(91);

-- Relies on supabase/seed.sql: C1 (PIN 1234) active with 2 offers and relations with U1, U3, U4;
-- C2 active; C3 inactive. U2 has no relation. No devices are seeded: this test creates them.
create function pg_temp.login(sub text, merchant_id text default null, session_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'session_id', session_id,
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end))::text, true);
$$;
create function pg_temp.as_c1() returns void language sql as $$
  select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001');
$$;
create function pg_temp.set_clock(p_at timestamptz) returns void language sql security definer as $$
  select set_config('app.fake_now', p_at::text, true);
$$;
create function pg_temp.seed_object(p_name text) returns void language sql security definer as $$
  insert into storage.objects (bucket_id, name) values ('merchant-media', p_name);
$$;
create function pg_temp.field_of(p_sql text) returns text language plpgsql as $$
declare v_detail text;
begin execute p_sql; return null;
exception when others then get stacked diagnostics v_detail = pg_exception_detail; return (v_detail::jsonb) ->> 'field'; end $$;
create function pg_temp.detail_of(p_sql text) returns jsonb language plpgsql as $$
declare v_detail text;
begin execute p_sql; return null;
exception when others then get stacked diagnostics v_detail = pg_exception_detail; return v_detail::jsonb; end $$;
create function pg_temp.customer_id(p_auth_user text) returns uuid language sql security definer as $$
  select id from public.customers where auth_user_id = p_auth_user::uuid;
$$;
create function pg_temp.add_device(p_auth_user text, p_hash text, p_token text, p_push boolean, p_signed_out boolean default false)
returns void language sql security definer as $$
  insert into public.customer_devices (customer_id, device_hash, platform, expo_push_token, push_enabled, signed_out_at)
  values (pg_temp.customer_id(p_auth_user), pg_catalog.convert_to(p_hash, 'UTF8'), 'android', p_token, p_push,
          case when p_signed_out then app.now() end);
$$;
create function pg_temp.payload(p_key text, p_coupon boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('idempotency_key', p_key, 'title', ' ¡Lunes! ', 'body', 'Hoy 2x1.')
    || case when p_coupon then jsonb_build_object('coupon', jsonb_build_object(
         'title', '2x1', 'description', 'En bebidas.', 'terms', 'Solo sucursal.', 'validity_hours', 24)) else '{}'::jsonb end;
$$;
create function pg_temp.key(n int) returns text language sql as $$
  select '00000000-0000-0000-0000-' || pg_catalog.lpad(n::text, 12, '0');
$$;
create function pg_temp.create_campaign(p_payload jsonb, p_session text default 'aaaaaaaa-0000-0000-0000-000000000001', p_merchant text default '20000000-0000-0000-0000-0000000000c1')
returns jsonb language sql as $$
  select public.create_push_campaign(p_merchant::uuid, p_session::uuid, p_payload);
$$;
create function pg_temp.field_of_campaign(p_payload jsonb) returns text language sql as $$
  select pg_temp.field_of(format('select public.create_push_campaign(%L, %L, %L)',
    '20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', p_payload));
$$;

select pg_temp.set_clock('2027-05-10 12:00:00-06');
select pg_temp.seed_object('merchants/20000000-0000-0000-0000-0000000000c1/offer/img1_540.webp');
select pg_temp.seed_object('merchants/20000000-0000-0000-0000-0000000000c1/offer/img2_540.jpg');
select pg_temp.seed_object('merchants/20000000-0000-0000-0000-0000000000c2/offer/other_540.webp');
create temp table c2_offer as
  with ins as (insert into public.weekly_offers (merchant_id, title, description, weekday, position)
    values ('20000000-0000-0000-0000-0000000000c2', 'Ajena', 'x', 1, 1) returning id) select id from ins;
grant select on c2_offer to authenticated;

-- Devices: U1 two (one signed out), U3 push off, U4 push on without token, U2 (no relation) push on.
select pg_temp.add_device('10000000-0000-0000-0000-0000000000a1', 'u1-a', 'ExponentPushToken[u1-a]', true);
select pg_temp.add_device('10000000-0000-0000-0000-0000000000a1', 'u1-b', 'ExponentPushToken[u1-b]', true);
select pg_temp.add_device('10000000-0000-0000-0000-0000000000a1', 'u1-c', 'ExponentPushToken[u1-c]', true, true);
select pg_temp.add_device('10000000-0000-0000-0000-0000000000a3', 'u3-a', 'ExponentPushToken[u3-a]', false);
select pg_temp.add_device('10000000-0000-0000-0000-0000000000a4', 'u4-a', null, true);
select pg_temp.add_device('10000000-0000-0000-0000-0000000000a2', 'u2-a', 'ExponentPushToken[u2-a]', true);

select ok(not has_function_privilege('anon', 'public.list_offers_admin()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.upsert_offer(uuid,text,text,smallint,text,smallint)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.delete_offer(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_push_status()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_push_campaigns()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.upsert_offer(uuid,text,text,smallint,text,smallint)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_push_status()', 'EXECUTE'), 'panel rpc privileges');
select ok(not has_function_privilege('anon', 'public.create_push_campaign(uuid,uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.create_push_campaign(uuid,uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.get_push_recipients(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.record_push_result(uuid,integer,integer,text[])', 'EXECUTE')
  and not has_function_privilege('anon', 'public.record_push_result(uuid,integer,integer,text[])', 'EXECUTE')
  and has_function_privilege('service_role', 'public.create_push_campaign(uuid,uuid,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_push_recipients(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.record_push_result(uuid,integer,integer,text[])', 'EXECUTE'), 'internal rpcs are service_role only');

set local role authenticated;

-- customers
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.list_offers_admin() $$, 'P0001', 'E-19', 'customer cannot list_offers_admin');
select throws_ok($$ select public.get_push_status() $$, 'P0001', 'E-19', 'customer cannot get_push_status');
select throws_ok($$ select public.list_push_campaigns() $$, 'P0001', 'E-19', 'customer cannot list_push_campaigns');
select throws_ok($$ select public.create_push_campaign('20000000-0000-0000-0000-0000000000c1', gen_random_uuid(), '{}') $$, '42501', null, 'authenticated cannot call create_push_campaign');

-- E-16 without admin session
select pg_temp.as_c1();
select throws_ok($$ select public.list_offers_admin() $$, 'P0001', 'E-16', 'list offers requires admin session');
select throws_ok($$ select public.upsert_offer(null, 'X', 'x', 1::smallint) $$, 'P0001', 'E-16', 'upsert offer requires admin session');
select throws_ok($$ select public.delete_offer(gen_random_uuid()) $$, 'P0001', 'E-16', 'delete offer requires admin session');
select throws_ok($$ select public.get_push_status() $$, 'P0001', 'E-16', 'push status requires admin session');
select throws_ok($$ select public.list_push_campaigns() $$, 'P0001', 'E-16', 'list campaigns requires admin session');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock');

-- offers: ordering, validation
select is((select array_agg(o ->> 'title' order by n) from jsonb_array_elements(public.list_offers_admin()) with ordinality t (o, n)),
  array['Lunes de latte', 'Viernes dulce'], 'list orders by weekday');
select is(public.upsert_offer(null, '  Lunes doble  ', ' Dos por uno. ', 1::smallint) - 'id',
  '{"title":"Lunes doble","description":"Dos por uno.","weekday":1,"image_path":null,"position":2}'::jsonb,
  'create trims; position is max+1 within the weekday');
select is(public.upsert_offer(null, 'Miércoles', 'Algo.', 3::smallint) ->> 'position', '1', 'first offer of another weekday starts at 1');
select is((select array_agg(o ->> 'title' order by n) from jsonb_array_elements(public.list_offers_admin()) with ordinality t (o, n)),
  array['Lunes de latte', 'Lunes doble', 'Miércoles', 'Viernes dulce'], 'list orders by weekday then position');
select is(pg_temp.field_of($$ select public.upsert_offer(null, '  ', 'x', 1::smallint) $$), 'title', 'blank title');
select is(pg_temp.field_of($$ select public.upsert_offer(null, repeat('x', 61), 'x', 1::smallint) $$), 'title', 'title too long');
select is(pg_temp.field_of($$ select public.upsert_offer(null, 'X', '  ', 1::smallint) $$), 'description', 'blank description');
select is(pg_temp.field_of($$ select public.upsert_offer(null, 'X', repeat('x', 201), 1::smallint) $$), 'description', 'description too long');
select is(pg_temp.field_of($$ select public.upsert_offer(null, 'X', 'x', 0::smallint) $$), 'weekday', 'weekday 0');
select is(pg_temp.field_of($$ select public.upsert_offer(null, 'X', 'x', 8::smallint) $$), 'weekday', 'weekday 8');
select is(pg_temp.field_of($$ select public.upsert_offer(null, 'X', 'x', null) $$), 'weekday', 'weekday null');
select is(pg_temp.field_of($$ select public.upsert_offer(null, 'X', 'x', 1::smallint, 'merchants/20000000-0000-0000-0000-0000000000c1/offer/ghost') $$), 'image_path', 'image without uploaded object');
select is(pg_temp.field_of($$ select public.upsert_offer(null, 'X', 'x', 1::smallint, 'merchants/20000000-0000-0000-0000-0000000000c2/offer/other') $$), 'image_path', 'image in another merchant folder');
select is(pg_temp.field_of($$ select public.upsert_offer(null, 'X', 'x', 1::smallint, 'merchants/20000000-0000-0000-0000-0000000000c1/product/img1') $$), 'image_path', 'image in the wrong folder');
select is(pg_temp.field_of($$ select public.upsert_offer((select id from c2_offer), 'X', 'x', 1::smallint) $$), 'id', 'cross-merchant offer update is not found');
select is(pg_temp.field_of($$ select public.delete_offer((select id from c2_offer)) $$), 'id', 'cross-merchant offer delete is not found');
select is(public.upsert_offer(null, 'Con foto', 'x', 2::smallint, 'merchants/20000000-0000-0000-0000-0000000000c1/offer/img1') ->> 'image_path',
  'merchants/20000000-0000-0000-0000-0000000000c1/offer/img1', 'uploaded image accepted');
select is(public.upsert_offer(null, 'Jpg', 'x', 2::smallint, 'merchants/20000000-0000-0000-0000-0000000000c1/offer/img2.jpg') ->> 'position', '2', 'jpg fallback accepted');
select is((select public.upsert_offer(o.id, 'Lunes editado', 'Nuevo.', 4::smallint, null, 9::smallint) - 'id'
  from public.weekly_offers o where o.title = 'Lunes doble'),
  '{"title":"Lunes editado","description":"Nuevo.","weekday":4,"image_path":null,"position":9}'::jsonb, 'update changes weekday and position');

-- customers see the offers
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select ok(exists (select 1 from jsonb_array_elements(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'offers') o
  where o ->> 'title' = 'Lunes editado' and o ->> 'weekday' = '4'), 'customer sees edited offer in merchant detail');
select pg_temp.as_c1();
select lives_ok($$ select public.delete_offer((select id from public.weekly_offers where title = 'Jpg')) $$, 'delete offer');
select is((select count(*) from public.weekly_offers where merchant_id = '20000000-0000-0000-0000-0000000000c1'), 5::bigint, 'offer removed');

-- push status
select is(public.get_push_status(),
  '{"remaining_this_month":5,"limit":5,"resets_on":"2027-06-01","recipients_count":3,"push_coupon_validity_hours":48}'::jsonb,
  'push status: 5 left, 3 recipients, resets next month');
select is(public.list_push_campaigns(), '[]'::jsonb, 'no campaigns yet');

-- internal RPCs: run as the service (postgres here), not as authenticated
reset role;
select pg_temp.as_c1();
select pg_temp.set_clock('2027-05-10 12:00:00-06');

select throws_ok($$ select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(1)), 'aaaaaaaa-0000-0000-0000-0000000000ff') $$, 'P0001', 'E-16', 'session id mismatch');
select throws_ok($$ select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(1)), 'aaaaaaaa-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000c2') $$, 'P0001', 'E-16', 'merchant mismatch (no admin session for that merchant)');
select pg_temp.set_clock('2027-05-10 12:10:00-06');
select throws_ok($$ select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(1))) $$, 'P0001', 'E-16', 'expired admin session');
select pg_temp.set_clock('2027-05-10 12:00:00-06');

-- validation
select is(pg_temp.field_of_campaign(pg_temp.payload('nope')), 'idempotency_key', 'bad idempotency key');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1)) || '{"title":"  "}'), 'title', 'blank title');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1)) || jsonb_build_object('title', repeat('x', 51))), 'title', 'title too long');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1)) || jsonb_build_object('body', repeat('x', 151))), 'body', 'body too long');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1)) - 'body'), 'body', 'missing body');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1), true) #- '{coupon,title}'), 'coupon_title', 'coupon title required');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1), true) #- '{coupon,description}'), 'coupon_description', 'coupon description required');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1), true) || jsonb_build_object('coupon', jsonb_build_object('title', 't', 'description', 'd', 'terms', repeat('x', 1001), 'validity_hours', 24))), 'coupon_terms', 'coupon terms too long');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1), true) || jsonb_build_object('coupon', jsonb_build_object('title', 't', 'description', 'd', 'terms', 't', 'validity_hours', 23))), 'coupon_validity_hours', 'validity 23h');
select is(pg_temp.field_of_campaign(pg_temp.payload(pg_temp.key(1), true) || jsonb_build_object('coupon', jsonb_build_object('title', 't', 'description', 'd', 'terms', 't', 'validity_hours', 49))), 'coupon_validity_hours', 'validity 49h');
select is((select count(*) from public.push_campaigns), 0::bigint, 'invalid payloads create nothing');

-- campaign without coupon
create temp table first_result as select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(1))) as r;
select is((select r - 'campaign_id' from first_result),
  '{"recipients":3,"duplicate":false,"status":"sending","sent":0,"failed":0,"push_remaining_this_month":4}'::jsonb,
  'campaign created (sending, 3 recipients, 4 left)');
select is((select r ->> 'campaign_id' from first_result), (select id::text from public.push_campaigns where idempotency_key = pg_temp.key(1)::uuid), 'result carries the campaign id');
select is((select title from public.push_campaigns where idempotency_key = pg_temp.key(1)::uuid), '¡Lunes!', 'title trimmed');
select is((select count(*) from public.coupons where source = 'push'), 0::bigint, 'no coupon without coupon payload');

-- campaign with coupon: one per recipient even with push disabled / no token
select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(2), true));
select is((select count(*) from public.coupons c join public.push_campaigns p on p.id = c.campaign_id where p.idempotency_key = pg_temp.key(2)::uuid), 3::bigint, 'one coupon per active-relationship customer');
select is((select count(distinct c.customer_id) from public.coupons c where c.customer_id in (pg_temp.customer_id('10000000-0000-0000-0000-0000000000a3'), pg_temp.customer_id('10000000-0000-0000-0000-0000000000a4'))), 2::bigint, 'coupons also for push-disabled customers');
select is((select count(*) from public.coupons c where c.customer_id = pg_temp.customer_id('10000000-0000-0000-0000-0000000000a2') and c.source = 'push'), 0::bigint, 'no coupon without relation');
select is((select array_agg(distinct c.title || '|' || c.description || '|' || c.terms || '|' || (c.expires_at - c.issued_at) || '|' || c.status) from public.coupons c where c.source = 'push'),
  array['2x1|En bebidas.|Solo sucursal.|1 day|active'], 'coupon fields, 24h validity');
select is((select has_coupon from public.push_campaigns where idempotency_key = pg_temp.key(2)::uuid), true, 'has_coupon stored');

-- idempotency: same key returns the stored campaign, no new coupons, no quota use
select is(pg_temp.create_campaign(pg_temp.payload(pg_temp.key(2), true)) ->> 'duplicate', 'true', 'same key is flagged duplicate');
select is(pg_temp.create_campaign(pg_temp.payload(pg_temp.key(2), true)) ->> 'campaign_id',
  (select id::text from public.push_campaigns where idempotency_key = pg_temp.key(2)::uuid), 'same key returns the same campaign');
select is((select count(*) from public.coupons where source = 'push'), 3::bigint, 'duplicate creates no extra coupons');
select is((select count(*) from public.push_campaigns), 2::bigint, 'duplicate creates no extra campaign');
select is(pg_temp.create_campaign(pg_temp.payload(pg_temp.key(2), true)) ->> 'push_remaining_this_month', '3', 'duplicate does not use quota');

-- recipients: push-enabled devices with token, not signed out, of related customers (all devices per customer)
select is((select array_agg(token order by token) from public.get_push_recipients((select id from public.push_campaigns where idempotency_key = pg_temp.key(2)::uuid))),
  array['ExponentPushToken[u1-a]', 'ExponentPushToken[u1-b]'], 'recipients: only enabled, tokened, signed-in devices of related customers');
select is((select count(distinct coupon_id) from public.get_push_recipients((select id from public.push_campaigns where idempotency_key = pg_temp.key(2)::uuid))), 1::bigint, 'both devices of U1 share the customer coupon');
select is((select coupon_id from public.get_push_recipients((select id from public.push_campaigns where idempotency_key = pg_temp.key(2)::uuid)) limit 1),
  (select id from public.coupons where customer_id = pg_temp.customer_id('10000000-0000-0000-0000-0000000000a1') and source = 'push'), 'recipient coupon id is the customer coupon');
select is((select count(*) from public.get_push_recipients((select id from public.push_campaigns where idempotency_key = pg_temp.key(1)::uuid)) where coupon_id is null), 2::bigint, 'no coupon: coupon_id null');

-- record_push_result
select is(public.record_push_result((select id from public.push_campaigns where idempotency_key = pg_temp.key(2)::uuid), 1, 1, array['ExponentPushToken[u1-b]']),
  '{"sent":1,"failed":1,"push_remaining_this_month":3}'::jsonb, 'result recorded');
select is((select status::text || sent_count || failed_count from public.push_campaigns where idempotency_key = pg_temp.key(2)::uuid), 'sent11', 'campaign closed as sent');
select is((select (push_enabled, expo_push_token is null) from public.customer_devices where device_hash = 'u1-b'::bytea), row(false, true), 'invalid token device has push disabled');
select is((select push_enabled from public.customer_devices where device_hash = 'u1-a'::bytea), true, 'valid device untouched');
select is(public.record_push_result((select id from public.push_campaigns where idempotency_key = pg_temp.key(2)::uuid), 9, 9, '{}') ->> 'sent', '1', 'second call does not overwrite the result');
select is(public.record_push_result((select id from public.push_campaigns where idempotency_key = pg_temp.key(1)::uuid), 0, 2, '{}')  ->> 'failed', '2', 'all failed result');
select is((select status::text from public.push_campaigns where idempotency_key = pg_temp.key(1)::uuid), 'failed', 'nothing sent: status failed');
select is(pg_temp.field_of($$ select public.record_push_result(gen_random_uuid(), 0, 0, '{}') $$), 'campaign_id', 'unknown campaign');

-- panel view of the history (fake clock is frozen, so age the first campaign to make the order observable)
update public.push_campaigns set created_at = created_at - interval '1 hour' where idempotency_key = pg_temp.key(1)::uuid;
set local role authenticated;
select pg_temp.as_c1();
select is((select array_agg(c ->> 'status' order by n) from jsonb_array_elements(public.list_push_campaigns()) with ordinality t (c, n)), array['sent', 'failed'], 'history newest first');
select is(public.get_push_status() ->> 'remaining_this_month', '3', 'status reflects used quota');
reset role;
select pg_temp.as_c1();

-- quota: 5 per local month, all campaigns count
select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(3)));
select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(4)));
select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(5)));
select is(pg_temp.detail_of($$ select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(6))) $$), '{"resets_on":"2027-06-01"}'::jsonb, 'sixth send in the month: E-17 with resets_on');
select throws_ok($$ select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(6))) $$, 'P0001', 'E-17', 'quota exceeded');
select is((select count(*) from public.push_campaigns), 5::bigint, 'rejected send creates no campaign');
select is(pg_temp.create_campaign(pg_temp.payload(pg_temp.key(5))) ->> 'duplicate', 'true', 'duplicate still answers when quota is exhausted');
select is(pg_temp.field_of_campaign(pg_temp.payload('nope')), 'idempotency_key', 'validation runs before quota');

-- 2027-06-01 03:00 UTC is still May 31 locally: quota unchanged
select pg_temp.set_clock('2027-05-31 21:00:00-06');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock late on May 31');
reset role;
select throws_ok($$ select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(6))) $$, 'P0001', 'E-17', 'still May locally: quota holds');
select pg_temp.set_clock('2027-06-01 00:30:00-06');
select pg_temp.as_c1();
set local role authenticated;
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock on June 1');
reset role;
select pg_temp.as_c1();
select is(pg_temp.create_campaign(pg_temp.payload(pg_temp.key(6))) ->> 'push_remaining_this_month', '4', 'new local month resets the quota');

-- RN-71 inactive merchant: E-05 (admin session of C3 created directly)
insert into private.merchant_admin_sessions (merchant_id, auth_session_id, expires_at)
values ('20000000-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000003', '2027-06-01 01:00:00-06');
select throws_ok($$ select pg_temp.create_campaign(pg_temp.payload(pg_temp.key(7)), 'aaaaaaaa-0000-0000-0000-000000000003', '20000000-0000-0000-0000-0000000000c3') $$, 'P0001', 'E-05', 'inactive merchant cannot send');
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000003');
select throws_ok($$ select public.upsert_offer(null, 'X', 'x', 1::smallint) $$, 'P0001', 'E-05', 'inactive merchant cannot upsert offer');
select throws_ok($$ select public.delete_offer(gen_random_uuid()) $$, 'P0001', 'E-05', 'inactive merchant cannot delete offer');
select lives_ok($$ select public.get_push_status() $$, 'inactive merchant may read push status');
select * from finish();
rollback;
