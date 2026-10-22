begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- Relies on supabase/seed.sql: C1 (PIN 1234) active with 2 categories / 6 products, C2 active without
-- a menu, C3 inactive. U1 has a relation with C1.
create function pg_temp.login(sub text, merchant_id text default null, session_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'session_id', session_id,
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end))::text, true);
$$;
create function pg_temp.as_c1() returns void language sql as $$
  select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001');
$$;
create function pg_temp.set_clock(p_at timestamptz) returns void language sql security definer as $$
  select set_config('app.fake_now', p_at::text, true);
$$;
create function pg_temp.seed_object(p_name text) returns void language sql security definer as $$
  insert into storage.objects (bucket_id, name) values ('merchant-media', p_name);
$$;
create function pg_temp.c2_category() returns uuid language sql security definer as $$
  insert into public.menu_categories (merchant_id, name, position) values ('20000000-0000-0000-0000-0000000000c2', 'Ajena', 1) returning id;
$$;
create function pg_temp.c2_product(p_category uuid) returns uuid language sql security definer as $$
  insert into public.products (merchant_id, category_id, name, price, position)
  values ('20000000-0000-0000-0000-0000000000c2', p_category, 'Ajeno', 10, 1) returning id;
$$;
create function pg_temp.field_of(p_sql text) returns text language plpgsql as $$
declare v_detail text;
begin execute p_sql; return null;
exception when others then get stacked diagnostics v_detail = pg_exception_detail; return (v_detail::jsonb) ->> 'field'; end $$;
-- Customer view of C1's products by name, as U1.
create function pg_temp.customer_product(p_name text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  perform pg_temp.login('10000000-0000-0000-0000-0000000000a1');
  select p into v from jsonb_array_elements(public.get_merchant_detail('20000000-0000-0000-0000-0000000000c1') -> 'menu' -> 'products') p
  where p ->> 'name' = p_name;
  perform pg_temp.as_c1();
  return v;
end $$;

select pg_temp.set_clock('2027-05-10 12:00:00-06');
select pg_temp.seed_object('merchants/20000000-0000-0000-0000-0000000000c1/product/img1_360.webp');
select pg_temp.seed_object('merchants/20000000-0000-0000-0000-0000000000c1/product/img2_360.jpg');
select pg_temp.seed_object('merchants/20000000-0000-0000-0000-0000000000c2/product/other_360.webp');
create temp table ids as select pg_temp.c2_category() as c2_cat;
create temp table ids2 as select pg_temp.c2_product(c2_cat) as c2_prod from ids;
grant select on ids, ids2 to authenticated;

select ok(not has_function_privilege('anon', 'public.list_menu_admin()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.upsert_menu_category(uuid,text,smallint)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.delete_menu_category(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.upsert_product(uuid,uuid,text,text,numeric,text,smallint)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.delete_product(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.set_product_flags(uuid,boolean,boolean)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.set_product_flags(uuid,boolean,boolean)', 'EXECUTE'), 'privileges');

set local role authenticated;

-- customers
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.list_menu_admin() $$, 'P0001', 'E-19', 'customer cannot list_menu_admin');
select throws_ok($$ select public.upsert_menu_category(null, 'X') $$, 'P0001', 'E-19', 'customer cannot upsert_menu_category');
select throws_ok($$ select public.delete_product('40000000-0000-0000-0000-000000000001') $$, 'P0001', 'E-19', 'customer cannot delete_product');

-- E-16 without admin session
select pg_temp.as_c1();
select throws_ok($$ select public.list_menu_admin() $$, 'P0001', 'E-16', 'list requires admin session');
select throws_ok($$ select public.upsert_menu_category(null, 'X') $$, 'P0001', 'E-16', 'upsert category requires admin session');
select throws_ok($$ select public.delete_menu_category('40000000-0000-0000-0000-000000000001') $$, 'P0001', 'E-16', 'delete category requires admin session');
select throws_ok($$ select public.upsert_product(null, '40000000-0000-0000-0000-000000000001', 'X', null, 1) $$, 'P0001', 'E-16', 'upsert product requires admin session');
select throws_ok($$ select public.delete_product('40000000-0000-0000-0000-000000000001') $$, 'P0001', 'E-16', 'delete product requires admin session');
select throws_ok($$ select public.set_product_flags('40000000-0000-0000-0000-000000000001', false, false) $$, 'P0001', 'E-16', 'flags require admin session');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock');

