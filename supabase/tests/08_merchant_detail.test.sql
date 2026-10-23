begin;
create extension if not exists pgtap with schema extensions;
select plan(78);

-- Relies on supabase/seed.sql (docs/ekko_plan_qa.md §4.2). Merchants 20000000-…-0000000000cN,
-- auth users 10000000-…-0000000000aN (U1..U4). Time-dependent fixtures are built here, relative
-- to the local day the test runs in, so the seed stays date-independent.

-- Signs in as a seeded user: customers by default, merchants with their merchant_id claim.
create function pg_temp.login(sub text, merchant_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', sub, 'role', 'authenticated',
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end)::text, true);
$$;

-- Customer id of a seeded auth user (SECURITY DEFINER: customers is not readable by other users).
create function pg_temp.cid(p_auth_user_id uuid) returns uuid language sql security definer as $$
  select c.id from public.customers c where c.auth_user_id = p_auth_user_id;
$$;

create function pg_temp.keys(obj jsonb) returns text[] language sql as $$
  select array_agg(k order by k) from jsonb_object_keys(obj) k;
$$;

-- Moves the controllable clock to local time `t` of (real local today + `days`).
create function pg_temp.set_local_clock(days int, t time) returns void language plpgsql security definer as $$
declare v_today date;
begin
  perform set_config('app.fake_now', '', true);
  v_today := app.local_today();
  perform set_config('app.fake_now', (((v_today + days) + t) at time zone 'America/Mexico_City')::text, true);
end;
$$;

-- Test clock readable while acting as `authenticated` (which has no USAGE on schema app).
create function pg_temp.now() returns timestamptz language sql security definer as $$ select app.now() $$;
create function pg_temp.today() returns date language sql security definer as $$ select app.local_today() $$;

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;

-- ----------------------------------------------------------------------------------------------
-- Privileges
select ok(not has_function_privilege('anon', 'public.get_merchant_detail(uuid)', 'EXECUTE'), 'anon cannot execute get_merchant_detail');
select ok(not has_function_privilege('anon', 'public.add_card(uuid)', 'EXECUTE'), 'anon cannot execute add_card');
select ok(has_function_privilege('authenticated', 'public.get_merchant_detail(uuid)', 'EXECUTE'), 'authenticated can execute get_merchant_detail');
select ok(has_function_privilege('authenticated', 'public.add_card(uuid)', 'EXECUTE'), 'authenticated can execute add_card');
select ok(not has_function_privilege('authenticated', 'app.roll_cycle(uuid, uuid)', 'EXECUTE'), 'authenticated cannot execute app.roll_cycle');

-- ----------------------------------------------------------------------------------------------
-- app.roll_cycle (as postgres): first cycle, idempotency, one active cycle (TC-079)
select pg_temp.set_local_clock(0, '12:00');
insert into public.customer_merchants (customer_id, merchant_id, origin)
values (pg_temp.cid('10000000-0000-0000-0000-0000000000a2'), '20000000-0000-0000-0000-000000000c07', 'add_card');

insert into r select 'roll1', to_jsonb(app.roll_cycle(pg_temp.cid('10000000-0000-0000-0000-0000000000a2'), '20000000-0000-0000-0000-000000000c07'));
select is(
  (select jsonb_build_object('status', v ->> 'status', 'stamps_required', (v ->> 'stamps_required')::int, 'stamps_count', (v ->> 'stamps_count')::int,
     'reward_title', v ->> 'reward_title', 'terms', v ->> 'terms', 'closed_at', v -> 'closed_at') from r where k = 'roll1'),
  '{"status":"active","stamps_required":6,"stamps_count":0,"reward_title":"Premio de la casa","terms":"Consumo mínimo de $100 por visita.","closed_at":null}'::jsonb,
  'roll_cycle creates the first cycle copying the loyalty program'
);
select is((select (v ->> 'started_at')::timestamptz from r where k = 'roll1'), pg_temp.now(), 'first cycle starts at pg_temp.now()');
select is((select (v ->> 'expires_at')::timestamptz from r where k = 'roll1'), pg_temp.now() + interval '6 months', 'first cycle expires after cycle_months (RN-24)');
select is(
  (app.roll_cycle(pg_temp.cid('10000000-0000-0000-0000-0000000000a2'), '20000000-0000-0000-0000-000000000c07')).id,
  (select (v ->> 'id')::uuid from r where k = 'roll1'), 'roll_cycle is idempotent: a second call returns the same active cycle'
);
select is(
  (select count(*) from public.card_cycles where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a2')
     and merchant_id = '20000000-0000-0000-0000-000000000c07'),
  1::bigint, 'repeated roll_cycle calls leave a single cycle'
);
select throws_ok(
  $$ insert into public.card_cycles (customer_id, merchant_id, status, stamps_required, reward_title, reward_description, terms, expires_at)
     values (pg_temp.cid('10000000-0000-0000-0000-0000000000a2'), '20000000-0000-0000-0000-000000000c07', 'active', 6, 't', 'd', 'x', pg_temp.now() + interval '1 day') $$,
  '23505', null, 'TC-079 a second active cycle for the relation is rejected by the unique index'
);

