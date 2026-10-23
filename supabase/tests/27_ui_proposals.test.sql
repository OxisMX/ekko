begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- UI proposals: catalog progress, QR status progress, coupon status, previous metrics, push reach.
-- Relies on supabase/seed.sql: C1 (PIN 1234) with U1 3/6, U3 0/6, U4 0/6; U2 has no relations; C3 inactive.
create function pg_temp.login(sub text, merchant_id text default null, session_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'session_id', session_id,
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end))::text, true);
$$;
create function pg_temp.as_c1() returns void language sql as $$
  select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001');
$$;
create function pg_temp.cid(p_auth_user text) returns uuid language sql security definer as $$
  select id from public.customers where auth_user_id = p_auth_user::uuid;
$$;
create function pg_temp.progress_of(p_merchant text) returns jsonb language sql as $$
  select coalesce((select i -> 'progress' from jsonb_array_elements(public.list_merchants('s', p_limit => 20) -> 'items') i
                   where i ->> 'id' = p_merchant), '"missing"'::jsonb);
$$;

select ok(not has_function_privilege('anon', 'public.get_coupon_status(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_coupon_status(uuid)', 'EXECUTE'), 'get_coupon_status privileges');

-- Fixtures (as superuser)
insert into public.coupons (id, customer_id, merchant_id, source, birthday_year, title, description, code, expires_at)
values ('30000000-0000-0000-0000-000000000001', pg_temp.cid('10000000-0000-0000-0000-0000000000a1'),
        '20000000-0000-0000-0000-0000000000c1', 'birthday', 2030, 'T', 'D', 'ABC237', app.now() + interval '1 day');
-- Visits: one in the current 30d window, two in the previous one, one older than both.
insert into public.visit_qr_tokens (id, merchant_id, token_hash, expires_at, used_at, used_by_customer_id)
values
  ('31000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000c1', '\xa1', app.now() + interval '1 day', app.now() - interval '1 day', pg_temp.cid('10000000-0000-0000-0000-0000000000a1')),
  ('31000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000c1', '\xa2', app.now() + interval '1 day', app.now() - interval '40 days', pg_temp.cid('10000000-0000-0000-0000-0000000000a1')),
  ('31000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-0000000000c1', '\xa3', app.now() + interval '1 day', app.now() - interval '59 days', pg_temp.cid('10000000-0000-0000-0000-0000000000a1')),
  ('31000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-0000000000c1', '\xa4', app.now() + interval '1 day', app.now() - interval '61 days', pg_temp.cid('10000000-0000-0000-0000-0000000000a1')),
  ('31000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-0000000000c1', '\xa5', app.now() + interval '1 day', null, null);
insert into private.merchant_admin_sessions (merchant_id, auth_session_id, expires_at)
values ('20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', app.now() + interval '1 hour');

set local role authenticated;

-- A-19
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(pg_temp.progress_of('20000000-0000-0000-0000-0000000000c1'),
  '{"stamps":3,"stamps_required":6,"reward_title":"Bebida gratis"}'::jsonb, 'A-19: U1 sees 3/6 at C1');
select is(pg_temp.progress_of('20000000-0000-0000-0000-0000000000c2'), 'null'::jsonb, 'A-19: no relation gives null progress');
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select is(pg_temp.progress_of('20000000-0000-0000-0000-0000000000c1'), 'null'::jsonb, 'A-19: customer without relations gets null');
select is(jsonb_typeof((public.list_merchants('s') -> 'items' -> 0) -> 'progress'), 'null', 'A-19: progress key is present as JSON null');

-- A-65
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(public.get_coupon_status('30000000-0000-0000-0000-000000000001'), '{"status":"active","redeemed_at":null}'::jsonb, 'A-65: active coupon');
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select public.get_coupon_status('30000000-0000-0000-0000-000000000001') $$, 'P0001', 'E-12', 'A-65: foreign coupon is E-12');
select throws_ok($$ select public.get_coupon_status(gen_random_uuid()) $$, 'P0001', 'E-12', 'A-65: missing coupon is E-12');
reset role;
update public.coupons set status = 'redeemed', redeemed_at = app.now() where id = '30000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(public.get_coupon_status('30000000-0000-0000-0000-000000000001') ->> 'status', 'redeemed', 'A-65: redeemed status is readable (reveal would raise E-11)');
select isnt(public.get_coupon_status('30000000-0000-0000-0000-000000000001') ->> 'redeemed_at', null, 'A-65: redeemed_at is returned');

-- P-20
select pg_temp.as_c1();
select is(public.get_qr_status('31000000-0000-0000-0000-000000000001'),
  '{"status":"used","stamps":3,"stamps_required":6,"reward_available":false}'::jsonb, 'P-20: used token carries card aggregates');
select is(public.get_qr_status('31000000-0000-0000-0000-000000000005'), '{"status":"pending"}'::jsonb, 'P-20: pending token keeps the old shape');

-- P-23
select is(public.get_metrics('30d') -> 'previous', '{"visits":2,"redemptions":0}'::jsonb, 'P-23: previous window counts 30-60 days ago');
select is(jsonb_typeof(public.get_metrics('all') -> 'previous'), 'null', 'P-23: all has no previous');
select cmp_ok((public.get_metrics('30d') ->> 'visits')::int, '>=', 1, 'P-23: current values still count the window');

-- P-40
select cmp_ok((public.get_push_status() ->> 'eligible_recipients')::int, '<=', (public.get_push_status() ->> 'recipients_count')::int,
  'P-40: eligible never exceeds recipients');
reset role;
update public.customers set push_opt_in = false;
set local role authenticated;
select pg_temp.as_c1();
select is((public.get_push_status() ->> 'eligible_recipients')::int, 0, 'P-40: opted-out customers are not counted');

select * from finish();
rollback;