-- list ordering: seed categories by position, products by position
select is((select array_agg(c ->> 'name' order by n) from jsonb_array_elements(public.list_menu_admin() -> 'categories') with ordinality t (c, n)),
  array['Bebidas', 'Postres'], 'list orders categories by position');
select is((select array_agg(p ->> 'name' order by n) from jsonb_array_elements(public.list_menu_admin() -> 'categories' -> 0 -> 'products') with ordinality t (p, n)),
  array['Americano', 'Latte', 'Chai'], 'list orders products by position');
select is(public.list_menu_admin() -> 'categories' -> 0 -> 'products' -> 0 ->> 'is_featured', 'true', 'list exposes product flags');

-- categories
select is(public.upsert_menu_category(null, '  Snacks  '), jsonb_build_object('id', (select c ->> 'id' from jsonb_array_elements(public.list_menu_admin() -> 'categories') c where c ->> 'name' = 'Snacks'), 'name', 'Snacks', 'position', 3), 'new category is trimmed and gets max+1');
select is(pg_temp.field_of($$ select public.upsert_menu_category(null, '   ') $$), 'name', 'blank category name');
select is(pg_temp.field_of($$ select public.upsert_menu_category(null, repeat('x', 31)) $$), 'name', 'category name too long');
select is(pg_temp.field_of($$ select public.upsert_menu_category((select c2_cat from ids), 'Hack') $$), 'id', 'cross-merchant category update is not found');
select is(pg_temp.field_of($$ select public.delete_menu_category((select c2_cat from ids)) $$), 'id', 'cross-merchant category delete is not found');
select is(pg_temp.field_of($$ select public.delete_menu_category('40000000-0000-0000-0000-000000000001') $$), 'category_not_empty', 'non-empty category cannot be deleted');
select is(public.upsert_menu_category('40000000-0000-0000-0000-000000000002', 'Dulces', 5::smallint) ->> 'position', '5', 'update category name and position');

-- products
select is(pg_temp.field_of($$ select public.upsert_product(null, (select c2_cat from ids), 'X', null, 1) $$), 'category_id', 'category of another merchant');
select is(pg_temp.field_of($$ select public.upsert_product(null, '40000000-0000-0000-0000-000000000001', ' ', null, 1) $$), 'name', 'blank product name');
select is(pg_temp.field_of($$ select public.upsert_product(null, '40000000-0000-0000-0000-000000000001', 'X', repeat('x', 201), 1) $$), 'description', 'description too long');
select is(pg_temp.field_of($$ select public.upsert_product(null, '40000000-0000-0000-0000-000000000001', 'X', null, -1) $$), 'price', 'negative price');
select is(pg_temp.field_of($$ select public.upsert_product(null, '40000000-0000-0000-0000-000000000001', 'X', null, 1.234) $$), 'price', 'three decimals');
select is(pg_temp.field_of($$ select public.upsert_product(null, '40000000-0000-0000-0000-000000000001', 'X', null, 100000000) $$), 'price', 'price above max');
select is(pg_temp.field_of($$ select public.upsert_product(null, '40000000-0000-0000-0000-000000000001', 'X', null, 1, 'merchants/20000000-0000-0000-0000-0000000000c1/product/ghost') $$), 'image_path', 'image without uploaded object');
select is(pg_temp.field_of($$ select public.upsert_product(null, '40000000-0000-0000-0000-000000000001', 'X', null, 1, 'merchants/20000000-0000-0000-0000-0000000000c2/product/other') $$), 'image_path', 'image in another merchant folder');
select is(pg_temp.field_of($$ select public.upsert_product((select c2_prod from ids2), '40000000-0000-0000-0000-000000000001', 'X', null, 1) $$), 'id', 'cross-merchant product update is not found');
select is(pg_temp.field_of($$ select public.delete_product((select c2_prod from ids2)) $$), 'id', 'cross-merchant product delete is not found');
select is(pg_temp.field_of($$ select public.set_product_flags((select c2_prod from ids2), true, true) $$), 'id', 'cross-merchant flags are not found');