-- ----------------------------------------------------------------------------------------------
-- Fixtures (as postgres), clock at 23:59 of the real local day
select pg_temp.set_local_clock(0, '23:59');
-- The seed marks some products sold out relative to its own run day; start from a clean slate.
update public.products set sold_out_on = null where merchant_id = '20000000-0000-0000-0000-0000000000c1';
insert into public.products (id, merchant_id, category_id, name, price, position, sold_out_on, is_featured) values
  ('48000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000002', 'Agotado hoy', 10, 10, pg_temp.today(), true),
  ('48000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000002', 'Agotado ayer', 10, 11, pg_temp.today() - 1, false),
  ('48000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000002', 'Nunca agotado', 10, 12, null, false);
insert into public.weekly_offers (merchant_id, title, description, weekday, position) values
  ('20000000-0000-0000-0000-0000000000c1', 'Miércoles', 'Mitad de semana.', 3, 0),
  ('20000000-0000-0000-0000-0000000000c1', 'Lunes temprano', 'Primero del lunes.', 1, 0);
-- The seeded wheel coupon expires 2 h after seeding; re-anchor it to the test clock.
update public.coupons set expires_at = pg_temp.now() + interval '2 hours'
where source = 'wheel' and customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a4');
update public.customer_merchants set pending_extra_stamps = 2
where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a1') and merchant_id = '20000000-0000-0000-0000-0000000000c1';
-- C5 active but invisible, C6 visible but inactive (E-05 for add_card)
update public.merchants set is_visible = false where id = '20000000-0000-0000-0000-000000000c05';
update public.merchants set is_active = false where id = '20000000-0000-0000-0000-000000000c06';

insert into r select 'u1expiry', jsonb_build_array(expires_at) from public.card_cycles where id = '50000000-0000-0000-0000-000000000001';

set local role authenticated;

-- ----------------------------------------------------------------------------------------------
-- Role and visibility errors
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') $$, 'P0001', 'E-19', 'merchant JWT: get_merchant_detail raises E-19');
select throws_ok($$ select public.add_card('20000000-0000-0000-0000-0000000000c1') $$, 'P0001', 'E-19', 'merchant JWT: add_card raises E-19');

select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.get_merchant_detail('20000000-0000-0000-0000-0000000000c3') $$, 'P0001', 'E-05', 'TC-024 invisible merchant without relation raises E-05');
select throws_ok($$ select public.get_merchant_detail(gen_random_uuid()) $$, 'P0001', 'E-05', 'unknown merchant raises E-05');
select throws_ok($$ select public.get_merchant_detail('20000000-0000-0000-0000-000000000c05') $$, 'P0001', 'E-05', 'active but invisible merchant without relation raises E-05');

-- ----------------------------------------------------------------------------------------------
-- U1 @ C1: full shape with relation
insert into r values ('u1c1', public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1'));
select is(pg_temp.keys((select v from r where k = 'u1c1')), array['card', 'coupons', 'menu', 'merchant', 'offers', 'wheel'], 'detail has the documented top-level keys');
select is((select v -> 'merchant' from r where k = 'u1c1'),
  '{"id":"20000000-0000-0000-0000-0000000000c1","name":"Café Ekko Centro","category":"cafeterias_postres",
    "description":"Café de especialidad y postres de la casa.","address":"Av. Juárez 100, Centro",
    "logo_path":"merchants/c1/logo","cover_path":"merchants/c1/cover","maps_url":"https://maps.example/c1",
    "reviews_url":"https://reviews.example/c1","available":true,"is_favorite":false}'::jsonb,
  'merchant has exactly the documented fields; active and visible is available');
