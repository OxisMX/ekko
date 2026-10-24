begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

-- Relies on supabase/seed.sql: 14 visible merchants (C1, C2, C5..C16) and C3 invisible, with U4
-- related to C3. Ids: merchants 20000000-…-0000000000c1/c2/c3 and 20000000-…-000000000c05..c16.

create function pg_temp.error_detail(sql text) returns jsonb language plpgsql as $$
declare v_detail text;
begin
  execute sql;
  return null;
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return nullif(v_detail, '')::jsonb;
end;
$$;

-- Item ids of a list_merchants response, in response order.
create function pg_temp.ids(response jsonb) returns uuid[] language sql as $$
  select coalesce(array_agg((i ->> 'id')::uuid order by n), '{}')
  from jsonb_array_elements(response -> 'items') with ordinality as t (i, n);
$$;

-- Sorted item names of a list_merchants response.
create function pg_temp.names(response jsonb) returns text[] language sql as $$
  select coalesce(array_agg(i ->> 'name' order by i ->> 'name'), '{}')
  from jsonb_array_elements(response -> 'items') i;
$$;

-- Fixture: one product at the invisible merchant C3 (the seed has none).
insert into public.menu_categories (id, merchant_id, name, position)
values ('47000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-0000000000c3', 'Tacos', 1);
insert into public.products (merchant_id, category_id, name, price, position)
values ('20000000-0000-0000-0000-0000000000c3', '47000000-0000-0000-0000-000000000003', 'Pastor', 20, 1);

-- Visible ids in the documented order for seed 'alpha' (RN-52), computed outside the RPC.
create temp table expected_alpha as
select array_agg(m.id order by md5(m.id::text || 'alpha'), m.id) as ids
from public.merchants m where m.is_visible;
grant select on expected_alpha to authenticated;

-- Privileges
select ok(not has_function_privilege('anon', 'public.list_merchants(text, text, public.merchant_category, integer, integer)', 'EXECUTE'), 'anon cannot execute list_merchants');
select ok(has_function_privilege('authenticated', 'public.list_merchants(text, text, public.merchant_category, integer, integer)', 'EXECUTE'), 'authenticated can execute list_merchants');
select is((select cardinality(ids) from expected_alpha), 14, 'seed has 14 visible merchants');

set local role authenticated;

-- U1: customer without relation to C3
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000a1","role":"authenticated","app_metadata":{"role":"customer"}}';

select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.list_merchants('alpha')) k),
  array['has_more', 'items'], 'returns items and has_more'
);
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.list_merchants('alpha') -> 'items' -> 0) k),
  array['category', 'cover_path', 'description', 'id', 'is_favorite', 'logo_path', 'maps_url', 'name', 'progress'],
  'items carry exactly the documented fields'
);
select is(
  public.list_merchants('alpha', p_query => 'Ekko Centro') -> 'items' -> 0,
  '{"id":"20000000-0000-0000-0000-0000000000c1","name":"Café Ekko Centro","category":"cafeterias_postres",
    "description":"Café de especialidad y postres de la casa.","logo_path":"merchants/c1/logo",
    "cover_path":"merchants/c1/cover","maps_url":"https://maps.example/c1","is_favorite":false,
    "progress":{"stamps":3,"stamps_required":6,"reward_title":"Bebida gratis"}}'::jsonb,
  'item values come from the merchant row'
);

-- Pagination (default limit 10) and has_more at the boundaries
select is(jsonb_array_length(public.list_merchants('alpha') -> 'items'), 10, 'page 1 has 10 items by default');
select is(public.list_merchants('alpha') -> 'has_more', 'true'::jsonb, 'page 1 has_more is true');
select is(jsonb_array_length(public.list_merchants('alpha', p_offset => 10) -> 'items'), 4, 'page 2 has the remaining 4 items');
select is(public.list_merchants('alpha', p_offset => 10) -> 'has_more', 'false'::jsonb, 'last page has_more is false');
select is(public.list_merchants('alpha', p_offset => 4, p_limit => 10) -> 'has_more', 'false'::jsonb,
  'exactly limit rows left: has_more is false');
