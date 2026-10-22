begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- Relies on supabase/seed.sql: U4 has C1 reward (30 d) + C1 wheel (2 h) + C3 reward coupons; U1 is
-- verified, U2 is not. Fixtures below add coupons for U1/U2/U3 with known codes.

create function pg_temp.login(sub text, merchant_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', sub, 'role', 'authenticated',
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end)::text, true);
$$;
create function pg_temp.set_clock(p_at timestamptz) returns void language sql security definer as $$
  select set_config('app.fake_now', p_at::text, true);
$$;
create function pg_temp.keys(obj jsonb) returns text[] language sql as $$
  select array_agg(k order by k) from jsonb_object_keys(obj) k;
$$;
-- Inserts a coupon for a seed user and returns its id (fixture; runs as the table owner).
create function pg_temp.mk(p_user text, p_merchant text, p_code text, p_expires interval default interval '10 days',
  p_status public.coupon_status default 'active') returns uuid language sql security definer as $$
  insert into public.coupons (customer_id, merchant_id, source, birthday_year, title, description, code, status, redeemed_at, expires_at)
  select c.id, ('20000000-0000-0000-0000-0000000000' || p_merchant)::uuid, 'birthday', (random() * 30000)::int + 1000,
         'T-' || p_code, 'D-' || p_code, p_code, p_status,
         case when p_status = 'redeemed' then app.now() - interval '1 day' end, app.now() + p_expires
  from public.customers c where c.auth_user_id = ('10000000-0000-0000-0000-0000000000' || p_user)::uuid
  returning id;
$$;
create function pg_temp.seed_code(p_source text, p_user text, p_merchant text) returns text language sql security definer as $$
  select c.code from public.coupons c join public.customers cu on cu.id = c.customer_id
  where cu.auth_user_id = ('10000000-0000-0000-0000-0000000000' || p_user)::uuid
    and c.merchant_id = ('20000000-0000-0000-0000-0000000000' || p_merchant)::uuid and c.source::text = p_source;
$$;
create function pg_temp.counter(p_merchant text) returns text language sql security definer as $$
  select code_failed_count || '/' || coalesce(validator_locked_until::text, '-') from private.merchant_security
  where merchant_id = ('20000000-0000-0000-0000-0000000000' || p_merchant)::uuid;
$$;
create function pg_temp.stored(p_id uuid) returns text language sql security definer as $$
  select status || '/' || (redeemed_at is not null) from public.coupons where id = p_id;
$$;
create function pg_temp.miss(p_n int) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  for i in 1..p_n loop v := public.lookup_redemption('ZZZZZZ'); end loop;
  return v;
end $$;

create temp table ctx as select date_trunc('second', now()) + interval '1 hour' as base;
grant all on ctx to authenticated;
create function pg_temp.at(p interval) returns void language sql as $$
  select set_config('app.fake_now', ((select base from ctx) + p)::text, true);
$$;

create temp table fx as
select pg_temp.mk('a1', 'c1', '2AAAAA') as ok_id,
       pg_temp.mk('a1', 'c2', '2BBBBB') as other_merchant_id,
       pg_temp.mk('a1', 'c1', '2CCCCC', interval '-1 hour') as expired_id,
       pg_temp.mk('a1', 'c1', '2DDDDD', interval '10 days', 'redeemed') as used_id,
       pg_temp.mk('a2', 'c1', '2EEEEE') as unverified_id,
       pg_temp.mk('a1', 'c1', '2FFFFF', interval '5 days') as later_id,
       pg_temp.mk('a3', 'c1', '2GGGGG') as u3_id,
       pg_temp.mk('a1', 'c1', '2HHHHH') as confirm_id;
grant all on fx to authenticated;

-- Privileges
select ok(not has_function_privilege('anon', 'public.list_my_coupons(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.reveal_coupon_code(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.lookup_redemption(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.confirm_redemption(uuid)', 'EXECUTE'), 'anon cannot execute any of the four');
select ok(has_function_privilege('authenticated', 'public.list_my_coupons(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.reveal_coupon_code(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.lookup_redemption(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.confirm_redemption(uuid)', 'EXECUTE'), 'authenticated can execute all four');

set local role authenticated;

-- Roles
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.list_my_coupons() $$, 'P0001', 'E-19', 'merchant cannot list_my_coupons');
select throws_ok($$ select public.reveal_coupon_code(null) $$, 'P0001', 'E-19', 'merchant cannot reveal_coupon_code');
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.lookup_redemption('2AAAAA') $$, 'P0001', 'E-19', 'customer cannot lookup_redemption');
select throws_ok($$ select public.confirm_redemption(null) $$, 'P0001', 'E-19', 'customer cannot confirm_redemption');

-- RLS: the code is not readable by tables (only through reveal_coupon_code)
select is((select count(*)::int from public.coupons), 0, 'authenticated reads no coupon rows directly');

-- list_my_coupons
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select is(jsonb_array_length(public.list_my_coupons()), 1, 'U2 sees only its own coupon');
select pg_temp.login('10000000-0000-0000-0000-0000000000a4');
select is(jsonb_array_length(public.list_my_coupons()), 3, 'U4 lists reward C1, wheel C1, reward C3');
select is(pg_temp.keys(public.list_my_coupons() -> 0), array['description', 'expires_at', 'id', 'merchant_available', 'merchant_id',
  'merchant_name', 'source', 'terms', 'title'], 'a coupon has exactly the documented keys (no code)');