select is(pg_temp.keys((select v -> 'card' from r where k = 'u1c1')),
  array['background_path', 'cycle_expires_at', 'has_relation', 'logo_path', 'pending_extra_stamps', 'reward_coupon_id', 'reward_description',
        'reward_title', 'stamp_image_path', 'stamped_today', 'stamps', 'stamps_required', 'terms'],
  'card carries the documented fields');
select is((select (v -> 'card') - 'stamps'::text - 'cycle_expires_at'::text from r where k = 'u1c1'),
  '{"has_relation":true,"stamps_required":6,"reward_title":"Bebida gratis","reward_description":"Cualquier bebida mediana de la carta.",
    "terms":"Consumo mínimo de $80 por visita.","background_path":null,"stamp_image_path":null,"logo_path":"merchants/c1/logo","pending_extra_stamps":2,"reward_coupon_id":null,"stamped_today":false}'::jsonb,
  'card values come from the active cycle and the relation (pending_extra_stamps)');
select is((select (v -> 'card' ->> 'cycle_expires_at')::timestamptz from r where k = 'u1c1'),
  (select (v ->> 0)::timestamptz from r where k = 'u1expiry'), 'cycle_expires_at is the active cycle expiry');
select is((select jsonb_array_length(v -> 'card' -> 'stamps') from r where k = 'u1c1'), 3, 'U1 card shows its 3 stamps');
select is((select pg_temp.keys(v -> 'card' -> 'stamps' -> 0) from r where k = 'u1c1'), array['granted_at', 'is_bonus'], 'stamps carry granted_at and is_bonus');
select is(
  (select array_agg((s ->> 'granted_at')::timestamptz order by n) from r, jsonb_array_elements(v -> 'card' -> 'stamps') with ordinality t (s, n) where k = 'u1c1'),
  (select array_agg((s ->> 'granted_at')::timestamptz order by (s ->> 'granted_at')::timestamptz) from r, jsonb_array_elements(v -> 'card' -> 'stamps') s where k = 'u1c1'),
  'stamps are ordered by granted_at'
);
select is((select v -> 'wheel' from r where k = 'u1c1'), '{"status":"available"}'::jsonb, 'verified U1 with relation and no spin: wheel available');

-- Menu: categories and products by position, featured and sold-out flags (TC-026)
select is((select v -> 'menu' -> 'categories' from r where k = 'u1c1'),
  '[{"id":"40000000-0000-0000-0000-000000000001","name":"Bebidas","position":1},{"id":"40000000-0000-0000-0000-000000000002","name":"Postres","position":2}]'::jsonb,
  'categories ordered by position with id, name and position');
select is((select pg_temp.keys(v -> 'menu' -> 'products' -> 0) from r where k = 'u1c1'),
  array['category_id', 'description', 'id', 'image_path', 'is_featured', 'is_sold_out', 'name', 'price'], 'products carry the documented fields');
select is((select array_agg(p ->> 'name' order by n) from r, jsonb_array_elements(v -> 'menu' -> 'products') with ordinality t (p, n) where k = 'u1c1'),
  array['Americano', 'Latte', 'Chai', 'Pay de queso', 'Brownie', 'Galleta', 'Agotado hoy', 'Agotado ayer', 'Nunca agotado'],
  'products ordered by category position, then product position');
select is((select v -> 'menu' -> 'products' -> 0 -> 'price' from r where k = 'u1c1'), '45.00'::jsonb, 'price is a JSON number');
select is((select array_agg(p ->> 'name' order by p ->> 'name') from r, jsonb_array_elements(v -> 'menu' -> 'products') p
           where k = 'u1c1' and (p ->> 'is_featured')::boolean), array['Agotado hoy', 'Americano', 'Latte', 'Pay de queso'], 'is_featured reflects the manual flag (RN-57)');
select is((select array_agg(p ->> 'name' order by p ->> 'name') from r, jsonb_array_elements(v -> 'menu' -> 'products') p
           where k = 'u1c1' and (p ->> 'is_sold_out')::boolean), array['Agotado hoy'], 'TC-026 only the product sold out today is sold out');

