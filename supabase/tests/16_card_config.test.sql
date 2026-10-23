begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Relies on supabase/seed.sql: C1 (PIN 1234, 6 stamps) active, C3 inactive, U3 has an active C2 cycle.

create function pg_temp.login(sub text, merchant_id text default null, session_id text default null) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
    'sub', sub, 'role', 'authenticated', 'session_id', session_id,
    'app_metadata', case when merchant_id is null then '{"role":"customer"}'::jsonb
                         else jsonb_build_object('role', 'merchant', 'merchant_id', merchant_id) end))::text, true);
$$;
create function pg_temp.as_c1() returns void language sql as $$
  select pg_temp.login('10000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001');
$$;
create function pg_temp.upd(p_stamps smallint default 8, p_title text default '  Premio  ', p_path text default null,
  p_hours smallint default 24, p_terms text default 'Términos') returns jsonb language sql as $$
  select public.update_card_config(p_stamps, 6::smallint, p_title, 'Desc', p_terms, p_path, p_hours, null);
$$;
create function pg_temp.seed_object(p_name text) returns void language sql security definer as $$
  insert into storage.objects (bucket_id, name) values ('merchant-media', p_name);
$$;
create function pg_temp.c1_cycle_stamps() returns smallint language sql security definer as $$
  select stamps_required from public.card_cycles where merchant_id = '20000000-0000-0000-0000-0000000000c1' and status = 'active' limit 1;
$$;

select ok(not has_function_privilege('anon', 'public.get_card_config()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_card_config(smallint,smallint,text,text,text,text,smallint,text)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_card_config()', 'EXECUTE'), 'privileges');

set local role authenticated;
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.get_card_config() $$, 'P0001', 'E-19', 'customer cannot get_card_config');
select pg_temp.as_c1();
select throws_ok($$ select public.get_card_config() $$, 'P0001', 'E-16', 'get requires admin session');
select throws_ok($$ select pg_temp.upd() $$, 'P0001', 'E-16', 'update requires admin session');
select ok((public.unlock_admin('1234') ->> 'ok')::boolean, 'unlock');

select is(public.get_card_config() - 'card_background_path' - 'stamp_image_path',
  '{"stamps_required":6,"cycle_months":6,"reward_title":"Bebida gratis","reward_description":"Cualquier bebida mediana de la carta.","terms":"Consumo mínimo de $80 por visita.","push_coupon_validity_hours":48}'::jsonb,
  'get returns the seeded config');

select is(public.update_card_config(5::smallint, 6::smallint, '  Premio  ', 'Desc', 'T', null, 24::smallint, null),
  '{"stamps_required":5,"cycle_months":6,"reward_title":"Premio","reward_description":"Desc","terms":"T","card_background_path":null,"stamp_image_path":null,"push_coupon_validity_hours":24}'::jsonb,
  'update trims, saves and returns the new config');
select is(pg_temp.c1_cycle_stamps(), 6::smallint, 'RN-29 active cycles keep their copy');

select throws_ok($$ select pg_temp.upd(3::smallint) $$, 'P0001', 'E-23', 'stamps below range');
select throws_ok($$ select pg_temp.upd(p_title => '   ') $$, 'P0001', 'E-23', 'blank title');
select throws_ok($$ select pg_temp.upd(p_hours => 49::smallint) $$, 'P0001', 'E-23', 'hours above range');
select throws_ok($$ select pg_temp.upd(p_terms => repeat('x', 1001)) $$, 'P0001', 'E-23', 'terms too long');

-- field detail
create function pg_temp.field_of(p_sql text) returns text language plpgsql as $$
declare v_detail text;
begin execute p_sql; return null;
exception when others then get stacked diagnostics v_detail = pg_exception_detail; return (v_detail::jsonb) ->> 'field'; end $$;
select is(pg_temp.field_of('select pg_temp.upd(p_hours => 20::smallint)'), 'push_coupon_validity_hours', 'E-23 carries the field');

-- background path
select throws_ok($$ select pg_temp.upd(p_path => 'merchants/20000000-0000-0000-0000-0000000000c2/card/x') $$, 'P0001', 'E-23', 'other merchant folder');
select throws_ok($$ select pg_temp.upd(p_path => 'merchants/20000000-0000-0000-0000-0000000000c1/card/../logo/x') $$, 'P0001', 'E-23', 'traversal');
select throws_ok($$ select pg_temp.upd(p_path => 'merchants/20000000-0000-0000-0000-0000000000c1/card/ghost') $$, 'P0001', 'E-23', 'no uploaded object');
reset role;
select pg_temp.seed_object('merchants/20000000-0000-0000-0000-0000000000c1/card/abc_800.webp');
set local role authenticated;
select pg_temp.as_c1();
select is((pg_temp.upd(p_path => 'merchants/20000000-0000-0000-0000-0000000000c1/card/abc') ->> 'card_background_path'),
  'merchants/20000000-0000-0000-0000-0000000000c1/card/abc', 'uploaded path accepted');

-- RN-71: inactive merchant cannot edit
select pg_temp.login('10000000-0000-0000-0000-0000000000c3', '20000000-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000003');
select throws_ok($$ select pg_temp.upd() $$, 'P0001', 'E-05', 'RN-71 inactive merchant cannot edit');
select * from finish();
rollback;
