begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

-- Relies on supabase/seed.sql: C2 has no visits (clean slate for the metrics); C3 inactive; U4 has C1 and C3
-- cards, active coupons, an active cycle and a wheel spin at C1.
create function pg_temp.login(sub text, merchant_id text default null, session_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'session_id', session_id,
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end))::text, true);
$$;
create function pg_temp.as_c2() returns void language sql as $$
  select pg_temp.login('10000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000002');
$$;
create function pg_temp.exec(p_sql text) returns void language plpgsql security definer as $$
begin execute p_sql; end $$;
create function pg_temp.field_of(p_sql text) returns text language plpgsql as $$
declare v_detail text;
begin execute p_sql; return null;
exception when others then get stacked diagnostics v_detail = pg_exception_detail; return (v_detail::jsonb) ->> 'field'; end $$;
create function pg_temp.keys(obj jsonb) returns text[] language sql as $$
  select array_agg(k order by k) from jsonb_object_keys(obj) k;
$$;
create function pg_temp.cid(p_user text) returns uuid language sql security definer as $$
  select id from public.customers where auth_user_id = ('10000000-0000-0000-0000-0000000000' || p_user)::uuid
$$;
-- A QR token of C2: age strings are intervals before the fake clock. Used ones get used_by = U<p_user>.
create function pg_temp.tok(p_name text, p_created_ago interval, p_used boolean, p_user text default null, p_invalidated boolean default false)
returns void language sql security definer as $$
  insert into public.visit_qr_tokens (merchant_id, token_hash, created_at, expires_at, used_at, used_by_customer_id, invalidated_at)
  values ('20000000-0000-0000-0000-0000000000c2', pg_catalog.sha256(pg_catalog.convert_to(p_name, 'UTF8')),
    '2027-05-10 12:00:00-06'::timestamptz - p_created_ago, '2027-05-10 12:00:00-06'::timestamptz - p_created_ago + interval '60 seconds',
    case when p_used then '2027-05-10 12:00:00-06'::timestamptz - p_created_ago + interval '10 seconds' end,
    case when p_used then pg_temp.cid(p_user) end,
    case when p_invalidated then '2027-05-10 12:00:00-06'::timestamptz - p_created_ago + interval '30 seconds' end);
$$;
create function pg_temp.coupon(p_user text, p_year smallint, p_code text, p_redeemed_ago interval)
returns void language sql security definer as $$
  insert into public.coupons (customer_id, merchant_id, source, birthday_year, title, description, code, status, issued_at, expires_at, redeemed_at)
  values (pg_temp.cid(p_user), '20000000-0000-0000-0000-0000000000c2', 'birthday', p_year, 'Cumple', 'Regalo', p_code,
    case when p_redeemed_ago is null then 'active'::public.coupon_status else 'redeemed' end,
    '2026-01-01', '2099-01-01', case when p_redeemed_ago is not null then '2027-05-10 12:00:00-06'::timestamptz - p_redeemed_ago end);
$$;

select pg_temp.exec($$ select set_config('app.fake_now', '2027-05-10 12:00:00-06', true) $$);

-- Visits at C2: used 2d (U2), 5d (U1), 10d (U3), 20d (U1) inside 30 days; 31d (U4), 40d (U1) outside.
select pg_temp.tok('t1', interval '2 days', true, 'a2');
select pg_temp.tok('t2', interval '5 days', true, 'a1');
select pg_temp.tok('t3', interval '10 days', true, 'a3');
select pg_temp.tok('t4', interval '20 days', true, 'a1');
select pg_temp.tok('t5', interval '31 days', true, 'a4');
select pg_temp.tok('t6', interval '40 days', true, 'a1');
select pg_temp.tok('t-pending', interval '0 seconds', false);
select pg_temp.tok('t-invalidated', interval '1 hour', false, null, true);
select pg_temp.tok('t-expired', interval '2 hours', false);
-- Coupons of C2 redeemed 5d (in) and 40d (out); one still active.
select pg_temp.coupon('a1', 2025::smallint, '222222', interval '5 days');
select pg_temp.coupon('a1', 2026::smallint, '333333', interval '40 days');
select pg_temp.coupon('a1', 2027::smallint, '444444', null);

select ok(has_function_privilege('authenticated', 'public.get_metrics(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.list_qr_log(integer,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_metrics(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_qr_log(integer,integer)', 'EXECUTE'), 'panel rpc privileges');
select ok(not has_function_privilege('anon', 'public.anonymize_customer(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.anonymize_customer(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.anonymize_customer(uuid)', 'EXECUTE'), 'anonymize_customer is service_role only');

