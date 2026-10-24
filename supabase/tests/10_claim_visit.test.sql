begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

-- Relies on supabase/seed.sql: C1 (6 stamps, wheel), C2 (4 stamps), C3 inactive; U1 C1 3/6, U2 no
-- relations, U3 C1 0/6 and C2 0/4, U4 C1 0/6 and C3. Concurrency (TC-044): tests/concurrency/.

create function pg_temp.login(sub text, merchant_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', sub, 'role', 'authenticated',
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end)::text, true);
$$;

-- WHY a base relative to the real clock: seeded stamps sit on past local days (seed run time), so
-- the scenario runs on tomorrow's local date and never collides with them.
create temp table ctx as
select ((app.local_today() + 1)::timestamp at time zone 'America/Mexico_City') as base, repeat('ab', 32) as digest;
create temp table ids as
select 'u' || right(c.auth_user_id::text, 1) as k, c.id from public.customers c
where c.auth_user_id::text like '10000000-0000-0000-0000-0000000000a_';
insert into ids values
  ('c1', '20000000-0000-0000-0000-0000000000c1'), ('c2', '20000000-0000-0000-0000-0000000000c2'),
  ('c3', '20000000-0000-0000-0000-0000000000c3');
create temp table res (k text primary key, v jsonb);
grant all on ctx, ids, res to authenticated;

create function pg_temp.id(p_k text) returns uuid language sql as $$ select id from ids where k = p_k $$;
create function pg_temp.at(p_offset interval) returns void language sql as $$
  select set_config('app.fake_now', ((select base from ctx) + p_offset)::text, true);
$$;
create function pg_temp.claim(p_token text) returns jsonb language plpgsql as $$
begin
  return public.claim_visit(p_token, (select digest from ctx));
end $$;
create function pg_temp.claim_error(p_token text) returns jsonb language plpgsql as $$
declare v_msg text; v_detail text;
begin
  perform public.claim_visit(p_token, (select digest from ctx));
  return null;
exception when others then
  get stacked diagnostics v_msg = message_text, v_detail = pg_exception_detail;
  return jsonb_build_object('message', v_msg, 'detail', nullif(v_detail, '')::jsonb);
end $$;
create function pg_temp.cycle(p_customer text, p_merchant text) returns public.card_cycles language sql as $$
  select * from public.card_cycles where customer_id = pg_temp.id(p_customer) and merchant_id = pg_temp.id(p_merchant) and status = 'active'
$$;
create function pg_temp.token(p_token text) returns public.visit_qr_tokens language sql as $$
  select * from public.visit_qr_tokens where token_hash = sha256(convert_to(p_token, 'UTF8'))
$$;

