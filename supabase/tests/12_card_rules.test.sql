begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Card rules RN-22..RN-30 not already asserted elsewhere: RN-23/RN-24 ranges (01_core), RN-25
-- (10 TC-074), RN-26/RN-27 (08, 10), RN-28 (11), RN-17/RN-19 (02, 10), RN-14 (09), RN-21 (10).
-- Relies on supabase/seed.sql: U3 has an active, empty C2 card (4 stamps).

create function pg_temp.login(sub text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', sub, 'role', 'authenticated', 'app_metadata', '{"role":"customer"}'::jsonb)::text, true);
$$;
create function pg_temp.now() returns timestamptz language sql security definer as $$ select app.now() $$;
create function pg_temp.set_clock(p_at timestamptz) returns void language sql security definer as $$
  select set_config('app.fake_now', p_at::text, true);
$$;
create function pg_temp.c2_cycles() returns setof public.card_cycles language sql as $$
  select cy.* from public.card_cycles cy join public.customers c on c.id = cy.customer_id
  where c.auth_user_id = '10000000-0000-0000-0000-0000000000a3' and cy.merchant_id = '20000000-0000-0000-0000-0000000000c2';
$$;

-- RN-22: one loyalty program per merchant
select throws_ok(
  $$ insert into public.loyalty_programs (merchant_id, reward_title, reward_description, terms)
     values ('20000000-0000-0000-0000-0000000000c1', 't', 'd', 'x') $$,
  '23505', null, 'RN-22 a second loyalty program for the same merchant is rejected');

-- RN-29: a config change leaves the running cycle untouched ...
create temp table before_change as select title.reward_title, title.stamps_required, title.expires_at
  from (select reward_title, stamps_required, expires_at from pg_temp.c2_cycles() where status = 'active') title;
update public.loyalty_programs
set stamps_required = 8, cycle_months = 3, reward_title = 'Premio nuevo', terms = 'Términos nuevos'
where merchant_id = '20000000-0000-0000-0000-0000000000c2';
select is((select (reward_title, stamps_required, expires_at) from pg_temp.c2_cycles() where status = 'active'),
  (select (reward_title, stamps_required, expires_at) from before_change), 'RN-29 the running cycle keeps its original config');

-- ... and the next cycle (lazy rollover) copies the new one, with the new duration (RN-24).
select pg_temp.set_clock(pg_temp.now() + interval '7 months');
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select public.list_my_cards();
reset role;
select is((select (reward_title, stamps_required, terms) from pg_temp.c2_cycles() where status = 'active'),
  ('Premio nuevo'::text, 8::smallint, 'Términos nuevos'::text), 'RN-29 the new cycle copies the new config');
select is((select expires_at from pg_temp.c2_cycles() where status = 'active'), pg_temp.now() + interval '3 months', 'RN-24 the new cycle lasts the configured cycle_months');
select is((select stamps_required from pg_temp.c2_cycles() where status = 'expired'), (select stamps_required from before_change), 'RN-29 the closed cycle keeps its old config');
select is((select count(*) from pg_temp.c2_cycles() where status = 'active'), 1::bigint, 'RN-22/RN-25 exactly one active cycle after the rollover');

-- RN-30: no way to void stamps for customers
-- WHY policies instead of grants: Supabase default-grants DML on public tables; RLS with no policy denies it.
select is_empty($$ select policyname from pg_policies where schemaname = 'public' and tablename = 'stamps' $$, 'RN-30 stamps has no RLS policy: customers cannot write or void them');
select is_empty($$ select proname from pg_proc where pronamespace = 'public'::regnamespace and proname ~* '(void|annul|revoke|cancel).*stamp|stamp.*(void|annul|revoke|cancel)' $$,
  'RN-30 no RPC voids stamps');
select is_empty($$ select 1 from public.card_cycles where status = 'active' and stamps_count >= stamps_required $$,
  'RN-26 no active cycle is left full');

select * from finish();
rollback;
