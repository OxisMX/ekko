begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Relies on supabase/seed.sql: C1/C2 active, C3 inactive; merchant auth users 10000000-…-0000000000cN.

create function pg_temp.login(sub text, merchant_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object(
    'sub', sub, 'role', 'authenticated',
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end)::text, true);
$$;

create temp table qr (k text primary key, v jsonb);
grant all on qr to authenticated;

-- ----------------------------------------------------------------------------------------------
-- Privileges (§6.2): EXECUTE and column privileges on visit_qr_tokens
select ok(not has_function_privilege('anon', 'public.generate_visit_qr()', 'EXECUTE'), 'anon cannot execute generate_visit_qr');
select ok(has_function_privilege('authenticated', 'public.generate_visit_qr()', 'EXECUTE'), 'authenticated can execute generate_visit_qr');
select ok(not has_column_privilege('authenticated', 'public.visit_qr_tokens', 'token_hash', 'SELECT'), 'authenticated cannot read token_hash');
select ok(not has_column_privilege('authenticated', 'public.visit_qr_tokens', 'used_by_customer_id', 'SELECT'), 'authenticated cannot read used_by_customer_id');
select ok(
  (select bool_and(has_column_privilege('authenticated', 'public.visit_qr_tokens', c, 'SELECT'))
   from unnest(array['id', 'merchant_id', 'created_at', 'expires_at', 'used_at', 'invalidated_at']) c),
  'authenticated can read the status columns (Realtime)'
);
select ok(not has_table_privilege('authenticated', 'public.visit_qr_tokens', 'INSERT, UPDATE, DELETE'), 'authenticated cannot write visit_qr_tokens');
select ok(not has_any_column_privilege('anon', 'public.visit_qr_tokens', 'SELECT'), 'anon cannot read visit_qr_tokens');

-- Fixtures: an already expired pending token at C1, a used one, and a pending one at C2
set local app.fake_now = '2026-10-20 12:00:00-06';
insert into public.visit_qr_tokens (id, merchant_id, token_hash, created_at, expires_at) values
  ('49000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000c1', '\x01', app.now() - interval '2 minutes', app.now() - interval '1 minute'),
  ('49000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000c2', '\x02', app.now() - interval '10 seconds', app.now() + interval '50 seconds');

set local role authenticated;

-- Role checks: customer E-19, inactive merchant E-05 (TC-057, TC-180 subset)
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.generate_visit_qr() $$, 'P0001', 'E-19', 'customer JWT raises E-19');
select pg_temp.login('10000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select public.generate_visit_qr() $$, 'P0001', 'E-05', 'TC-057 inactive merchant raises E-05');

-- TC-040: active merchant gets a 60 s token; only its hash is stored
select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1');
insert into qr values ('first', public.generate_visit_qr());
select is((select array_agg(key order by key) from qr, jsonb_object_keys(v) key where qr.k = 'first'), array['expires_at', 'qr_id', 'token', 'ttl_seconds'], 'returns qr_id, token, expires_at and ttl_seconds');
select ok((select v ->> 'token' ~ '^[A-Za-z0-9_-]{22}$' from qr where k = 'first'), 'TC-040 token is 22 base64url characters without padding');
select is((select length(decode(translate(v ->> 'token', '-_', '+/') || '==', 'base64')) from qr where k = 'first'), 16, 'token encodes 16 random bytes');
select is((select (v ->> 'expires_at')::timestamptz from qr where k = 'first'), '2026-10-20 12:01:00-06'::timestamptz, 'expires 60 s after app.now() (RN-14)');
select is((select v -> 'ttl_seconds' from qr where k = 'first'), '60'::jsonb, 'ttl_seconds is 60');
select isnt((select (v ->> 'token') from qr where k = 'first'), (select public.generate_visit_qr() ->> 'token'), 'consecutive tokens differ');

-- Merchant RLS: own rows only, status columns readable, secrets not
select is((select count(*) from public.visit_qr_tokens where id = (select (v ->> 'qr_id')::uuid from qr where k = 'first')), 1::bigint, 'the merchant sees its new token row');
select is((select count(*) from public.visit_qr_tokens where merchant_id <> '20000000-0000-0000-0000-0000000000c1'), 0::bigint, 'the merchant sees no other merchant tokens');
select throws_ok($$ select token_hash from public.visit_qr_tokens $$, '42501', null, 'the merchant cannot select token_hash');
select throws_ok($$ select used_by_customer_id from public.visit_qr_tokens $$, '42501', null, 'the merchant cannot select used_by_customer_id');

-- TC-041: a new QR invalidates the previous pending one
insert into qr values ('third', public.generate_visit_qr());
reset role;
select is((select invalidated_at from public.visit_qr_tokens where id = (select (v ->> 'qr_id')::uuid from qr where k = 'first')), app.now(),
  'TC-041 the previous pending token is invalidated at app.now()');
select is((select count(*) from public.visit_qr_tokens where merchant_id = '20000000-0000-0000-0000-0000000000c1'
             and used_at is null and invalidated_at is null and expires_at > app.now()), 1::bigint, 'only the newest token stays pending');
select is((select invalidated_at from public.visit_qr_tokens where id = '49000000-0000-0000-0000-000000000001'), null, 'an already expired token is not touched');
select is((select invalidated_at from public.visit_qr_tokens where id = '49000000-0000-0000-0000-000000000002'), null, 'another merchant pending token is not touched');
select is((select count(*) from public.visit_qr_tokens where used_at is not null and invalidated_at is not null), 0::bigint, 'used tokens are not invalidated');

-- TC-040: only the hash is stored
select is((select token_hash from public.visit_qr_tokens where id = (select (v ->> 'qr_id')::uuid from qr where k = 'third')),
  (select sha256(convert_to(v ->> 'token', 'UTF8')) from qr where k = 'third'), 'TC-040 token_hash = sha256(token)');
select is((select count(*) from public.visit_qr_tokens t, qr where qr.k in ('first', 'third')
             and (t::text like '%' || (qr.v ->> 'token') || '%' or t.token_hash = convert_to(qr.v ->> 'token', 'UTF8'))),
  0::bigint, 'TC-040 no row contains the clear token');

select * from finish();
rollback;
