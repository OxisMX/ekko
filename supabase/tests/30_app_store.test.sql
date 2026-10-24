begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Relies on supabase/seed.sql: customers U1, U2 (…a1, …a2) and merchant C1.

create function pg_temp.login(sub text, role text) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'app_metadata', jsonb_build_object('role', role))::text, true);
$$;
create function pg_temp.opt_in(p_auth_user_id uuid) returns boolean language sql security definer as $$
  select push_opt_in from public.customers where auth_user_id = p_auth_user_id;
$$;

-- Default is opt-out
insert into auth.users (id, email, raw_user_meta_data)
values ('10000000-0000-0000-0000-0000000000f1', 'optin@ekko.test', '{}');
select is(pg_temp.opt_in('10000000-0000-0000-0000-0000000000f1'), false, 'a new customer is opted out by default');

-- set_push_opt_in
select ok(not has_function_privilege('anon', 'public.set_push_opt_in(boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.set_push_opt_in(boolean)', 'EXECUTE'), 'anon cannot execute, authenticated can');

set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000f1', 'customer');
select public.set_push_opt_in(true);
select is(pg_temp.opt_in('10000000-0000-0000-0000-0000000000f1'), true, 'set_push_opt_in(true) opts in');
select is(pg_temp.opt_in('10000000-0000-0000-0000-0000000000a2'), true, 'another customer row (seeded opted in) is untouched');
select public.set_push_opt_in(false);
select is(pg_temp.opt_in('10000000-0000-0000-0000-0000000000f1'), false, 'set_push_opt_in(false) opts out');
select throws_ok($$ select public.set_push_opt_in(null) $$, 'P0001', 'E-23', 'null value is rejected');
select pg_temp.login('20000000-0000-0000-0000-0000000000c1', 'merchant');
select throws_ok($$ select public.set_push_opt_in(true) $$, 'P0001', 'E-19', 'merchant cannot call it');

select * from finish();
rollback;