set local role authenticated;

-- Gates
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.get_metrics('30d') $$, 'P0001', 'E-19', 'customer cannot get_metrics');
select throws_ok($$ select public.list_qr_log(0, 10) $$, 'P0001', 'E-19', 'customer cannot list_qr_log');
select throws_ok($$ select public.anonymize_customer(gen_random_uuid()) $$, '42501', null, 'authenticated cannot anonymize_customer');
select pg_temp.as_c2();
select throws_ok($$ select public.get_metrics('30d') $$, 'P0001', 'E-16', 'get_metrics requires admin session');
select throws_ok($$ select public.list_qr_log(0, 10) $$, 'P0001', 'E-16', 'list_qr_log requires admin session');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock C2');

-- Validation
select is(pg_temp.field_of($$ select public.get_metrics('7d') $$), 'range', 'unknown range');
select is(pg_temp.field_of($$ select public.get_metrics(null) $$), 'range', 'null range');
select is(pg_temp.field_of($$ select public.list_qr_log(-1, 10) $$), 'offset', 'negative offset');
select is(pg_temp.field_of($$ select public.list_qr_log(0, 0) $$), 'limit', 'limit 0');
select is(pg_temp.field_of($$ select public.list_qr_log(0, 51) $$), 'limit', 'limit 51');
select is(pg_temp.field_of($$ select public.list_qr_log(0, null) $$), 'limit', 'null limit');

-- Metrics math
select is(public.get_metrics('30d'),
  '{"visits":4,"previous":{"visits":2,"redemptions":1},"redemptions":1,"active_customers":3,"push_remaining_this_month":5}'::jsonb,
  '30d: 4 visits, 1 redemption, active = U1 + U2 + U3');
select is(public.get_metrics('all'),
  '{"visits":6,"previous":null,"redemptions":2,"active_customers":3,"push_remaining_this_month":5}'::jsonb,
  'all: visits and redemptions are historic, active_customers keeps the 30-day window (RN-67)');
select is(pg_temp.keys(public.get_metrics('all')), array['active_customers', 'previous', 'push_remaining_this_month', 'redemptions', 'visits'], 'only aggregates (RN-66)');
select pg_temp.exec($$ select set_config('app.fake_now', '2027-05-10 12:00:00-06', true) $$);

-- QR log
select is(jsonb_array_length(public.list_qr_log(0, 50)), 9, 'all 9 tokens');
select is(jsonb_array_length(public.list_qr_log()), 9, 'default page size covers them');
select is((select array_agg(e ->> 'status' order by n) from jsonb_array_elements(public.list_qr_log(0, 4)) with ordinality t (e, n)),
  array['pending', 'invalidated', 'expired', 'used'], 'newest first with status');
select is(pg_temp.keys(public.list_qr_log(0, 1) -> 0), array['created_at', 'expires_at', 'status', 'used_at'], 'no customer data in the log (RN-66)');
select is(public.list_qr_log(0, 1) -> 0 ->> 'used_at', null, 'pending has no used_at');
select is((public.list_qr_log(3, 1) -> 0 ->> 'used_at')::timestamptz, '2027-05-08 12:00:10-06'::timestamptz, 'used token carries used_at');
select is((select array_agg(e ->> 'status' order by n) from jsonb_array_elements(public.list_qr_log(2, 2)) with ordinality t (e, n)),
  array['expired', 'used'], 'offset pages');
select is(public.list_qr_log(9, 5), '[]'::jsonb, 'offset past the end is empty');
select is((select count(*)::int from jsonb_array_elements(public.list_qr_log(0, 3))), 3, 'limit respected');
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock C1');
select is((select count(*)::int from jsonb_array_elements(public.list_qr_log(0, 50)) e where e ->> 'status' = 'pending'), 0, 'another merchant does not see C2 pending tokens');

-- Inactive merchant may read
reset role;
insert into private.merchant_admin_sessions (merchant_id, auth_session_id, expires_at)
values ('20000000-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000003', '2027-06-01 01:00:00-06');
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000003');
select lives_ok($$ select public.get_metrics('all') $$, 'inactive merchant may read metrics');
select lives_ok($$ select public.list_qr_log(0, 5) $$, 'inactive merchant may read the qr log');
reset role;