-- Fixtures: tokens by (name, merchant, created offset from tomorrow's local midnight); 60 s TTL.
insert into public.visit_qr_tokens (merchant_id, token_hash, created_at, expires_at, invalidated_at)
select pg_temp.id(t.m), sha256(convert_to(t.name, 'UTF8')), c.base + t.o, c.base + t.o + interval '60 seconds',
       case when t.name = 'tok-inv' then c.base + t.o + interval '5 seconds' end
from ctx c, (values
  ('tok-42a', 'c1', interval '12:00'), ('tok-42b', 'c2', '12:00'), ('tok-46', 'c1', '13:00'),
  ('tok-inv', 'c1', '13:00'), ('tok-50', 'c3', '13:00'), ('tok-49', 'c2', '13:00'),
  ('tok-48a', 'c1', '17:59'), ('tok-48b', 'c1', '18:01'), ('tok-47a', 'c1', '23:59'),
  ('tok-47b', 'c1', '1 day 00:01'), ('tok-70', 'c1', '1 day 12:00'), ('tok-99', 'c1', '1 day 12:00'),
  ('tok-98', 'c2', '1 day 12:00'), ('tok-98b', 'c2', '1 day 13:00'), ('tok-74', 'c1', '2 days 12:00'),
  ('tok-pend', 'c1', '2 days 12:00')
) as t (name, m, o);

create temp table tok as
select t.name, q.id from public.visit_qr_tokens q
join (select distinct 'tok-' || x as name from unnest(array['42a','42b','46','inv','50','49','48a','48b','47a','47b','70','99','98','98b','74','pend']) x) t
  on q.token_hash = sha256(convert_to(t.name, 'UTF8'));
grant all on tok to authenticated;
create function pg_temp.qr(p_name text) returns uuid language sql as $$ select id from tok where name = p_name $$;

-- U1's registered device (register_device), seen yesterday
insert into public.customer_devices (customer_id, device_hash, platform, last_seen_at)
select pg_temp.id('u1'), app.peppered_hash(digest), 'ios', base - interval '1 day' from ctx;

-- ----------------------------------------------------------------------------------------------
-- Privileges and Realtime (§8)
select ok(not has_function_privilege('anon', 'public.claim_visit(text, text)', 'EXECUTE'), 'anon cannot execute claim_visit');
select ok(has_function_privilege('authenticated', 'public.claim_visit(text, text)', 'EXECUTE'), 'authenticated can execute claim_visit');
select ok(not has_function_privilege('anon', 'public.get_qr_status(uuid)', 'EXECUTE'), 'anon cannot execute get_qr_status');
select ok(has_function_privilege('authenticated', 'public.get_qr_status(uuid)', 'EXECUTE'), 'authenticated can execute get_qr_status');
select ok(not has_function_privilege('authenticated', 'app.grant_stamps(public.card_cycles, integer, uuid, boolean)', 'EXECUTE'), 'authenticated cannot execute app.grant_stamps');
select ok(not has_column_privilege('authenticated', 'public.visit_qr_tokens', 'claim_result', 'SELECT'), 'authenticated cannot read claim_result');
select is((select array_agg(schemaname || '.' || tablename) from pg_publication_tables where pubname = 'supabase_realtime'),
  array['public.visit_qr_tokens'], 'supabase_realtime publishes only visit_qr_tokens');

set local role authenticated;

-- Input and role checks
select pg_temp.at('12:00:30');
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.claim_visit('tok-42a', 'not-a-digest') $$, 'P0001', 'E-23', 'malformed device digest raises E-23');
select throws_ok($$ select pg_temp.claim('no-such-token') $$, 'P0001', 'E-08', 'unknown token raises E-08');
select throws_ok($$ select pg_temp.claim(null) $$, 'P0001', 'E-08', 'null token raises E-08');
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select pg_temp.claim('tok-42a') $$, 'P0001', 'E-19', 'a merchant JWT raises E-19');
reset role;
select is((pg_temp.token('tok-42a')).used_at, null, 'failed calls do not consume the token');
set local role authenticated;

-- TC-042: 59 s succeeds, 61 s is E-02
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select pg_temp.at('12:00:59');
insert into res values ('42a', pg_temp.claim('tok-42a'));
select is((select array_agg(key order by key) from res, jsonb_object_keys(v) key where k = '42a'),
  array['cycle_completed', 'merchant_id', 'merchant_name', 'relation_created', 'reward_coupon_id', 'stamps_added',
        'stamps_count', 'stamps_required', 'wheel_status'], 'returns exactly the §4.3 keys');
select is((select v from res where k = '42a'), jsonb_build_object(
  'merchant_id', pg_temp.id('c1'), 'merchant_name', (select name from public.merchants where id = pg_temp.id('c1')),
  'stamps_added', 1, 'stamps_count', 4, 'stamps_required', 6, 'cycle_completed', false,
  'reward_coupon_id', null, 'relation_created', false, 'wheel_status', 'available'), 'TC-042 claim at 59 s grants 1 stamp (4 of 6)');
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select pg_temp.at('12:01:01');
select throws_ok($$ select pg_temp.claim('tok-42b') $$, 'P0001', 'E-02', 'TC-042 claim at 61 s raises E-02');

reset role;
select is((select (used_at, used_by_customer_id) from public.visit_qr_tokens where id = (pg_temp.token('tok-42a')).id),
  (app.now() - interval '2 seconds', pg_temp.id('u1')), 'the token is marked used by the customer at claim time');
