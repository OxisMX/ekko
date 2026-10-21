begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Fixtures (ids in the ...f0xx range so they never collide with seed.sql)
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000f001'),
  ('00000000-0000-0000-0000-00000000f002');

insert into public.merchants (
  id, auth_user_id, name, category, description, address, logo_path, cover_path,
  maps_url, reviews_url, subscription_status, billing_period, paid_until
) values (
  '00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f001',
  'Schema Test', 'otros', 'd', 'a', 'l', 'c', 'm', 'r', 'active', 'annual', '2030-01-01'
);

select id as customer_id from public.customers
where auth_user_id = '00000000-0000-0000-0000-00000000f002' \gset

insert into public.customer_merchants (customer_id, merchant_id, origin)
values (:'customer_id', '00000000-0000-0000-0000-00000000f101', 'add_card');

-- TC-079: one active cycle per relation
insert into public.card_cycles (
  id, customer_id, merchant_id, status, stamps_required, reward_title, reward_description, terms, expires_at
) values (
  '00000000-0000-0000-0000-00000000f201', :'customer_id', '00000000-0000-0000-0000-00000000f101',
  'active', 6, 't', 'd', 'x', '2030-01-01'
);
prepare second_active as
  insert into public.card_cycles (customer_id, merchant_id, status, stamps_required, reward_title, reward_description, terms, expires_at)
  select c.customer_id, c.merchant_id, 'active', 6, 't', 'd', 'x', '2030-01-01'::timestamptz
  from public.card_cycles c where c.id = '00000000-0000-0000-0000-00000000f201';
select throws_ok('second_active', '23505', null, 'TC-079: a second active cycle for the same relation is rejected');
select lives_ok(
  $$ insert into public.card_cycles (customer_id, merchant_id, status, stamps_required, reward_title, reward_description, terms, expires_at)
     select c.customer_id, c.merchant_id, 'completed', 6, 't', 'd', 'x', '2030-01-01'::timestamptz
     from public.card_cycles c where c.id = '00000000-0000-0000-0000-00000000f201' $$,
  'closed cycles may coexist with the active one'
);

-- RN-17 / RN-36: one non-bonus stamp per customer/merchant/local_date; bonus stamps allowed
prepare stamp(boolean) as
  insert into public.stamps (cycle_id, customer_id, merchant_id, is_bonus, local_date)
  select c.id, c.customer_id, c.merchant_id, $1, '2026-10-20'::date
  from public.card_cycles c where c.id = '00000000-0000-0000-0000-00000000f201';
select lives_ok('execute stamp(false)', 'first stamp of the day is accepted');
select throws_ok('execute stamp(false)', '23505', null, 'RN-17: a second non-bonus stamp on the same local day is rejected');
select lives_ok('execute stamp(true)', 'RN-36: a bonus stamp on the same local day is accepted');
select lives_ok('execute stamp(true)', 'RN-36: several bonus stamps on the same local day are accepted');

-- coupons: source/origin CHECK and code alphabet CHECK
prepare coupon(public.coupon_source, uuid, smallint, text) as
  insert into public.coupons (customer_id, merchant_id, source, cycle_id, birthday_year, title, description, code, expires_at)
  values (:'customer_id', '00000000-0000-0000-0000-00000000f101', $1, $2, $3, 't', 'd', $4, '2030-01-01');
select lives_ok(
  $$ execute coupon('card_reward', '00000000-0000-0000-0000-00000000f201', null, 'ABC234') $$,
  'card_reward coupon with cycle_id is accepted'
);
select throws_ok(
  $$ execute coupon('card_reward', null, null, 'ABC235') $$,
  '23514', null, 'card_reward coupon without cycle_id is rejected'
);
select throws_ok(
  $$ execute coupon('birthday', '00000000-0000-0000-0000-00000000f201', 2026, 'ABC236') $$,
  '23514', null, 'birthday coupon carrying a cycle_id is rejected'
);
select lives_ok($$ execute coupon('birthday', null, 2026, 'ABC237') $$, 'birthday coupon with birthday_year is accepted');
select throws_ok($$ execute coupon('wheel', null, null, 'ABC238') $$, '23514', null, 'wheel coupon without spin_id is rejected');
select throws_ok($$ execute coupon('push', null, null, 'ABC239') $$, '23514', null, 'push coupon without campaign_id is rejected');
select throws_ok(
  $$ execute coupon('birthday', null, 2027, 'ABCDE1') $$,
  '23514', null, 'code with a symbol outside the alphabet (1) is rejected'
);
select throws_ok(
  $$ execute coupon('birthday', null, 2028, 'abc234') $$,
  '23514', null, 'lowercase code is rejected'
);

-- wheel_spins: three uniques
insert into private.wheel_prizes (id, merchant_id, label, prize_type, benefit_title, benefit_description, weight, position)
values ('00000000-0000-0000-0000-00000000f301', '00000000-0000-0000-0000-00000000f101', 'p', 'coupon', 't', 'd', 1, 1);
insert into auth.users (id) values ('00000000-0000-0000-0000-00000000f003');
select id as other_customer from public.customers
where auth_user_id = '00000000-0000-0000-0000-00000000f003' \gset
insert into public.wheel_spins (customer_id, merchant_id, prize_id, device_hash, email_hash)
values (:'customer_id', '00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f301', '\x01', '\x02');
prepare spin(uuid, bytea, bytea) as
  insert into public.wheel_spins (customer_id, merchant_id, prize_id, device_hash, email_hash)
  values ($1, '00000000-0000-0000-0000-00000000f101', '00000000-0000-0000-0000-00000000f301', $2, $3);
select throws_ok(
  format($$ execute spin(%L, '\x0a', '\x0b') $$, :'customer_id'),
  '23505', null, 'RN-07: one spin per customer and merchant'
);
select throws_ok(
  format($$ execute spin(%L, '\x01', '\x0b') $$, :'other_customer'),
  '23505', null, 'RN-07: one spin per device and merchant'
);
select throws_ok(
  format($$ execute spin(%L, '\x0a', '\x02') $$, :'other_customer'),
  '23505', null, 'RN-09: one spin per email hash and merchant'
);

select * from finish();
rollback;