select is((public.list_my_coupons() -> 0 ->> 'source'), 'wheel', 'ordered by expires_at: the 2 h wheel coupon first');
select is(jsonb_array_length(public.list_my_coupons('20000000-0000-0000-0000-0000000000c3')), 1, 'filter by merchant');
select is((public.list_my_coupons('20000000-0000-0000-0000-0000000000c3') -> 0 ->> 'merchant_available')::boolean, false,
  'inactive merchant coupon is listed with merchant_available = false (RN-71)');
select is(public.list_my_coupons('20000000-0000-0000-0000-0000000000c2'), '[]'::jsonb, 'no coupons -> []');
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select ok(not (public.list_my_coupons()::text like '%' || (select expired_id::text from fx) || '%'), 'expired coupons are not listed');
select ok(not (public.list_my_coupons()::text like '%' || (select used_id::text from fx) || '%'), 'redeemed coupons are not listed');
select ok(not (public.list_my_coupons()::text like '%' || (select u3_id::text from fx) || '%'), 'another customer coupon is not listed');

-- reveal_coupon_code
select is(public.reveal_coupon_code((select ok_id from fx)) ->> 'code', '2AAAAA', 'reveal returns the code');
select is(pg_temp.keys(public.reveal_coupon_code((select ok_id from fx))), array['code', 'expires_at', 'merchant_name', 'title'], 'reveal keys');
select throws_ok($$ select public.reveal_coupon_code((select u3_id from fx)) $$, 'P0001', 'E-12', 'IDOR: another customer coupon -> E-12');
select throws_ok($$ select public.reveal_coupon_code(gen_random_uuid()) $$, 'P0001', 'E-12', 'unknown coupon -> same E-12');
select throws_ok($$ select public.reveal_coupon_code((select used_id from fx)) $$, 'P0001', 'E-11', 'redeemed -> E-11');
select throws_ok($$ select public.reveal_coupon_code((select expired_id from fx)) $$, 'P0001', 'E-10', 'expired -> E-10');
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.reveal_coupon_code((select unverified_id from fx)) $$, 'P0001', 'E-06', 'unverified email -> E-06');

-- lookup_redemption: success shape, normalization, isolation
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select is(pg_temp.keys(public.lookup_redemption('  2aaaaa ')), array['coupon_id', 'customer_full_name', 'description', 'expires_at', 'ok',
  'source', 'terms', 'title'], 'success keys');
select is(public.lookup_redemption(' 2aaaaa') ->> 'title', 'T-2AAAAA', 'trim + uppercase normalization');
select ok(length(public.lookup_redemption('2AAAAA') ->> 'customer_full_name') > 3, 'success carries the customer full name');
select is(public.lookup_redemption('2BBBBB') ->> 'error', 'E-12', 'code of another merchant = not found');
select is(pg_temp.counter('c1'), '1/-', 'a miss counted; hits do not reset it');
select throws_ok($$ select public.lookup_redemption('2CCCCC') $$, 'P0001', 'E-10', 'expired code -> E-10');
select throws_ok($$ select public.lookup_redemption('2DDDDD') $$, 'P0001', 'E-11', 'redeemed code -> E-11');
select is(pg_temp.counter('c1'), '1/-', 'E-10/E-11 do not count as failures');

-- Counter: 9 misses total -> remaining 1; 10th locks; window reset
select pg_temp.at(interval '0 s');
select is(pg_temp.miss(1), '{"ok": false, "error": "E-12", "remaining": 9}'::jsonb, 'window restarts after 5 min: count back to 1');
select is(pg_temp.miss(7), '{"ok": false, "error": "E-12", "remaining": 2}'::jsonb, '8th miss -> 2 remaining');
select is(pg_temp.miss(1), '{"ok": false, "error": "E-12", "remaining": 1}'::jsonb, '9th miss -> remaining 1');
create temp table lk as select pg_temp.miss(1) as v;
select is((select v ->> 'error' from lk), 'E-13', '10th miss returns E-13 (not a raise, so the counter persists)');
select is((select (v ->> 'locked_until')::timestamptz from lk), (select base + interval '5 minutes' from ctx), 'locked for 5 min');
select throws_ok($$ select public.lookup_redemption('2AAAAA') $$, 'P0001', 'E-13', 'locked: even a valid code raises E-13');
select pg_temp.at(interval '5 min 1 s');
select is(public.lookup_redemption('2AAAAA') ->> 'ok', 'true', 'lock expired: lookup works');
select is(pg_temp.miss(1) ->> 'remaining', '9', 'after the lock the window is stale -> counter restarts');

-- confirm_redemption
select pg_temp.login('10000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-0000000000c2');
select throws_ok($$ select public.confirm_redemption((select confirm_id from fx)) $$, 'P0001', 'E-12', 'other merchant coupon -> E-12');
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.confirm_redemption((select expired_id from fx)) $$, 'P0001', 'E-10', 'expired -> E-10');
select pg_temp.at(interval '10 min');
create temp table r as select public.confirm_redemption((select confirm_id from fx)) as v;
select is(pg_temp.stored((select confirm_id from fx)), 'redeemed/true', 'coupon marked redeemed');
select pg_temp.at(interval '10 min 30 s');
select is(public.confirm_redemption((select confirm_id from fx)), (select v from r), 'retry within 60 s returns the same redeemed_at');
select pg_temp.at(interval '11 min 1 s');
select throws_ok($$ select public.confirm_redemption((select confirm_id from fx)) $$, 'P0001', 'E-11', 'after 60 s -> E-11');

select * from finish();
rollback;