select is((select count(*) from public.stamps where qr_token_id = (pg_temp.token('tok-42a')).id and not is_bonus), 1::bigint, 'one visit stamp linked to the token');
select is((select (local_date, granted_at) from public.stamps where qr_token_id = (pg_temp.token('tok-42a')).id),
  ((select base from ctx)::date, (select base from ctx) + interval '12:00:59'), 'stamp has local_date and granted_at (RN-19)');
select is((pg_temp.token('tok-42a')).claim_result, (select v from res where k = '42a'), 'the result is stored on the token row');
select is((select last_seen_at from public.customer_devices where customer_id = pg_temp.id('u1')),
  (select base from ctx) + interval '12:00:59', 'the device last_seen_at is refreshed');
set local role authenticated;

-- TC-043: another customer with a used token
select throws_ok($$ select pg_temp.claim('tok-42a') $$, 'P0001', 'E-03', 'TC-043 a second customer raises E-03');

-- TC-045: retry by the same customer (even after the 60 s) replays the original result
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select pg_temp.at('13:00:10');
select is(pg_temp.claim('tok-42a'), (select v from res where k = '42a'), 'TC-045 retry returns the original result');
reset role;
select is((pg_temp.cycle('u1', 'c1')).stamps_count, 4::smallint, 'TC-045 retry grants no extra stamp');
set local role authenticated;

-- TC-046: second token, same customer, same local day
select is(pg_temp.claim_error('tok-46'), jsonb_build_object('message', 'E-04', 'detail',
  jsonb_build_object('next_available_on', (select base::date + 1 from ctx))), 'TC-046 second visit the same day raises E-04 with next_available_on');
reset role;
select is((pg_temp.token('tok-46')).used_at, null, 'TC-046 the rejected token is not consumed');
set local role authenticated;

-- Invalidated token (a newer QR was generated)
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select pg_temp.at('13:00:20');
select throws_ok($$ select pg_temp.claim('tok-inv') $$, 'P0001', 'E-02', 'an invalidated token raises E-02');

-- TC-050: inactive merchant, token not consumed
select pg_temp.login('10000000-0000-0000-0000-0000000000a4');
select throws_ok($$ select pg_temp.claim('tok-50') $$, 'P0001', 'E-05', 'TC-050 inactive merchant raises E-05');
reset role;
select is((pg_temp.token('tok-50')).used_at, null, 'TC-050 the token is not consumed');
set local role authenticated;

-- TC-049: first scan without relation
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
insert into res values ('49', pg_temp.claim('tok-49'));
select is((select v -> 'relation_created' from res where k = '49'), 'true'::jsonb, 'TC-049 relation_created is true');
select is((select (v -> 'stamps_count', v -> 'stamps_required') from res where k = '49'), ('1'::jsonb, '4'::jsonb), 'TC-049 the new card has 1 of 4');
reset role;
select is((select origin from public.customer_merchants where customer_id = pg_temp.id('u2') and merchant_id = pg_temp.id('c2')),
  'first_stamp'::public.relation_origin, 'TC-049 relation origin is first_stamp');
select is((pg_temp.cycle('u2', 'c2')).stamps_count, 1::smallint, 'TC-049 a new active cycle holds the stamp');
set local role authenticated;

-- TC-048: 23:59 and 00:01 UTC fall on the same local day (17:59 and 18:01 in UTC-6) -> E-04
select pg_temp.login('10000000-0000-0000-0000-0000000000a4');
select pg_temp.at('17:59:10');
select is((((select base from ctx) + interval '17:59:10') at time zone 'UTC')::time, '23:59:10'::time, 'TC-048 first scan is 23:59 UTC');
select is(pg_temp.claim('tok-48a') -> 'stamps_added', '1'::jsonb, 'TC-048 the 23:59 UTC scan succeeds');
select pg_temp.at('18:01:10');
select throws_ok($$ select pg_temp.claim('tok-48b') $$, 'P0001', 'E-04', 'TC-048 the 00:01 UTC scan of the same local day raises E-04');

