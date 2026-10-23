begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Relies on supabase/seed.sql: C1 has 3 prizes (60/30/10, positions 1..3; 3 = extra_stamp), U1 verified
-- with C1 3/6, U2 unverified without relations, U3 (google) at C1/C2, U4 already spun at C1 and has C3 (inactive).

create function pg_temp.login(sub text, merchant_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', sub, 'role', 'authenticated',
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end)::text, true);
$$;
create function pg_temp.exec(p_sql text) returns void language plpgsql security definer as $$
begin execute p_sql; end $$;
create function pg_temp.keys(obj jsonb) returns text[] language sql as $$
  select array_agg(k order by k) from jsonb_object_keys(obj) k;
$$;
create function pg_temp.cid(p_user text) returns uuid language sql security definer as $$
  select id from public.customers where auth_user_id = ('10000000-0000-0000-0000-0000000000' || p_user)::uuid
$$;
create function pg_temp.pending(p_user text) returns int language sql security definer as $$
  select pending_extra_stamps from public.customer_merchants
  where customer_id = pg_temp.cid(p_user) and merchant_id = '20000000-0000-0000-0000-0000000000c1'
$$;
create function pg_temp.spin(p_merchant text, p_digest text) returns jsonb language sql as $$
  select public.spin_wheel(('20000000-0000-0000-0000-0000000000' || p_merchant)::uuid, repeat(p_digest, 32))
$$;
create function pg_temp.wheel(p_merchant text) returns jsonb language sql as $$
  select public.get_wheel(('20000000-0000-0000-0000-0000000000' || p_merchant)::uuid)
$$;

create temp table ctx as
select ((app.local_today() + 1)::timestamp at time zone 'America/Mexico_City') as base;
create temp table res (k text primary key, v jsonb);
grant all on ctx, res to authenticated;

create function pg_temp.cp() returns public.coupons language sql security definer as $$
  select c from public.coupons c where c.id = (select (v ->> 'coupon_id')::uuid from res where k = 'u3')
$$;

-- Privileges
select ok(not has_function_privilege('anon', 'public.get_wheel(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.spin_wheel(uuid, text)', 'EXECUTE'), 'anon cannot execute get_wheel / spin_wheel');
select ok(has_function_privilege('authenticated', 'public.get_wheel(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.spin_wheel(uuid, text)', 'EXECUTE'), 'authenticated can execute both');

set local role authenticated;

-- Roles
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select pg_temp.wheel('c1') $$, 'P0001', 'E-19', 'merchant cannot get_wheel');
select throws_ok($$ select pg_temp.spin('c1', 'aa') $$, 'P0001', 'E-19', 'merchant cannot spin_wheel');

-- get_wheel
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(pg_temp.keys(pg_temp.wheel('c1')), array['segments', 'status'], 'get_wheel keys');
select is(pg_temp.wheel('c1'), '{"status": "available", "segments": [{"index": 0, "label": "10% de descuento"},
  {"index": 1, "label": "Galleta gratis"}, {"index": 2, "label": "Sello extra"}]}'::jsonb,
  'segments ordered by position, only index + label (no weights nor benefit)');
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select is(pg_temp.wheel('c1') ->> 'status', 'no_relation', 'visible merchant without relation -> no_relation');
select throws_ok($$ select public.get_wheel(gen_random_uuid()) $$, 'P0001', 'E-05', 'unknown merchant -> E-05');
select throws_ok($$ select pg_temp.wheel('c3') $$, 'P0001', 'E-05', 'inactive merchant without relation -> E-05');

-- spin_wheel validations
select throws_ok($$ select public.spin_wheel('20000000-0000-0000-0000-0000000000c1', 'xyz') $$, 'P0001', 'E-23', 'bad digest -> E-23');
select throws_ok($$ select pg_temp.spin('c1', 'aa') $$, 'P0001', 'E-05', 'no relation -> E-05');
select pg_temp.exec($$ insert into public.customer_merchants (customer_id, merchant_id, origin)
  values (pg_temp.cid('a2'), '20000000-0000-0000-0000-0000000000c1', 'add_card') $$);
select throws_ok($$ select pg_temp.spin('c1', 'aa') $$, 'P0001', 'E-06', 'unverified email -> E-06');
select pg_temp.login('10000000-0000-0000-0000-0000000000a4');
select throws_ok($$ select pg_temp.spin('c3', 'dd') $$, 'P0001', 'E-05', 'inactive merchant (RN-71) -> E-05');
select is(pg_temp.wheel('c1') ->> 'status', 'spun', 'wheel_status spun for U4');
select throws_ok($$ select pg_temp.spin('c1', 'dd') $$, 'P0001', 'E-09', 'same account already spun -> E-09');
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select pg_temp.spin('c2', 'bb') $$, 'P0001', 'E-05', 'wheel without active segments -> E-05');

