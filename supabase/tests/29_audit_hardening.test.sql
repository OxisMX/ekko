begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Relies on supabase/seed.sql: merchant C1 has PIN 1234; U1 has 3 stamps at C1 (cycle …0001).

create function pg_temp.login(sub text, merchant_id text default null, session_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'session_id', session_id,
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end))::text, true);
$$;
create function pg_temp.as_c1() returns void language sql as $$
  select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001');
$$;
create function pg_temp.sec() returns text language sql security definer as $$
  select pin_failed_count || '/' || pin_lockouts || '/' || pin_failed_since_success from private.merchant_security
  where merchant_id = '20000000-0000-0000-0000-0000000000c1';
$$;
create function pg_temp.bad(p_n int) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  for i in 1..p_n loop v := public.unlock_admin('0000'); end loop;
  return v;
end $$;
create temp table ctx as select date_trunc('second', now()) + interval '1 hour' as base;
grant all on ctx to authenticated;
create function pg_temp.at(p interval) returns void language sql as $$
  select set_config('app.fake_now', ((select base from ctx) + p)::text, true);
$$;
create function pg_temp.cid(p_auth_user_id uuid) returns uuid language sql security definer as $$
  select c.id from public.customers c where c.auth_user_id = p_auth_user_id;
$$;

-- revoke_user_sessions is ops-only
select ok(not has_function_privilege('authenticated', 'public.revoke_user_sessions(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.revoke_user_sessions(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.revoke_user_sessions(uuid)', 'EXECUTE'), 'revoke_user_sessions is service_role only');

-- Escalating lockout
set local role authenticated;
select pg_temp.at(interval '0 s');
select pg_temp.as_c1();
select is((pg_temp.bad(5) ->> 'locked_until')::timestamptz, (select base + interval '15 min' from ctx), '1st lockout lasts 15 min');
select is(pg_temp.sec(), '5/1/5', 'counters after the 1st lockout');

select pg_temp.at(interval '15 min 1 s');
select is(public.unlock_admin('0000') ->> 'remaining', '4', 'an expired lock starts a fresh round of 5');
select is(pg_temp.sec(), '1/1/6', 'pin_lockouts survives the expiry');
select is((pg_temp.bad(4) ->> 'locked_until')::timestamptz, (select base + interval '1 h 15 min 1 s' from ctx), '2nd lockout lasts 1 h');
select is(pg_temp.sec(), '5/2/10', 'counters after the 2nd lockout');

select pg_temp.at(interval '1 h 16 min 2 s');
select is(public.unlock_admin('0000') ->> 'remaining', '4', 'fresh round after the 1 h lock');
select is((pg_temp.bad(4) ->> 'locked_until')::timestamptz, (select base + interval '25 h 16 min 2 s' from ctx), '3rd lockout lasts 24 h');
select pg_temp.at(interval '2 days');
select is(public.unlock_admin('0000') ->> 'remaining', '4', 'fresh round after the 24 h lock');
select is((pg_temp.bad(4) ->> 'locked_until')::timestamptz, (select base + interval '3 days' from ctx), 'further lockouts stay at 24 h');

-- Success resets everything and reports the failures since the last success
select pg_temp.at(interval '4 days');
select is(public.unlock_admin('1234'), jsonb_build_object('ok', true, 'admin_unlocked_until', (select base + interval '4 days 5 min' from ctx), 'failed_attempts', 20),
  'success reports failed_attempts since the last success');
select is(pg_temp.sec(), '0/0/0', 'success resets the round, the lockouts and the failure tally');
select is((public.unlock_admin('1234') ->> 'failed_attempts')::int, 0, 'a clean unlock reports 0 failed attempts');
select is((pg_temp.bad(5) ->> 'locked_until')::timestamptz, (select base + interval '4 days 15 min' from ctx), 'after a success the lock starts again at 15 min');

-- list_my_cards: stamps, reward_title, background_path, pending_extra_stamps
reset role;
update public.customer_merchants set pending_extra_stamps = 2
where customer_id = pg_temp.cid('10000000-0000-0000-0000-0000000000a1') and merchant_id = '20000000-0000-0000-0000-0000000000c1';
update public.loyalty_programs set card_background_path = 'merchants/c1/bg' where merchant_id = '20000000-0000-0000-0000-0000000000c1';
insert into public.stamps (cycle_id, customer_id, merchant_id, is_bonus, local_date, granted_at)
values ('50000000-0000-0000-0000-000000000001', pg_temp.cid('10000000-0000-0000-0000-0000000000a1'), '20000000-0000-0000-0000-0000000000c1',
        true, (select base from ctx)::date + 10, (select base from ctx) + interval '10 days');
set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select is(public.list_my_cards() -> 0 -> 'stamps', public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' -> 'stamps',
  'stamps match get_merchant_detail (current cycle, oldest first)');
select is(jsonb_array_length(public.list_my_cards() -> 0 -> 'stamps'), 4, 'the bonus stamp is included');
select is(public.list_my_cards() -> 0 -> 'stamps' -> 3 ->> 'is_bonus', 'true', 'bonus stamp last, flagged is_bonus');
select is(public.list_my_cards() -> 0 ->> 'reward_title', public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'card' ->> 'reward_title', 'reward_title matches the card');
select is(public.list_my_cards() -> 0 ->> 'background_path', 'merchants/c1/bg', 'background_path comes from the loyalty program');
select is((public.list_my_cards() -> 0 ->> 'pending_extra_stamps')::int, 2, 'pending_extra_stamps comes from the relation');

select * from finish();
rollback;