-- ================= anonymize_customer =================
-- U4: profile data, devices with tokens, an active coupon at C1 + C3 (seed), a redeemed coupon, active cycles.
update public.customers set first_name = 'Cuatro', last_name = 'Prueba', birth_date = '1990-01-01' where id = pg_temp.cid('a4');
insert into public.customer_devices (customer_id, device_hash, platform, expo_push_token, push_enabled)
values (pg_temp.cid('a4'), '\x01', 'android', 'ExponentPushToken[u4-a]', true), (pg_temp.cid('a4'), '\x02', 'ios', 'ExponentPushToken[u4-b]', true);
select pg_temp.coupon('a4', 2026::smallint, '555555', interval '3 days');

create temp table before_counts as
select (select count(*) from public.stamps where customer_id = pg_temp.cid('a4')) as stamps,
       (select count(*) from public.wheel_spins where customer_id = pg_temp.cid('a4')) as spins,
       (select count(*) from public.coupons where customer_id = pg_temp.cid('a4') and status = 'redeemed') as redeemed,
       (select count(*) from public.coupons where customer_id = pg_temp.cid('a4') and status = 'active') as active_coupons,
       (select count(*) from public.card_cycles where customer_id = pg_temp.cid('a4') and status = 'active') as active_cycles,
       (select count(*) from public.card_cycles where customer_id = pg_temp.cid('a4') and status = 'completed') as completed_cycles,
       (select email_hash from public.wheel_spins where customer_id = pg_temp.cid('a4')) as email_hash;
select ok((select stamps > 0 and spins = 1 and redeemed = 1 and active_coupons >= 2 and active_cycles = 2 and completed_cycles = 2 from before_counts), 'U4 fixture as expected');

select pg_temp.exec($$ select set_config('app.fake_now', '2027-05-10 12:00:00-06', true) $$);
set local role service_role;
select is(public.anonymize_customer(pg_temp.cid('a4')), true, 'first call anonymizes');
select is(pg_temp.field_of($$ select public.anonymize_customer(gen_random_uuid()) $$), 'customer_id', 'unknown customer');
reset role;

select is((select row(first_name, last_name, birth_date, status::text, deleted_at)::text from public.customers where id = pg_temp.cid('a4')),
  row(null::text, null::text, null::date, 'deleted', '2027-05-10 12:00:00-06'::timestamptz)::text, 'step 1: personal data cleared, status deleted');
select is((select count(*)::int from public.customer_devices where customer_id = pg_temp.cid('a4') and expo_push_token is null and not push_enabled), 2, 'step 2: tokens removed');
select is((select count(*)::int from public.customer_devices where customer_id = pg_temp.cid('a4')), 2, 'step 2: device rows (device_hash) kept');
select is((select count(*)::int from public.coupons where customer_id = pg_temp.cid('a4') and status = 'active'), 0, 'step 3: active coupons deleted');
select is((select count(*)::int from public.coupons where customer_id = pg_temp.cid('a4') and status = 'redeemed'), 1, 'step 6: redeemed coupons kept');
select is((select count(*)::int from public.card_cycles where customer_id = pg_temp.cid('a4') and status = 'active'), 0, 'step 4: no active cycle');
select is((select count(*)::int from public.card_cycles where customer_id = pg_temp.cid('a4') and status = 'expired' and closed_at = '2027-05-10 12:00:00-06'), 2, 'step 4: active cycles closed as expired');
select is((select count(*)::int from public.card_cycles where customer_id = pg_temp.cid('a4') and status = 'completed'), 2, 'step 4: completed cycles untouched');
select is((select count(*)::int from public.customer_merchants where customer_id = pg_temp.cid('a4')), 0, 'step 5: relations deleted');
select is((select count(*) from public.stamps where customer_id = pg_temp.cid('a4')), (select stamps from before_counts), 'step 6: stamps kept');
select is((select email_hash from public.wheel_spins where customer_id = pg_temp.cid('a4')), (select email_hash from before_counts), 'step 6: wheel spin and email_hash kept');
select ok(not exists (select 1 from app.push_recipient_ids('20000000-0000-0000-0000-0000000000c1') r where r = pg_temp.cid('a4')), 'deleted customer is no push recipient');

-- Idempotent: a later second call changes nothing
select pg_temp.exec($$ select set_config('app.fake_now', '2027-06-01 12:00:00-06', true) $$);
set local role service_role;
select is(public.anonymize_customer(pg_temp.cid('a4')), false, 'second call is a no-op');
reset role;
select is((select deleted_at from public.customers where id = pg_temp.cid('a4')), '2027-05-10 12:00:00-06'::timestamptz, 'deleted_at not rewritten');
select is((select count(*)::int from public.card_cycles where customer_id = pg_temp.cid('a4') and status = 'expired' and closed_at = '2027-05-10 12:00:00-06'), 2, 'cycles not rewritten');