-- Only the extra_stamp prize is active -> it always comes out
select pg_temp.exec($$ update private.wheel_prizes set is_active = false
  where merchant_id = '20000000-0000-0000-0000-0000000000c1' and prize_type = 'coupon' $$);
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(pg_temp.wheel('c1') -> 'segments', '[{"index": 0, "label": "Sello extra"}]'::jsonb, 'inactive segments are not listed; index is within the active ones');
insert into res select 'u1', pg_temp.spin('c1', 'aa');
select is((select v from res where k = 'u1'), '{"segment_index": 0, "prize_type": "extra_stamp", "label": "Sello extra", "coupon_id": null}'::jsonb,
  'single active prize always comes out; extra_stamp has no coupon');
select is(pg_temp.pending('a1'), 1, 'extra_stamp adds a pending stamp');
select is(pg_temp.wheel('c1') ->> 'status', 'spun', 'status becomes spun after the spin');
select throws_ok($$ select pg_temp.spin('c1', 'ee') $$, 'P0001', 'E-09', 'second spin by the same account -> E-09');

-- The next claim_visit gives 2 stamps (RN-36)
select pg_temp.exec($$ insert into public.visit_qr_tokens (merchant_id, token_hash, created_at, expires_at)
  select '20000000-0000-0000-0000-0000000000c1', sha256(convert_to('wheel-tok', 'UTF8')), base + interval '12:00', base + interval '12:00:60' from ctx $$);
select set_config('app.fake_now', ((select base from ctx) + interval '12:00:10')::text, true);
select is((public.claim_visit('wheel-tok', repeat('aa', 32)) ->> 'stamps_added')::int, 2, 'next claim_visit grants 2 stamps');
select is(pg_temp.pending('a1'), 0, 'pending reset after the claim');
select set_config('app.fake_now', '', true);

-- Device already used with another account (RN-07)
select pg_temp.exec($$ update private.wheel_prizes set is_active = true
  where merchant_id = '20000000-0000-0000-0000-0000000000c1' and position = 1 $$);
select pg_temp.exec($$ update private.wheel_prizes set is_active = false
  where merchant_id = '20000000-0000-0000-0000-0000000000c1' and position = 3 $$);
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select pg_temp.spin('c1', 'aa') $$, 'P0001', 'E-09', 'device used by another account -> E-09');

-- Email hash (RN-09): U1's old address is gone and U3 now owns it, as after delete + re-register
select pg_temp.exec($$ update auth.users set email = 'u1-old@ekko.test' where id = '10000000-0000-0000-0000-0000000000a1' $$);
select pg_temp.exec($$ update auth.users set email = ' U1@ekko.test ' where id = '10000000-0000-0000-0000-0000000000a3' $$);
select throws_ok($$ select pg_temp.spin('c1', 'bb') $$, 'P0001', 'E-09', 'same (normalized) email hash with a new account and device -> E-09');
select pg_temp.exec($$ update auth.users set email = 'u3@ekko.test' where id = '10000000-0000-0000-0000-0000000000a3' $$);

-- Coupon prize: 48 h, source wheel, code
insert into res select 'u3', pg_temp.spin('c1', 'bb');
select is(pg_temp.keys((select v from res where k = 'u3')), array['coupon_id', 'label', 'prize_type', 'segment_index'], 'spin result keys');
select is((select v ->> 'prize_type' from res where k = 'u3'), 'coupon', 'the only active prize is a coupon');
select throws_ok($$ select count(*) from public.coupons $$, '42501', null, 'coupons are not readable by tables');
select is((select (pg_temp.cp()).expires_at - (pg_temp.cp()).issued_at), interval '48 hours', 'coupon lasts 48 h (RN-35)');
select is((select (c).source::text || '/' || (c).title || '/' || ((c).code ~ '^[2-9A-HJKMNP-Z]{6}$') from (select pg_temp.cp() as c) q), 'wheel/10% de descuento/true', 'wheel coupon with benefit copy and a valid code');
select throws_ok($$ select count(*) from public.wheel_spins $$, '42501', null, 'wheel_spins is not readable by tables');
select is(pg_temp.wheel('c1') ->> 'status', 'spun', 'U3 status spun');

-- Probabilities stay in the database: weights are not exposed anywhere in the answers
select ok(not (pg_temp.wheel('c1')::text like '%weight%'), 'no weight in get_wheel');
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select pg_temp.spin('c1', 'aa') $$, 'P0001', 'E-06', 'still unverified (device guard does not mask E-06)');

select * from finish();
rollback;