select is(public.list_merchants('alpha', p_offset => 3, p_limit => 10) -> 'has_more', 'true'::jsonb,
  'limit + 1 rows left: has_more is true');
select is(public.list_merchants('alpha', p_offset => 14) -> 'items', '[]'::jsonb, 'offset past the end returns no items');
select is(jsonb_array_length(public.list_merchants('alpha', p_limit => 20) -> 'items'), 14, 'limit 20 is allowed');

-- TC-020: same seed, same order, no duplicates across pages
select is(pg_temp.ids(public.list_merchants('alpha')), pg_temp.ids(public.list_merchants('alpha')), 'TC-020 same seed gives the same order');
select is(
  pg_temp.ids(public.list_merchants('alpha')) || pg_temp.ids(public.list_merchants('alpha', p_offset => 10)),
  (select ids from expected_alpha),
  'TC-020 pages concatenate to the md5(id || seed) order without duplicates or gaps'
);

-- TC-021: different seeds, different order (deterministic for the fixed seed ids)
select isnt(pg_temp.ids(public.list_merchants('alpha', p_limit => 20)), pg_temp.ids(public.list_merchants('beta', p_limit => 20)),
  'TC-021 seeds alpha and beta give different orders');
select is(
  (select count(distinct pg_temp.ids(public.list_merchants(s, p_limit => 20))) from unnest(array['s1', 's2', 's3', 's4', 's5']) s),
  5::bigint, 'TC-021 five seeds give five distinct orders'
);

-- TC-022: the invisible merchant is never listed
select ok(not ('20000000-0000-0000-0000-0000000000c3' = any (pg_temp.ids(public.list_merchants('alpha', p_limit => 20)))),
  'TC-022 invisible C3 is not listed');
select is(public.list_merchants('alpha', p_query => 'Tacos') -> 'items', '[]'::jsonb, 'TC-022 searching the invisible name finds nothing');

-- TC-023: partial, case- and accent-insensitive search; category; both combined
select is(pg_temp.names(public.list_merchants('alpha', p_query => 'cafe')), array['Café Ekko Centro', 'Cafetería Doña Lupe'],
  'TC-023 "cafe" finds Café and Cafetería');
select is(pg_temp.names(public.list_merchants('alpha', p_query => 'CAFÉ')), array['Café Ekko Centro', 'Cafetería Doña Lupe'],
  'TC-023 search ignores case and accents in the query');
select is(pg_temp.names(public.list_merchants('alpha', p_query => '  espiga  ')), array['Panadería La Espiga'],
  'TC-023 query is trimmed and matches a partial word');
select is(pg_temp.names(public.list_merchants('alpha', p_query => 'guero')), array['Mariscos El Güero'],
  'TC-023 "guero" finds "Güero"');
select is(pg_temp.names(public.list_merchants('alpha', p_category => 'belleza')), array['Estética Bella Luz', 'Uñas y Más'],
  'TC-023 category filter');
select is(pg_temp.names(public.list_merchants('alpha', p_query => 'eria', p_category => 'cafeterias_postres')),
  array['Cafetería Doña Lupe', 'Panadería La Espiga'], 'TC-023 query and category combined');
select is(public.list_merchants('alpha', p_query => 'cafe', p_category => 'barberias'),
  '{"items":[],"has_more":false}'::jsonb, 'TC-023 combination without matches is empty');
select is(public.list_merchants('alpha', p_query => '%') -> 'items', '[]'::jsonb, 'LIKE wildcards in the query are literal');
select is(jsonb_array_length(public.list_merchants('alpha', p_query => '   ') -> 'items'), 10, 'a blank query does not filter');

