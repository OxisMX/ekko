begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Relies on supabase/seed.sql (U1..U4, merchants C1..C3 with C3 inactive). Fixtures add redeemed coupons.

create function pg_temp.login(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', sub, 'role', 'authenticated',
    'app_metadata', '{"role":"customer"}'::jsonb)::text, true);
$$;
create function pg_temp.mk(p_user text, p_merchant text, p_code text, p_at timestamptz, p_status public.coupon_status default 'redeemed')
returns void language sql security definer as $$
  insert into public.coupons (customer_id, merchant_id, source, birthday_year, title, description, code, status, redeemed_at, expires_at)
  select c.id, ('20000000-0000-0000-0000-0000000000' || p_merchant)::uuid, 'birthday', (random() * 30000)::int + 1000,
         'T-' || p_code, 'D-' || p_code, p_code, p_status,
         case when p_status = 'redeemed' then p_at end, now() + interval '10 days'
  from public.customers c where c.auth_user_id = ('10000000-0000-0000-0000-0000000000' || p_user)::uuid;
$$;
create function pg_temp.device_row(p_user text, p_digest text) returns public.customer_devices language sql security definer as $$
  select d.* from public.customer_devices d join public.customers c on c.id = d.customer_id
  where c.auth_user_id = ('10000000-0000-0000-0000-0000000000' || p_user)::uuid and d.device_hash = app.peppered_hash(p_digest);
$$;

select pg_temp.mk('a1', 'c1', 'AAAAAA', '2026-03-01 10:00+00');
select pg_temp.mk('a1', 'c3', 'BBBBBB', '2026-03-03 10:00+00'); -- inactive merchant still listed
select pg_temp.mk('a1', 'c2', 'CCCCCC', '2026-03-02 10:00+00');
select pg_temp.mk('a1', 'c2', 'DDDDDD', null, 'active');         -- not redeemed: excluded
select pg_temp.mk('a2', 'c1', 'EEEEEE', '2026-03-05 10:00+00');

select ok(not has_function_privilege('anon', 'public.sign_out_device(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.list_my_redemptions(integer,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.sign_out_device(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.list_my_redemptions(integer,integer)', 'EXECUTE'), 'privileges');

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"merchant"}}', true);
select throws_ok($$ select public.list_my_redemptions() $$, 'P0001', null, 'no customer: rejected');

select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.list_my_redemptions()), 3, 'only redeemed coupons of the caller');
select is(public.list_my_redemptions() -> 0 ->> 'title', 'T-BBBBBB', 'newest first');
select is((select array_agg(e ->> 'title') from jsonb_array_elements(public.list_my_redemptions()) e),
  array['T-BBBBBB', 'T-CCCCCC', 'T-AAAAAA'], 'ordered by redeemed_at desc');
select is((select array_agg(k order by k) from jsonb_object_keys(public.list_my_redemptions() -> 0) k),
  array['coupon_id', 'merchant_name', 'redeemed_at', 'source', 'title'], 'row shape');
select is(public.list_my_redemptions() -> 0 ->> 'source', 'birthday', 'source exposed');
select isnt(public.list_my_redemptions() -> 0 ->> 'merchant_name', null, 'merchant name present (inactive merchant included)');
select is((select array_agg(e ->> 'title') from jsonb_array_elements(public.list_my_redemptions(1, 1)) e),
  array['T-CCCCCC'], 'offset and limit paginate');
select is(public.list_my_redemptions(3, 20), '[]'::jsonb, 'past the end: empty array');
select is(jsonb_array_length(public.list_my_redemptions(0, 50)), 3, 'limit 50 accepted');
select throws_ok($$ select public.list_my_redemptions(0, 51) $$, 'P0001', null, 'limit 51 rejected');
select throws_ok($$ select public.list_my_redemptions(0, 0) $$, 'P0001', null, 'limit 0 rejected');
select throws_ok($$ select public.list_my_redemptions(-1, 10) $$, 'P0001', null, 'negative offset rejected');

select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select is((select array_agg(e ->> 'title') from jsonb_array_elements(public.list_my_redemptions()) e),
  array['T-EEEEEE'], 'isolation: another customer sees only theirs');

-- sign_out_device
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select public.register_device(repeat('a', 64), 'ios', 'ExponentPushToken[x]', true);
select throws_ok($$ select public.sign_out_device('nope') $$, 'P0001', null, 'bad digest rejected');
select is(public.sign_out_device(repeat('a', 64)), '{"ok": true}'::jsonb, 'sign out returns ok');
select ok((pg_temp.device_row('a1', repeat('a', 64))).expo_push_token is null
  and (pg_temp.device_row('a1', repeat('a', 64))).signed_out_at is not null, 'token cleared and signed_out_at set');
select is(public.sign_out_device(repeat('b', 64)), '{"ok": true}'::jsonb, 'unknown device does not fail');
select public.register_device(repeat('a', 64), 'ios', 'ExponentPushToken[y]', true);
select ok((pg_temp.device_row('a1', repeat('a', 64))).signed_out_at is null
  and (pg_temp.device_row('a1', repeat('a', 64))).expo_push_token = 'ExponentPushToken[y]', 'register_device reactivates');

select * from finish();
rollback;
