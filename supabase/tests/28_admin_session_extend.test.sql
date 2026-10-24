begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- Relies on supabase/seed.sql: merchant C1 has PIN 1234 (bcrypt).

create function pg_temp.as_c1() returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', '10000000-0000-0000-0000-0000000000c1', 'role', 'authenticated',
    'session_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'app_metadata', jsonb_build_object('role', 'merchant', 'merchant_id', '20000000-0000-0000-0000-0000000000c1'))::text, true);
$$;
create function pg_temp.require_admin() returns void language sql security definer as $$
  select app.require_admin_session();
$$;
create temp table ctx as select date_trunc('second', now()) + interval '1 hour' as base;
grant all on ctx to authenticated;
create function pg_temp.at(p interval) returns void language sql as $$
  select set_config('app.fake_now', ((select base from ctx) + p)::text, true);
$$;

select ok(not has_function_privilege('anon', 'public.extend_admin_session()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.extend_admin_session()', 'EXECUTE'), 'only authenticated can execute extend_admin_session');

set local role authenticated;
select pg_temp.at(interval '0 s');
select pg_temp.as_c1();

select throws_ok($$ select public.extend_admin_session() $$, 'P0001', 'E-16', 'no admin session -> E-16');

select public.unlock_admin('1234'); -- expires at +5 min
select is((public.extend_admin_session() ->> 'expires_at')::timestamptz, (select base + interval '10 min' from ctx), 'extends +5 min from the current expiry');
select is((public.extend_admin_session() ->> 'expires_at')::timestamptz, (select base + interval '15 min' from ctx), 'extends again up to 15 min');
select is((public.extend_admin_session() ->> 'expires_at')::timestamptz, (select base + interval '15 min' from ctx), 'capped at now + 15 min');

select pg_temp.at(interval '1 min');
select pg_temp.require_admin();
select is((public.extend_admin_session() ->> 'expires_at')::timestamptz, (select base + interval '16 min' from ctx), 'require_admin_session did not shorten the extended window');

select pg_temp.at(interval '16 min 1 s');
select throws_ok($$ select public.extend_admin_session() $$, 'P0001', 'E-16', 'expired session -> E-16');
select throws_ok($$ select pg_temp.require_admin() $$, 'P0001', 'E-16', 'expired session still fails require_admin_session');

select * from finish();
rollback;