-- TC-047: 23:59 and 00:01 local are different days
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select pg_temp.at('23:59:10');
select is(pg_temp.claim('tok-47a') -> 'stamps_count', '1'::jsonb, 'TC-047 the 23:59 local scan succeeds');
select pg_temp.at('1 day 00:01:10');
select is(pg_temp.claim('tok-47b') -> 'stamps_count', '2'::jsonb, 'TC-047 the 00:01 local scan succeeds');

-- TC-070: completing 6 of 6
reset role;
update public.card_cycles set stamps_count = 5 where id = (pg_temp.cycle('u1', 'c1')).id;
insert into res values ('70-cycle', to_jsonb(pg_temp.cycle('u1', 'c1')));
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select pg_temp.at('1 day 12:00:10');
insert into res values ('70', pg_temp.claim('tok-70'));
select is((select (v -> 'stamps_added', v -> 'stamps_count', v -> 'cycle_completed') from res where k = '70'),
  ('1'::jsonb, '6'::jsonb, 'true'::jsonb), 'TC-070 the claim completes the card (6 of 6)');
reset role;
select is((select (status, closed_at) from public.card_cycles where id = (select (v ->> 'id')::uuid from res where k = '70-cycle')),
  ('completed'::public.cycle_status, app.now()), 'TC-070 the cycle is completed and closed now');
select is((select (source, cycle_id, title, description, terms, expires_at, status) from public.coupons where id = (select (v ->> 'reward_coupon_id')::uuid from res where k = '70')),
  ('card_reward'::public.coupon_source, (select (v ->> 'id')::uuid from res where k = '70-cycle'), 'Bebida gratis'::text,
   'Cualquier bebida mediana de la carta.'::text, 'Consumo mínimo de $80 por visita.'::text, app.now() + interval '30 days', 'active'::public.coupon_status),
  'TC-070 a card_reward coupon copies the cycle reward and expires in 30 days (RN-26)');
select ok((select code ~ '^[2-9A-HJKMNP-Z]{6}$' from public.coupons where id = (select (v ->> 'reward_coupon_id')::uuid from res where k = '70')), 'TC-070 the coupon has a valid code');
select is(((pg_temp.cycle('u1', 'c1')).stamps_count, (pg_temp.cycle('u1', 'c1')).started_at), (0::smallint, app.now()), 'TC-070 a new empty cycle starts now');

-- TC-099: extra stamp at 5 of 6 completes, the excess is lost
update public.card_cycles set stamps_count = 5 where id = (pg_temp.cycle('u4', 'c1')).id;
update public.customer_merchants set pending_extra_stamps = 1 where customer_id = pg_temp.id('u4') and merchant_id = pg_temp.id('c1');
insert into res values ('99-cycle', to_jsonb(pg_temp.cycle('u4', 'c1')));
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a4');
insert into res values ('99', pg_temp.claim('tok-99'));
select is((select (v -> 'stamps_added', v -> 'stamps_count', v -> 'cycle_completed') from res where k = '99'),
  ('1'::jsonb, '6'::jsonb, 'true'::jsonb), 'TC-099 only 1 stamp fits: card completed');
reset role;
select is((select count(*) from public.stamps where cycle_id = (select (v ->> 'id')::uuid from res where k = '99-cycle') and is_bonus), 0::bigint, 'TC-099 the excess bonus stamp is lost');
select is((select pending_extra_stamps from public.customer_merchants where customer_id = pg_temp.id('u4') and merchant_id = pg_temp.id('c1')), 0::smallint, 'TC-099 pending_extra_stamps is reset');
select is((pg_temp.cycle('u4', 'c1')).stamps_count, 0::smallint, 'TC-099 a new cycle starts at 0');

-- TC-098: pending extra stamp -> 2 stamps; the daily limit still applies to the visit stamp
update public.customer_merchants set pending_extra_stamps = 1 where customer_id = pg_temp.id('u3') and merchant_id = pg_temp.id('c2');
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
insert into res values ('98', pg_temp.claim('tok-98'));
select is((select (v -> 'stamps_added', v -> 'stamps_count') from res where k = '98'), ('2'::jsonb, '2'::jsonb), 'TC-098 grants 2 stamps');
reset role;
select is((select string_agg(format('bonus=%s token=%s', is_bonus, qr_token_id is not null), ', ' order by is_bonus) from public.stamps where cycle_id = (pg_temp.cycle('u3', 'c2')).id),
  'bonus=f token=t, bonus=t token=f', 'TC-098 one visit stamp with the token, one bonus stamp without');