select is(public.upsert_product(null, '40000000-0000-0000-0000-000000000001', '  Mocha ', '   ', 55.5, 'merchants/20000000-0000-0000-0000-0000000000c1/product/img1') - 'id',
  '{"category_id":"40000000-0000-0000-0000-000000000001","name":"Mocha","description":null,"price":55.5,"image_path":"merchants/20000000-0000-0000-0000-0000000000c1/product/img1","is_featured":false,"is_sold_out":false,"position":4}'::jsonb,
  'create trims, blank description becomes null, position is max+1 in the category');
select is(public.upsert_product(null, '40000000-0000-0000-0000-000000000001', 'Jpg', null, 1, 'merchants/20000000-0000-0000-0000-0000000000c1/product/img2.jpg') ->> 'position', '5', 'jpg fallback path accepted');

-- move between categories keeps the product, position max+1 only on insert
select is((select public.upsert_product(p.id, '40000000-0000-0000-0000-000000000002', 'Mocha', null, 60) ->> 'category_id'
  from public.products p where p.name = 'Mocha'), '40000000-0000-0000-0000-000000000002', 'product can move to another category');

-- flags + customer view (RN-56)
select is(pg_temp.customer_product('Latte') ->> 'is_sold_out', 'false', 'customer sees Latte available');
select is(public.set_product_flags((select id from public.products where name = 'Latte'), true, false) - 'id',
  '{"category_id":"40000000-0000-0000-0000-000000000001","name":"Latte","description":"Espresso con leche vaporizada.","price":60.00,"image_path":null,"is_featured":false,"is_sold_out":true,"position":2}'::jsonb,
  'sold out today and unfeatured');
select is((pg_temp.customer_product('Latte') ->> 'is_sold_out') || (pg_temp.customer_product('Latte') ->> 'is_featured'), 'truefalse', 'customer view reflects flags');
select pg_temp.set_clock('2027-05-11 09:00:00-06');
select is(pg_temp.customer_product('Latte') ->> 'is_sold_out', 'false', 'sold out resets the next local day');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock again after the clock moved');
select is(public.set_product_flags((select id from public.products where name = 'Latte'), false, true) ->> 'is_featured', 'true', 'is_featured toggles back');

-- deletes
select lives_ok($$ select public.delete_product((select id from public.products where name = 'Jpg')) $$, 'delete product');
select lives_ok($$ select public.delete_menu_category((select c ->> 'id' from jsonb_array_elements(public.list_menu_admin() -> 'categories') c where c ->> 'name' = 'Snacks')::uuid) $$, 'delete empty category');

-- RN-71 inactive merchant
select pg_temp.login('10000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000003');
select throws_ok($$ select public.upsert_menu_category(null, 'X') $$, 'P0001', 'E-05', 'inactive merchant cannot upsert category');
select throws_ok($$ select public.delete_menu_category(gen_random_uuid()) $$, 'P0001', 'E-05', 'inactive merchant cannot delete category');
select throws_ok($$ select public.upsert_product(null, gen_random_uuid(), 'X', null, 1) $$, 'P0001', 'E-05', 'inactive merchant cannot upsert product');
select throws_ok($$ select public.delete_product(gen_random_uuid()) $$, 'P0001', 'E-05', 'inactive merchant cannot delete product');
select throws_ok($$ select public.set_product_flags(gen_random_uuid(), true, true) $$, 'P0001', 'E-05', 'inactive merchant cannot set flags');
select * from finish();
rollback;
