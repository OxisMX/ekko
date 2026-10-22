begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

-- Relies on supabase/seed.sql: U1 C1 3/6; U2 no relations; U3 C1 0/6 + C2 0/4; U4 C1 (active reward
-- coupon, spun wheel) + C3 (inactive, active reward coupon). Auth users 10000000-…-0000000000aN.

create function pg_temp.login(sub text, merchant_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', sub, 'role', 'authenticated',
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end)::text, true);
$$;
create function pg_temp.cid(p_auth_user_id uuid) returns uuid language sql security definer as $$
  select c.id from public.customers c where c.auth_user_id = p_auth_user_id;
$$;
create function pg_temp.now() returns timestamptz language sql security definer as $$ select app.now() $$;
create function pg_temp.set_clock(p_at timestamptz) returns void language sql security definer as $$
  select set_config('app.fake_now', p_at::text, true);
$$;
create function pg_temp.cycle_expiry(p_id uuid) returns table (expires_at timestamptz) language sql security definer as $$
  select c.expires_at from public.card_cycles c where c.id = p_id;
$$;
-- Merchant ids in the order list_my_cards returned them.
create function pg_temp.order_of() returns text[] language sql as $$
  select array_agg(right(e ->> 'merchant_id', 3) order by n) from jsonb_array_elements(public.list_my_cards()) with ordinality t (e, n);
$$;
create function pg_temp.keys(obj jsonb) returns text[] language sql as $$
  select array_agg(k order by k) from jsonb_object_keys(obj) k;
$$;

-- Privileges
select ok(not has_function_privilege('anon', 'public.list_my_cards()', 'EXECUTE'), 'anon cannot execute list_my_cards');
select ok(has_function_privilege('authenticated', 'public.list_my_cards()', 'EXECUTE'), 'authenticated can execute list_my_cards');

set local role authenticated;

-- Roles
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.list_my_cards() $$, 'P0001', 'E-19', 'a merchant JWT raises E-19');

-- No relations: empty array, not null
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select is(public.list_my_cards(), '[]'::jsonb, 'a customer without relations gets []');

-- Shape and values (U1 @ C1)
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(jsonb_array_length(public.list_my_cards()), 1, 'U1 has exactly one card');
select is(pg_temp.keys(public.list_my_cards() -> 0), array['cycle_expires_at', 'logo_path', 'merchant_available', 'merchant_id', 'merchant_name',
  'reward_available', 'stamps_count', 'stamps_required', 'wheel_status'], 'a card has exactly the documented keys');
select is((public.list_my_cards() -> 0) - 'cycle_expires_at' - 'merchant_name', jsonb_build_object(
  'merchant_id', '20000000-0000-0000-0000-0000000000c1', 'logo_path', 'merchants/c1/logo', 'merchant_available', true,
  'stamps_count', 3, 'stamps_required', 6, 'reward_available', false, 'wheel_status', 'available'), 'U1 @ C1: 3 of 6, no reward, wheel available');
select is((public.list_my_cards() -> 0 ->> 'cycle_expires_at')::timestamptz, (select expires_at from pg_temp.cycle_expiry('50000000-0000-0000-0000-000000000001')),
  'cycle_expires_at is the active cycle expiry');

-- Isolation: U3 sees its own empty cards, never U1's stamps
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select is((select array_agg(e ->> 'stamps_count' order by e ->> 'merchant_id') from jsonb_array_elements(public.list_my_cards()) e), array['0', '0'],
  'U3 sees only its own two cards, both empty');

-- Order by created_at desc when neither has a reward
reset role;
update public.customer_merchants set created_at = pg_temp.now() - interval '2 days'
  where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a3') and merchant_id = '20000000-0000-0000-0000-0000000000c1';
update public.customer_merchants set created_at = pg_temp.now() - interval '1 day'
  where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a3') and merchant_id = '20000000-0000-0000-0000-0000000000c2';
set local role authenticated;
select is(pg_temp.order_of(), array['0c2', '0c1'], 'newest relation first');
reset role;
update public.customer_merchants set created_at = pg_temp.now() - interval '3 days'
  where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a3') and merchant_id = '20000000-0000-0000-0000-0000000000c2';
set local role authenticated;
select is(pg_temp.order_of(), array['0c1', '0c2'], 'order follows created_at desc');

-- U4: inactive merchant listed; reward_available, then merchant_available, decide the order
select pg_temp.login('10000000-0000-0000-0000-0000000000a4');
select is(pg_temp.order_of(), array['0c1', '0c3'], 'reward + available first, then reward at the unavailable merchant');
select is((select e - 'cycle_expires_at' - 'merchant_name' - 'logo_path' from jsonb_array_elements(public.list_my_cards()) e where e ->> 'merchant_id' like '%c3'),
  '{"merchant_id":"20000000-0000-0000-0000-0000000000c3","merchant_available":false,"stamps_count":0,"stamps_required":6,"reward_available":true,"wheel_status":"unavailable"}'::jsonb,
  'the inactive merchant is listed with merchant_available false and wheel unavailable (RN-71)');
select is((select e ->> 'wheel_status' from jsonb_array_elements(public.list_my_cards()) e where e ->> 'merchant_id' like '%c1'), 'spun', 'U4 @ C1 wheel is spun');

reset role;
update public.coupons set status = 'redeemed', redeemed_at = pg_temp.now()
  where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a4') and merchant_id = '20000000-0000-0000-0000-0000000000c1' and source = 'card_reward';
set local role authenticated;
select is(pg_temp.order_of(), array['0c3', '0c1'], 'reward_available outranks merchant_available');
reset role;
update public.coupons set expires_at = pg_temp.now()
  where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a4') and merchant_id = '20000000-0000-0000-0000-0000000000c3' and source = 'card_reward';
set local role authenticated;
select is((select array_agg((e ->> 'reward_available')::boolean) from jsonb_array_elements(public.list_my_cards()) e), array[false, false],
  'a redeemed or expired reward coupon is not reward_available (RN-28)');
select is(pg_temp.order_of(), array['0c1', '0c3'], 'without rewards the available merchant goes first');

-- Lazy rollover (RN-25): past the cycle expiry the card reads 0 with a fresh expiry
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select pg_temp.set_clock(pg_temp.now() + interval '7 months');
select is(public.list_my_cards() -> 0 ->> 'stamps_count', '0', 'an expired cycle reads 0 stamps');
select is((public.list_my_cards() -> 0 ->> 'cycle_expires_at')::timestamptz, pg_temp.now() + interval '6 months', 'a new cycle expiry starts now');
reset role;
select is((select count(*) from public.card_cycles where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a1') and status = 'expired'), 1::bigint,
  'the old cycle was marked expired');

select * from finish();
rollback;