-- Deleted accounts do not count as active customers (RN-67) but their visits stay
select pg_temp.exec($$ select set_config('app.fake_now', '2027-05-10 12:00:00-06', true) $$);
set local role service_role;
select public.anonymize_customer(pg_temp.cid('a2'));
reset role;
set local role authenticated;
select pg_temp.as_c2();
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock C2 again');
select is(public.get_metrics('30d'), '{"visits":4,"previous":{"visits":2,"redemptions":1},"redemptions":2,"active_customers":2,"push_remaining_this_month":5}'::jsonb,
  'after deleting U2: visits stay, active_customers drops');
reset role;

-- RN-09: Auth user deleted, the same email registers again as a new customer and cannot spin again at C1
delete from auth.users where id = '10000000-0000-0000-0000-0000000000a4';
select is((select auth_user_id from public.customers where id = pg_temp.cid('a4')), null, 'auth_user_id is null after the Auth user is deleted');
update auth.users set email = 'u4@ekko.test' where id = '10000000-0000-0000-0000-0000000000a3';
select pg_temp.exec($$ select set_config('app.fake_now', '', true) $$);
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select public.spin_wheel('20000000-0000-0000-0000-0000000000c1', repeat('dd', 32)) $$, 'P0001', 'E-09', 'same email with a new device and account is blocked by email_hash');
reset role;

-- ================= KPI views =================
select ok(not has_schema_privilege('anon', 'private', 'USAGE') and not has_schema_privilege('authenticated', 'private', 'USAGE'), 'private schema closed to API roles');
select ok(not has_table_privilege('anon', 'private.kpi_merchants', 'SELECT')
  and not has_table_privilege('authenticated', 'private.kpi_merchants', 'SELECT')
  and not has_table_privilege('authenticated', 'private.kpi_customers', 'SELECT')
  and not has_table_privilege('authenticated', 'private.kpi_weekly_stamps', 'SELECT')
  and not has_table_privilege('authenticated', 'private.kpi_reward_redemption', 'SELECT')
  and not has_table_privilege('authenticated', 'private.kpi_coupon_redemption', 'SELECT')
  and not has_table_privilege('authenticated', 'private.merchants_billing', 'SELECT')
  and not has_table_privilege('anon', 'private.merchants_billing', 'SELECT'), 'KPI views are not selectable by API roles');
set local role anon;
select throws_ok($$ select * from private.kpi_customers $$, '42501', null, 'anon cannot read kpi_customers');
reset role;
set local role authenticated;
select throws_ok($$ select * from private.kpi_customers $$, '42501', null, 'authenticated cannot read kpi_customers');
reset role;

select is((select registered_customers from private.kpi_customers), (select count(*) from public.customers where status = 'active'), 'kpi_customers counts active customers');
select is((select sum(active_visible_merchants)::bigint from private.kpi_merchants), (select count(*) from public.merchants where is_active and is_visible), 'kpi_merchants totals');
select is((select sum(stamps)::bigint from private.kpi_weekly_stamps), (select count(*) from public.stamps where not is_bonus), 'kpi_weekly_stamps counts visit stamps');
select ok(not exists (select 1 from private.kpi_weekly_stamps where extract(isodow from week_start) <> 1), 'weeks start on Monday');
select is((select issued_closed from private.kpi_reward_redemption), 0::bigint, 'kpi_reward_redemption: seed rewards are still valid, excluded');
select is((select row(redeemed, issued_closed, redemption_pct)::text from private.kpi_coupon_redemption), '(3,3,100.0)', 'kpi_coupon_redemption: 3 redeemed, valid ones excluded');
update public.merchants set paid_until = app.local_today() - 5 where id = '20000000-0000-0000-0000-0000000000c3';
select is((select row(billing_state, days_to_due, grace_days_left)::text from private.merchants_billing where merchant_id = '20000000-0000-0000-0000-0000000000c3'),
  '(overdue,-5,10)', 'merchants_billing: overdue with 10 grace days left');
update public.merchants set paid_until = app.local_today() + 7 where id = '20000000-0000-0000-0000-0000000000c3';
select is((select row(billing_state, days_to_due, grace_days_left)::text from private.merchants_billing where merchant_id = '20000000-0000-0000-0000-0000000000c3'),
  '(expiring,7,)', 'merchants_billing: expiring within 15 days');
select is((select count(*)::int from private.merchants_billing where merchant_id = '20000000-0000-0000-0000-0000000000c1'), 0, 'merchants_billing: paid merchants are absent');

select * from finish();
rollback;