select is((select pending_extra_stamps from public.customer_merchants where customer_id = pg_temp.id('u3') and merchant_id = pg_temp.id('c2')), 0::smallint, 'TC-098 pending_extra_stamps is reset');
update public.customer_merchants set pending_extra_stamps = 1 where customer_id = pg_temp.id('u3') and merchant_id = pg_temp.id('c2');
set local role authenticated;
select pg_temp.at('1 day 13:00:10');
select throws_ok($$ select pg_temp.claim('tok-98b') $$, 'P0001', 'E-04', 'TC-098 the extra stamp does not bypass the daily limit of the visit');
reset role;
select is((select pending_extra_stamps from public.customer_merchants where customer_id = pg_temp.id('u3') and merchant_id = pg_temp.id('c2')), 1::smallint, 'TC-098 the extra stays pending after E-04');

-- TC-074: an expired cycle is rolled during the claim
insert into res values ('74-cycle', to_jsonb(pg_temp.cycle('u3', 'c1')));
update public.card_cycles set expires_at = (select base from ctx) + interval '2 days' where id = (pg_temp.cycle('u3', 'c1')).id;
set local role authenticated;
select pg_temp.at('2 days 12:00:10');
select is(pg_temp.claim('tok-74') -> 'stamps_count', '1'::jsonb, 'TC-074 the stamp counts in the new cycle');
reset role;
select is((select status from public.card_cycles where id = (select (v ->> 'id')::uuid from res where k = '74-cycle')), 'expired'::public.cycle_status, 'TC-074 the old cycle is expired');
select is((select count(*) from public.stamps where cycle_id = (pg_temp.cycle('u3', 'c1')).id), 1::bigint, 'TC-074 the new cycle holds exactly the new stamp');

-- app.grant_stamps with p_is_bonus = true: all stamps are bonus, no token
select is(app.grant_stamps(pg_temp.cycle('u3', 'c1'), 2, null, true) -> 'stamps_count', '3'::jsonb, 'grant_stamps bonus adds 2 stamps');
select is((select count(*) from public.stamps where cycle_id = (pg_temp.cycle('u3', 'c1')).id and is_bonus and qr_token_id is null), 2::bigint, 'grant_stamps bonus stamps carry no token');

-- get_qr_status (§4.4)
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select is(public.get_qr_status(pg_temp.qr('tok-pend')), '{"status":"pending"}'::jsonb, 'get_qr_status: pending');
select is(public.get_qr_status(pg_temp.qr('tok-42a')), '{"status":"used","stamps":0,"stamps_required":6,"reward_available":true}'::jsonb, 'get_qr_status: used');
select is(public.get_qr_status(pg_temp.qr('tok-46')), '{"status":"expired"}'::jsonb, 'get_qr_status: expired');
select is(public.get_qr_status(pg_temp.qr('tok-inv')), '{"status":"invalidated"}'::jsonb, 'get_qr_status: invalidated');
select throws_ok($$ select public.get_qr_status(pg_temp.qr('tok-49')) $$, 'P0001', 'E-19', 'get_qr_status of another merchant QR raises E-19');
select throws_ok($$ select public.get_qr_status(gen_random_uuid()) $$, 'P0001', 'E-19', 'get_qr_status of an unknown QR raises E-19');
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.get_qr_status(pg_temp.qr('tok-pend')) $$, 'P0001', 'E-19', 'get_qr_status by a customer raises E-19');

-- Realtime/RLS: the owning merchant reads status columns but never claim_result
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select is((select used_at is not null from public.visit_qr_tokens where id = pg_temp.qr('tok-42a')), true, 'the owning merchant sees used_at (Realtime UPDATE payload)');
select throws_ok($$ select claim_result from public.visit_qr_tokens $$, '42501', null, 'the merchant cannot select claim_result');

select * from finish();
rollback;
