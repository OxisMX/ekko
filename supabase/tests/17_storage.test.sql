begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Relies on supabase/seed.sql: C1 (PIN 1234) and C2 active. Policies run as the caller.
create function pg_temp.login(sub text, merchant_id text default null, session_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'session_id', session_id,
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end))::text, true);
$$;
create function pg_temp.as_c1(session_id text default 'aaaaaaaa-0000-0000-0000-000000000001') returns void language sql as $$
  select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', session_id);
$$;
create function pg_temp.put(p_name text) returns void language sql as $$
  insert into storage.objects (bucket_id, name) values ('merchant-media', p_name);
$$;
create function pg_temp.del(p_name text) returns bigint language plpgsql as $$
declare n bigint;
begin perform set_config('storage.allow_delete_query', 'true', true); delete from storage.objects where bucket_id = 'merchant-media' and name = p_name; get diagnostics n = row_count; return n; end $$;
create function pg_temp.visible(p_name text) returns bigint language sql as $$
  select count(*) from storage.objects where bucket_id = 'merchant-media' and name = p_name;
$$;
create function pg_temp.seed_object(p_name text) returns void language sql security definer as $$
  insert into storage.objects (bucket_id, name) values ('merchant-media', p_name);
$$;
create function pg_temp.expire_session() returns void language sql security definer as $$
  update private.merchant_admin_sessions set expires_at = app.now() - interval '1 second';
$$;

select is((select (public, file_size_limit, allowed_mime_types) from storage.buckets where id = 'merchant-media'),
  (true, 307200::bigint, array['image/webp', 'image/jpeg']), 'bucket is public, 300 KB, webp/jpeg');

select pg_temp.seed_object('merchants/20000000-0000-0000-0000-0000000000c1/logo/l_200.webp');
set local role authenticated;
select pg_temp.as_c1();

-- No admin session yet
select throws_ok($$ select pg_temp.put('merchants/20000000-0000-0000-0000-0000000000c1/card/a_800.webp') $$,
  '42501', null, 'no admin session: upload rejected');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock');

select lives_ok($$ select pg_temp.put('merchants/20000000-0000-0000-0000-0000000000c1/card/a_800.webp') $$, 'admin session: own card folder');
select lives_ok($$ select pg_temp.put('merchants/20000000-0000-0000-0000-0000000000c1/product/p_400.jpg') $$, 'admin session: own product folder');
select throws_ok($$ select pg_temp.put('merchants/20000000-0000-0000-0000-0000000000c2/card/a_800.webp') $$,
  '42501', null, 'other merchant folder rejected');
select throws_ok($$ select pg_temp.put('merchants/20000000-0000-0000-0000-0000000000c1/logo/n_200.webp') $$,
  '42501', null, 'logo folder rejected (service_role only)');
select throws_ok($$ select pg_temp.put('merchants/20000000-0000-0000-0000-0000000000c1/cover/n_200.webp') $$,
  '42501', null, 'cover folder rejected');

-- Delete: own card object yes, logo no (RLS hides it: 0 rows)
select is(pg_temp.del('merchants/20000000-0000-0000-0000-0000000000c1/card/a_800.webp'), 1::bigint, 'delete own card object');
select is(pg_temp.del('merchants/20000000-0000-0000-0000-0000000000c1/logo/l_200.webp'), 0::bigint, 'cannot delete logo');

-- Expired admin session
reset role;
select pg_temp.expire_session();
set local role authenticated;
select pg_temp.as_c1();
select throws_ok($$ select pg_temp.put('merchants/20000000-0000-0000-0000-0000000000c1/card/b_800.webp') $$,
  '42501', null, 'expired admin session: upload rejected');

-- Customer cannot upload; public read works for customer and anon
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select pg_temp.put('merchants/20000000-0000-0000-0000-0000000000c1/card/c_800.webp') $$,
  '42501', null, 'customer upload rejected');
reset role;
set local role anon;
select is(pg_temp.visible('merchants/20000000-0000-0000-0000-0000000000c1/product/p_400.jpg'), 1::bigint, 'anon reads publicly');
select * from finish();
rollback;