-- Offers ordered by weekday, then position (RN-58)
select is((select pg_temp.keys(v -> 'offers' -> 0) from r where k = 'u1c1'), array['description', 'id', 'image_path', 'title', 'weekday'], 'offers carry the documented fields');
select is((select array_agg(o ->> 'title' order by n) from r, jsonb_array_elements(v -> 'offers') with ordinality t (o, n) where k = 'u1c1'),
  array['Lunes temprano', 'Lunes de latte', 'Miércoles', 'Viernes dulce'], 'offers ordered by weekday then position');
select is((select v -> 'coupons' from r where k = 'u1c1'), '[]'::jsonb, 'U1 has no coupons at C1');

-- TC-027: after local midnight, yesterday's sold-out product is available again
select pg_temp.set_local_clock(1, '00:01');
select is((select array_agg(p ->> 'name') from jsonb_array_elements(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'menu' -> 'products') p
           where (p ->> 'is_sold_out')::boolean), null, 'TC-027 after 00:00 America/Mexico_City nothing is sold out');
select pg_temp.set_local_clock(0, '23:59');

-- stamped_today: a non-bonus stamp with local_date = today
reset role;
insert into public.stamps (cycle_id, customer_id, merchant_id, is_bonus, local_date, granted_at)
values ('50000000-0000-0000-0000-000000000002', pg_temp.cid('10000000-0000-0000-0000-0000000000a3'), '20000000-0000-0000-0000-0000000000c1', true, pg_temp.today(), pg_temp.now());
insert into public.stamps (cycle_id, customer_id, merchant_id, is_bonus, local_date, granted_at)
values ('50000000-0000-0000-0000-000000000001', pg_temp.cid('10000000-0000-0000-0000-0000000000a1'), '20000000-0000-0000-0000-0000000000c1', false, pg_temp.today(), pg_temp.now());
set local role authenticated;
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'stamped_today', 'true'::jsonb, 'stamped_today is true with a visit stamp today');
select is(jsonb_array_length(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'stamps'), 4, 'the new stamp joins the card');
select pg_temp.set_local_clock(1, '00:01');
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'stamped_today', 'false'::jsonb, 'stamped_today resets on the next local day');
select pg_temp.set_local_clock(0, '23:59');

select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'stamped_today', 'false'::jsonb, 'a bonus stamp today does not count as stamped_today');
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'stamps',
  jsonb_build_array(jsonb_build_object('granted_at', pg_temp.now(), 'is_bonus', true)), 'bonus stamps are listed with is_bonus true');

-- ----------------------------------------------------------------------------------------------
-- U4 @ C1: spun wheel, reward coupon (RN-27) and coupon list
select pg_temp.login('10000000-0000-0000-0000-0000000000a4');
insert into r values ('u4c1', public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1'));
reset role;
create temp table u4_coupons as
select c.id, c.source from public.coupons c
where c.customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a4') and c.merchant_id = '20000000-0000-0000-0000-0000000000c1';
grant select on u4_coupons to authenticated;
set local role authenticated;
select is((select v -> 'wheel' from r where k = 'u4c1'), '{"status":"spun"}'::jsonb, 'a customer that already spun gets wheel spun');
select is((select (v -> 'card' ->> 'reward_coupon_id')::uuid from r where k = 'u4c1'),
  (select id from u4_coupons where source = 'card_reward'), 'reward_coupon_id is the active card_reward coupon (RN-27)');
select is((select array_agg(c ->> 'source' order by n) from r, jsonb_array_elements(v -> 'coupons') with ordinality t (c, n) where k = 'u4c1'),
  array['wheel', 'card_reward'], 'coupons are the active ones, ordered by expires_at');
select is((select pg_temp.keys(v -> 'coupons' -> 0) from r where k = 'u4c1'), array['description', 'expires_at', 'id', 'source', 'terms', 'title'],
  'coupons carry the documented fields and never the code');
select ok((select not (v::text ~ '"code"') from r where k = 'u4c1'), 'the detail contains no code key anywhere');

-- Expired and redeemed coupons drop out; reward_coupon_id goes null
reset role;
update public.coupons set expires_at = pg_temp.now() - interval '1 second' where id = (select id from u4_coupons where source = 'wheel');
set local role authenticated;
select is(jsonb_array_length(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'coupons'), 1, 'an expired coupon is excluded');
reset role;
update public.coupons set status = 'redeemed', redeemed_at = pg_temp.now() where id = (select id from u4_coupons where source = 'card_reward');
set local role authenticated;
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'coupons', '[]'::jsonb, 'a redeemed coupon is excluded');
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'reward_coupon_id', 'null'::jsonb, 'reward_coupon_id is null once redeemed');
reset role;
update public.coupons set status = 'active', redeemed_at = null, expires_at = pg_temp.now() where id = (select id from u4_coupons where source = 'card_reward');
set local role authenticated;
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'reward_coupon_id', 'null'::jsonb, 'reward_coupon_id is null once expired (expires_at = now)');