-- E-23 validations
select is(pg_temp.error_detail($$ select public.list_merchants(null) $$), '{"field":"seed"}'::jsonb, 'null seed raises E-23 seed');
select is(pg_temp.error_detail($$ select public.list_merchants('') $$), '{"field":"seed"}'::jsonb, 'empty seed raises E-23 seed');
select is(pg_temp.error_detail($$ select public.list_merchants(repeat('x', 65)) $$), '{"field":"seed"}'::jsonb, '65-char seed raises E-23 seed');
select lives_ok($$ select public.list_merchants(repeat('x', 64)) $$, '64-char seed is allowed');
select throws_ok($$ select public.list_merchants('alpha', p_limit => 0) $$, 'P0001', 'E-23', 'limit 0 raises E-23');
select is(pg_temp.error_detail($$ select public.list_merchants('alpha', p_limit => 21) $$), '{"field":"limit"}'::jsonb, 'limit 21 raises E-23 limit');
select is(pg_temp.error_detail($$ select public.list_merchants('alpha', p_limit => null) $$), '{"field":"limit"}'::jsonb, 'null limit raises E-23 limit');
select is(pg_temp.error_detail($$ select public.list_merchants('alpha', p_offset => -1) $$), '{"field":"offset"}'::jsonb, 'negative offset raises E-23 offset');

-- RLS as U1: visible merchants and their catalog rows only
select is((select count(*) from public.merchants), 14::bigint, 'U1 sees the 14 visible merchants');
select is((select count(*) from public.loyalty_programs), 14::bigint, 'U1 sees the 14 visible loyalty programs');
select is((select count(*) from public.products where merchant_id = '20000000-0000-0000-0000-0000000000c1'), 6::bigint, 'U1 sees the products of visible C1');
select is((select count(*) from public.products where merchant_id = '20000000-0000-0000-0000-0000000000c3'), 0::bigint, 'U1 cannot see products of invisible unrelated C3');
select is((select count(*) from public.menu_categories where merchant_id = '20000000-0000-0000-0000-0000000000c3'), 0::bigint, 'U1 cannot see menu categories of C3');
select is((select count(*) from public.weekly_offers), 2::bigint, 'U1 sees the weekly offers of visible C1');
select throws_ok($$ insert into public.weekly_offers (merchant_id, title, description, weekday, position)
  values ('20000000-0000-0000-0000-0000000000c1', 't', 'd', 1, 9) $$, '42501', null, 'TC-204 a customer cannot insert catalog rows');

-- RLS as U4: plus its related invisible merchant C3
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000a4","role":"authenticated","app_metadata":{"role":"customer"}}';
select is((select count(*) from public.merchants), 15::bigint, 'U4 sees the visible merchants plus related C3');
select is((select count(*) from public.products where merchant_id = '20000000-0000-0000-0000-0000000000c3'), 1::bigint, 'U4 sees the products of related C3');
select ok(not ('20000000-0000-0000-0000-0000000000c3' = any (pg_temp.ids(public.list_merchants('alpha', p_limit => 20)))),
  'the relation does not put C3 in the catalog');

-- Merchant JWTs: own rows only (TC-201)
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000c2","role":"authenticated","app_metadata":{"role":"merchant","merchant_id":"20000000-0000-0000-0000-0000000000c2"}}';
select throws_ok($$ select public.list_merchants('alpha') $$, 'P0001', 'E-19', 'merchant JWT raises E-19');
select is((select array_agg(id) from public.merchants), array['20000000-0000-0000-0000-0000000000c2'::uuid], 'C2 sees only its own merchant row');
select is((select count(*) from public.products), 0::bigint, 'TC-201 C2 sees no products of other merchants');
set local request.jwt.claims = '{"sub":"10000000-0000-0000-0000-0000000000c3","role":"authenticated","app_metadata":{"role":"merchant","merchant_id":"20000000-0000-0000-0000-0000000000c3"}}';
select is((select array_agg(name) from public.products), array['Pastor'], 'invisible C3 sees its own products');

-- No session
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.list_merchants('alpha') $$, 'P0001', 'E-18', 'no user raises E-18');

-- anon (TC-203): no access to catalog tables
reset role;
set local role anon;
select is(
  (select count(*) from unnest(array['merchants', 'loyalty_programs', 'menu_categories', 'products', 'weekly_offers']) t
   where has_table_privilege('anon', 'public.' || t, 'SELECT')),
  0::bigint, 'TC-203 anon has no SELECT on catalog tables'
);
select throws_ok($$ select * from public.merchants $$, '42501', null, 'TC-203 anon querying merchants is denied');

select * from finish();
rollback;
