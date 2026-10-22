begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- Relies on supabase/seed.sql: merchant C1 has PIN 1234 (bcrypt) and no admin session.

create function pg_temp.login(sub text, merchant_id text default null, session_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'session_id', session_id,
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end))::text, true);
$$;
create function pg_temp.as_c1(session_id text default 'aaaaaaaa-0000-0000-0000-000000000001') returns void language sql as $$
  select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', session_id);
$$;
create function pg_temp.keys(obj jsonb) returns text[] language sql as $$
  select array_agg(k order by k) from jsonb_object_keys(obj) k;
$$;
create function pg_temp.counter() returns text language sql security definer as $$
  select pin_failed_count || '/' || coalesce(pin_locked_until::text, '-') from private.merchant_security
  where merchant_id = '20000000-0000-0000-0000-0000000000c1';
$$;
create function pg_temp.sessions() returns int language sql security definer as $$
  select count(*)::int from private.merchant_admin_sessions where merchant_id = '20000000-0000-0000-0000-0000000000c1';
$$;
create function pg_temp.bad(p_n int) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  for i in 1..p_n loop v := public.unlock_admin('0000'); end loop;
  return v;
end $$;
-- app.* is not callable by authenticated; the test probes it through a definer wrapper.
create function pg_temp.require_admin() returns void language sql security definer as $$
  select app.require_admin_session();
$$;
create function pg_temp.session_until(p_session text) returns timestamptz language sql security definer as $$
  select expires_at from private.merchant_admin_sessions where auth_session_id = p_session::uuid;
$$;
create temp table ctx as select date_trunc('second', now()) + interval '1 hour' as base;
grant all on ctx to authenticated;
create function pg_temp.at(p interval) returns void language sql as $$
  select set_config('app.fake_now', ((select base from ctx) + p)::text, true);
$$;

-- Privileges
select ok(not has_function_privilege('anon', 'public.unlock_admin(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.lock_admin()', 'EXECUTE'), 'anon cannot execute unlock_admin / lock_admin');
select ok(has_function_privilege('authenticated', 'public.unlock_admin(text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.lock_admin()', 'EXECUTE'), 'authenticated can execute both');
select ok(not has_function_privilege('authenticated', 'app.require_admin_session()', 'EXECUTE')
  and not has_function_privilege('anon', 'app.require_admin_session()', 'EXECUTE'), 'require_admin_session is internal');

set local role authenticated;
select pg_temp.at(interval '0 s');

-- Roles / input
select pg_temp.login('10000000-0000-0000-0000-0000000000a1', null, 'aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok($$ select public.unlock_admin('1234') $$, 'P0001', 'E-19', 'customer cannot unlock_admin');
select throws_ok($$ select public.lock_admin() $$, 'P0001', 'E-19', 'customer cannot lock_admin');
select pg_temp.as_c1(null);
select throws_ok($$ select public.unlock_admin('1234') $$, 'P0001', 'E-19', 'a token without session_id cannot hold an admin session');
select pg_temp.as_c1();
select throws_ok($$ select public.unlock_admin('12a4') $$, 'P0001', 'E-23', 'non-numeric PIN -> E-23');
select throws_ok($$ select public.unlock_admin('123') $$, 'P0001', 'E-23', 'short PIN -> E-23');
select throws_ok($$ select public.unlock_admin(null) $$, 'P0001', 'E-23', 'null PIN -> E-23');
select is(pg_temp.counter(), '0/-', 'malformed PINs do not count');

-- No session yet
select throws_ok($$ select pg_temp.require_admin() $$, 'P0001', 'E-16', 'no admin session -> E-16');

-- Failures: counter persists because the RPC returns instead of raising
select is(public.unlock_admin('0000'), '{"ok": false, "error": "E-14", "remaining": 4}'::jsonb, '1st failure: 4 remaining');
select is(pg_temp.counter(), '1/-', 'the counter was persisted');
select is(pg_temp.bad(3), '{"ok": false, "error": "E-14", "remaining": 1}'::jsonb, '4th failure: 1 remaining');
create temp table lk as select public.unlock_admin('0000') as v;
select is((select v ->> 'error' from lk), 'E-15', '5th failure returns E-15');
select is((select (v ->> 'locked_until')::timestamptz from lk), (select base + interval '15 minutes' from ctx), 'locked for 15 min (RN-63)');
select is(pg_temp.counter(), '5/' || (select (base + interval '15 minutes')::text from ctx), 'lock persisted');
select pg_temp.at(interval '14 min 59 s');
select throws_ok($$ select public.unlock_admin('1234') $$, 'P0001', 'E-15', 'locked: even the right PIN raises E-15');
select is((select pg_temp.sessions()), 0, 'no session was created while locked');
select is((public.get_merchant_session() ->> 'pin_locked_until')::timestamptz, (select base + interval '15 minutes' from ctx), 'get_merchant_session reports the lock');

-- Success
select pg_temp.at(interval '15 min 1 s');
select is(public.unlock_admin('0000') ->> 'remaining', '4', 'expired lock restarts the count: 4 remaining');
select is(pg_temp.keys(public.unlock_admin('1234')), array['admin_unlocked_until', 'ok'], 'success keys');
select is(pg_temp.counter(), '0/-', 'success resets the counter and the lock');
select is((public.unlock_admin('1234') ->> 'admin_unlocked_until')::timestamptz, (select base + interval '20 min 1 s' from ctx),
  'session lasts 5 min from now (RN-64)');
select is(pg_temp.sessions(), 1, 'unlocking again extends the same session (no duplicates)');

-- The session belongs to the JWT session_id
select is((public.get_merchant_session() ->> 'admin_unlocked_until')::timestamptz, (select base + interval '20 min 1 s' from ctx),
  'get_merchant_session sees the session of its session_id');
select pg_temp.as_c1('bbbbbbbb-0000-0000-0000-000000000002');
select is(public.get_merchant_session() ->> 'admin_unlocked_until', null, 'another session_id is not unlocked');
select throws_ok($$ select pg_temp.require_admin() $$, 'P0001', 'E-16', 'another session_id has no access (E-16)');

-- require_admin_session extends 5 min; expiry
select pg_temp.as_c1();
select pg_temp.at(interval '18 min');
select lives_ok($$ select pg_temp.require_admin() $$, 'valid session passes');
select is(pg_temp.session_until('aaaaaaaa-0000-0000-0000-000000000001'), (select base + interval '23 min' from ctx), 'and is extended to now + 5 min');
select pg_temp.at(interval '23 min 1 s');
select throws_ok($$ select pg_temp.require_admin() $$, 'P0001', 'E-16', 'expired session -> E-16 (RN-64)');

-- lock_admin only closes the session of this device
select public.unlock_admin('1234');
select pg_temp.as_c1('bbbbbbbb-0000-0000-0000-000000000002');
select public.unlock_admin('1234');
select is(public.lock_admin(), '{"ok": true}'::jsonb, 'lock_admin returns ok');
select throws_ok($$ select pg_temp.require_admin() $$, 'P0001', 'E-16', 'locked session -> E-16');
select pg_temp.as_c1();
select lives_ok($$ select pg_temp.require_admin() $$, 'the other device session stays unlocked');

select * from finish();
rollback;