-- TC-025 / RN-71: invisible + inactive merchant with relation is shown as unavailable
insert into r values ('u4c3', public.get_merchant_detail('20000000-0000-0000-0000-0000000000c3'));
select is((select v -> 'merchant' -> 'available' from r where k = 'u4c3'), 'false'::jsonb, 'TC-025 related invisible merchant is shown with available false');
select is((select v -> 'card' -> 'has_relation' from r where k = 'u4c3'), 'true'::jsonb, 'TC-025 the card keeps the relation');
select is((select v -> 'wheel' from r where k = 'u4c3'), '{"status":"unavailable"}'::jsonb, 'inactive merchant: wheel unavailable');
select is((select jsonb_array_length(v -> 'coupons') from r where k = 'u4c3'), 1, 'the active coupon of the inactive merchant is still listed');

-- ----------------------------------------------------------------------------------------------
-- U2 (unverified, no relations): preview, TC-029 and add_card
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
insert into r values ('u2c1', public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1'));
select is((select v -> 'card' from r where k = 'u2c1'),
  '{"has_relation":false,"stamps_required":6,"stamps":[],"cycle_expires_at":null,"reward_title":"Bebida gratis",
    "reward_description":"Cualquier bebida mediana de la carta.","terms":"Consumo mínimo de $80 por visita.","background_path":null,"stamp_image_path":null,"logo_path":"merchants/c1/logo",
    "pending_extra_stamps":0,"reward_coupon_id":null,"stamped_today":false}'::jsonb,
  'without relation the card is the program preview');
select is((select v -> 'wheel' from r where k = 'u2c1'), '{"status":"no_relation"}'::jsonb, 'without relation the wheel is no_relation');
select is((select v -> 'coupons' from r where k = 'u2c1'), '[]'::jsonb, 'without relation there are no coupons');
reset role;
select is((select count(*) from public.customer_merchants where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a2')
             and merchant_id = '20000000-0000-0000-0000-0000000000c1'), 0::bigint, 'TC-029 viewing the detail creates no relation');
select is((select count(*) from public.card_cycles where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a2')
             and merchant_id = '20000000-0000-0000-0000-0000000000c1'), 0::bigint, 'TC-029 viewing the detail creates no cycle');
set local role authenticated;

select throws_ok($$ select public.add_card('20000000-0000-0000-0000-0000000000c3') $$, 'P0001', 'E-05', 'add_card on an inactive invisible merchant raises E-05');
select throws_ok($$ select public.add_card('20000000-0000-0000-0000-000000000c05') $$, 'P0001', 'E-05', 'add_card on an invisible merchant raises E-05');
select throws_ok($$ select public.add_card('20000000-0000-0000-0000-000000000c06') $$, 'P0001', 'E-05', 'add_card on an inactive merchant raises E-05');
select throws_ok($$ select public.add_card(gen_random_uuid()) $$, 'P0001', 'E-05', 'add_card on an unknown merchant raises E-05');

select is(public.add_card('20000000-0000-0000-0000-0000000000c1'), '{"created":true,"wheel":{"status":"needs_verification"}}'::jsonb,
  'add_card creates the relation; unverified customer gets needs_verification');
select is(public.add_card('20000000-0000-0000-0000-0000000000c1'), '{"created":false,"wheel":{"status":"needs_verification"}}'::jsonb,
  'add_card is idempotent: the second call returns created false');
select is(public.add_card('20000000-0000-0000-0000-0000000000c2'), '{"created":true,"wheel":{"status":"unavailable"}}'::jsonb,
  'merchant without active wheel prizes: wheel unavailable');
reset role;
select is((select origin::text from public.customer_merchants where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a2')
             and merchant_id = '20000000-0000-0000-0000-0000000000c1'), 'add_card', 'the relation has origin add_card');
select is((select count(*) from public.card_cycles where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a2')
             and merchant_id = '20000000-0000-0000-0000-0000000000c1' and status = 'active'), 1::bigint, 'add_card opens exactly one active cycle');
set local role authenticated;
insert into r values ('u2c1b', public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1'));
select is((select v -> 'card' -> 'has_relation' from r where k = 'u2c1b'), 'true'::jsonb, 'after add_card the detail has the relation');
select is((select v -> 'card' -> 'stamps' from r where k = 'u2c1b'), '[]'::jsonb, 'the new card is empty');
select is((select v -> 'wheel' from r where k = 'u2c1b'), '{"status":"needs_verification"}'::jsonb, 'unverified customer with relation: needs_verification');

-- ----------------------------------------------------------------------------------------------
-- TC-075 / TC-076: config change keeps the running copy; the next cycle takes the new config
reset role;
update public.loyalty_programs set stamps_required = 8, reward_title = 'Postre gratis', reward_description = 'Cualquier postre.',
  terms = 'Nuevos términos.', cycle_months = 3
where merchant_id = '20000000-0000-0000-0000-0000000000c1';
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select is((public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card') - 'stamps'::text - 'cycle_expires_at'::text - 'background_path'::text - 'stamp_image_path'::text - 'logo_path'::text - 'pending_extra_stamps'::text - 'reward_coupon_id'::text - 'stamped_today'::text - 'has_relation'::text,
  '{"stamps_required":6,"reward_title":"Bebida gratis","reward_description":"Cualquier bebida mediana de la carta.","terms":"Consumo mínimo de $80 por visita."}'::jsonb,
  'TC-075/TC-076 the running cycle keeps its copied stamps, reward and terms');
select is(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'stamps_required', '6'::jsonb, 'TC-075 the running cycle stays at 6');

-- TC-073: the expired cycle with 3 stamps rolls to a new empty one with the current config
reset role;
update public.card_cycles set expires_at = pg_temp.now() where id = '50000000-0000-0000-0000-000000000001';
delete from public.stamps where cycle_id = '50000000-0000-0000-0000-000000000001' and local_date = pg_temp.today();
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
insert into r values ('u1rolled', public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1'));
select is((select (v -> 'card') - 'cycle_expires_at'::text from r where k = 'u1rolled'),
  '{"has_relation":true,"stamps_required":8,"stamps":[],"reward_title":"Postre gratis","reward_description":"Cualquier postre.",
    "terms":"Nuevos términos.","background_path":null,"stamp_image_path":null,"logo_path":"merchants/c1/logo","pending_extra_stamps":2,"reward_coupon_id":null,"stamped_today":false}'::jsonb,
  'TC-073/TC-075 an expired cycle shows a new empty card with the current config');
select is((select (v -> 'card' ->> 'cycle_expires_at')::timestamptz from r where k = 'u1rolled'), pg_temp.now() + interval '3 months',
  'the new cycle uses the current cycle_months');
reset role;
select is((select status::text || ' ' || stamps_count || ' ' || (closed_at = pg_temp.now()) from public.card_cycles where id = '50000000-0000-0000-0000-000000000001'),
  'expired 3 true', 'TC-073 the old cycle is closed as expired with its 3 stamps');
select is((select count(*) from public.card_cycles where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a1')
             and merchant_id = '20000000-0000-0000-0000-0000000000c1' and status = 'active'), 1::bigint, 'TC-079 exactly one active cycle after the roll');
select is(
  (app.roll_cycle(pg_temp.cid('10000000-0000-0000-0000-0000000000a1'), '20000000-0000-0000-0000-0000000000c1')).id,
  (select id from public.card_cycles where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a1')
     and merchant_id = '20000000-0000-0000-0000-0000000000c1' and status = 'active'),
  'rolling again keeps the same new cycle'
);

-- U3: same roll path one cycle later (TC-075: the next cycle is of 8)
update public.card_cycles set expires_at = pg_temp.now() - interval '1 day' where id = '50000000-0000-0000-0000-000000000002';
select is((app.roll_cycle(pg_temp.cid('10000000-0000-0000-0000-0000000000a3'), '20000000-0000-0000-0000-0000000000c1')).stamps_required, 8::smallint,
  'TC-075 the next cycle takes the new stamps_required');

select * from finish();
rollback;
