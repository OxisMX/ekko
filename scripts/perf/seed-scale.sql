-- =============================================================================
-- LOCAL ONLY. Never run against staging or production: it inserts ~1.3 M rows of
-- synthetic data and auth users with a known password (ekko-local-123).
--
-- Scaled dataset on top of supabase/seed.sql (run `pnpm db:reset` first), for NF-01/NF-02
-- (docs/ekko_rendimiento.md). Run (about 1-2 min):
--   docker exec -i supabase_db_ekko psql -U postgres -v ON_ERROR_STOP=1 < scripts/perf/seed-scale.sql
--
-- Adds: 45 merchants (59 visible merchants with the seed ones), 20,000 customers (200 of them with
-- a real Auth user perf-u001..perf-u200@ekko.test), ~150 k relations/active cycles, ~600 k stamps over
-- 12 months, ~80 k coupons (card_reward, wheel, push, birthday; mixed states), 200 k visit QR tokens,
-- menus and weekly offers. Merchants: perf-m01..perf-m45@ekko.test (PIN 1234).
-- Invariants kept: stamps_count = real stamps of the cycle, one visit stamp per local day,
-- one active cycle per relation, unique coupon codes per merchant.
-- =============================================================================
begin;

do $$ begin
  if exists (select 1 from public.merchants where name like 'Perf %') then
    raise exception 'seed-scale already applied: run pnpm db:reset first';
  end if;
end $$;

-- One bcrypt per kind (bcrypt per row would take minutes).
create temp table secrets as
select extensions.crypt('ekko-local-123', extensions.gen_salt('bf')) as password_hash,
       extensions.crypt('1234', extensions.gen_salt('bf')) as pin_hash;

-- Deterministic 6-char code from a per-merchant counter: bijective over 31^6, so unique per merchant.
create function pg_temp.code31(n bigint) returns text language plpgsql immutable as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v bigint := (n * 7919 + 12345) % 887503681;
  s text := '';
begin
  for i in 1..6 loop
    s := substr(alphabet, (v % 31)::int + 1, 1) || s;
    v := v / 31;
  end loop;
  return s;
end $$;

----------------------------------------------------------------------------------------------
-- Merchants (45 new)
----------------------------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000',
       ('11000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'authenticated', 'authenticated',
       'perf-m' || lpad(n::text, 2, '0') || '@ekko.test', (select password_hash from secrets), app.now(),
       jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'merchant',
                          'merchant_id', '21000000-0000-0000-0000-' || lpad(n::text, 12, '0')),
       '{}'::jsonb, app.now(), app.now(), '', '', '', ''
from generate_series(1, 45) n;

insert into public.merchants (
  id, auth_user_id, name, category, description, address, logo_path, cover_path, maps_url,
  reviews_url, birthday_benefit, is_active, is_visible, subscription_status, billing_period, paid_until, created_at
)
select ('21000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       ('11000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'Perf ' || cat || ' ' || n, cat::public.merchant_category, 'Comercio sintético de pruebas de carga.',
       'Calle ' || n || ', Centro', 'merchants/p' || n || '/logo', 'merchants/p' || n || '/cover',
       'https://maps.example/p' || n, 'https://reviews.example/p' || n,
       case when n % 3 = 0 then 'Beneficio de cumpleaños' end,
       true, true, 'active', 'annual', (app.local_today() + interval '1 year')::date,
       app.now() - make_interval(days => 365 - n * 5)
from (select n, (enum_range(null::public.merchant_category))[1 + n % 9]::text as cat from generate_series(1, 45) n) x;

insert into public.loyalty_programs (merchant_id, stamps_required, cycle_months, reward_title, reward_description, terms)
select id, 4 + (row_number() over (order by id))::int % 7, 6, 'Premio de la casa', 'Un producto de cortesía.', 'Consumo mínimo.'
from public.merchants where name like 'Perf %';

insert into private.merchant_security (merchant_id, pin_hash)
select id, (select pin_hash from secrets) from public.merchants where name like 'Perf %';

-- Wheel for the first 14 new merchants.
insert into private.wheel_prizes (merchant_id, label, prize_type, benefit_title, benefit_description, weight, position)
select m.id, p.label, p.type::public.wheel_prize_type, p.label, 'Premio de la ruleta.', p.weight, p.pos
from public.merchants m
cross join (values ('10% de descuento', 'coupon', 60, 1), ('Producto gratis', 'coupon', 30, 2), ('Sello extra', 'extra_stamp', 10, 3))
  as p (label, type, weight, pos)
where m.id::text between '21000000-0000-0000-0000-000000000001' and '21000000-0000-0000-0000-000000000014';

-- Menu: 4 categories x 10 products, 3 weekly offers per new merchant.
insert into public.menu_categories (id, merchant_id, name, position)
select gen_random_uuid(), m.id, 'Categoría ' || c, c from public.merchants m, generate_series(1, 4) c
where m.name like 'Perf %';

insert into public.products (merchant_id, category_id, name, description, price, is_featured, position)
select mc.merchant_id, mc.id, 'Producto ' || mc.position || '-' || p, 'Descripción del producto.', 20 + p * 5, p = 1, p
from public.menu_categories mc, generate_series(1, 10) p
where mc.merchant_id::text like '21000000-%';

insert into public.weekly_offers (merchant_id, title, description, weekday, position)
select m.id, 'Oferta ' || d, 'Descuento del día.', d, d from public.merchants m, generate_series(1, 3) d
where m.name like 'Perf %';

-- Participating merchants (59 = 14 seed visible + 45 new), idx 0..58.
create temp table pool as
select (row_number() over (order by m.id) - 1)::int as idx, m.id as merchant_id, lp.stamps_required as req, lp.cycle_months as months,
       lp.reward_title, lp.reward_description, lp.terms
from public.merchants m join public.loyalty_programs lp on lp.merchant_id = m.id
where m.is_visible;

----------------------------------------------------------------------------------------------
-- Customers: 200 with Auth user (trigger creates the customers row) + 19,800 without
----------------------------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select '00000000-0000-0000-0000-000000000000',
       ('12000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'authenticated', 'authenticated',
       'perf-u' || lpad(n::text, 3, '0') || '@ekko.test', (select password_hash from secrets), app.now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, app.now(), app.now(), '', '', '', ''
from generate_series(1, 200) n;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), app.now(), app.now(), app.now()
from auth.users u where u.email like 'perf-%@ekko.test';

update public.customers c
set first_name = 'Perfil', last_name = 'Usuario', birth_date = date '1990-01-01' + (random() * 5000)::int,
    email_verified_at = app.now()
where c.auth_user_id::text like '12000000-%';

insert into public.customers (first_name, last_name, birth_date, auth_provider, email_verified_at, created_at)
select 'Cliente', 'Sintético ' || n, date '1960-01-01' + (random() * 16000)::int, 'email', app.now(),
       app.now() - make_interval(days => (random() * 365)::int)
from generate_series(1, 19800) n;

create temp table cust as
select id, (row_number() over (order by id))::int as rn,
       floor((select count(*) from pool) * power(random(), 1.6))::int as start_idx,   -- skew: popular merchants first
       1 + floor(random() * 14)::int as k                    -- 1..14 relations, mean 7.5
from public.customers where first_name in ('Perfil', 'Cliente');

----------------------------------------------------------------------------------------------
-- Relations, cycles (active + ~22 % with a completed one before it)
----------------------------------------------------------------------------------------------
create temp table rel as
select c.id as customer_id, p.merchant_id, p.req, p.months, p.reward_title, p.reward_description, p.terms,
       floor(random() * p.req)::int as n_active,
       random() < 0.22 as has_done,
       gen_random_uuid() as active_id, gen_random_uuid() as done_id
from cust c
cross join lateral generate_series(0, c.k - 1) j
join pool p on p.idx = (c.start_idx + j) % (select count(*) from pool);

alter table rel add column a int, add column b int;
update rel set a = n_active + 1 + floor(random() * (150 - n_active))::int;
update rel set b = a + req + 5 + floor(random() * 150)::int where has_done;

insert into public.customer_merchants (customer_id, merchant_id, origin, created_at)
select customer_id, merchant_id, case when random() < 0.5 then 'add_card' else 'first_stamp' end::public.relation_origin,
       app.now() - make_interval(days => coalesce(b, a))
from rel;

insert into public.card_cycles (id, customer_id, merchant_id, status, stamps_required, stamps_count,
                                reward_title, reward_description, terms, started_at, expires_at, closed_at)
select active_id, customer_id, merchant_id, 'active'::public.cycle_status, req, n_active, reward_title, reward_description, terms,
       app.now() - make_interval(days => a), app.now() - make_interval(days => a) + make_interval(months => months), null
from rel
union all
select done_id, customer_id, merchant_id, 'completed'::public.cycle_status, req, req, reward_title, reward_description, terms,
       app.now() - make_interval(days => b), app.now() - make_interval(days => b) + make_interval(months => months),
       app.now() - make_interval(days => b - req)
from rel where has_done;

----------------------------------------------------------------------------------------------
-- Stamps (one visit stamp per local day) and QR tokens
----------------------------------------------------------------------------------------------
create temp table stamp_src as
select cycle_id, customer_id, merchant_id, day_ago,
       case when random() < 0.27 then gen_random_uuid() end as token_id,
       ((app.local_today() - day_ago)::timestamp + make_interval(hours => 9 + floor(random() * 12)::int, mins => floor(random() * 60)::int))
         at time zone 'America/Mexico_City' as granted_at
from (
  select active_id as cycle_id, customer_id, merchant_id, a - j as day_ago
  from rel cross join lateral generate_series(1, n_active) j
  union all
  select done_id, customer_id, merchant_id, b - j
  from rel cross join lateral generate_series(1, req) j where has_done
) s;

-- Used tokens (linked to a stamp) + unused ones (expired or replaced by a newer QR) up to 200 k.
insert into public.visit_qr_tokens (id, merchant_id, token_hash, created_at, expires_at, used_at, used_by_customer_id, invalidated_at)
select token_id, merchant_id, sha256(convert_to(token_id::text, 'UTF8')), granted_at - interval '10 seconds',
       granted_at + interval '50 seconds', granted_at, customer_id, null
from stamp_src where token_id is not null;

insert into public.visit_qr_tokens (merchant_id, token_hash, created_at, expires_at, invalidated_at)
select p.merchant_id, sha256(convert_to(gen_random_uuid()::text, 'UTF8')), t.at, t.at + interval '60 seconds',
       case when n % 2 = 0 then t.at + interval '20 seconds' end
from (select n, (n * 7) % (select count(*) from pool) as idx, app.now() - make_interval(secs => (random() * 365 * 86400)::int) as at
      from generate_series(1, greatest(0, 200000 - (select count(*) from stamp_src where token_id is not null))::int) n) t
join pool p on p.idx = t.idx;

insert into public.stamps (cycle_id, customer_id, merchant_id, qr_token_id, is_bonus, local_date, granted_at)
select cycle_id, customer_id, merchant_id, token_id, false, app.local_today() - day_ago, granted_at
from stamp_src;

----------------------------------------------------------------------------------------------
-- Wheel spins (14 wheel merchants, 25 % of their relations) and push campaigns
----------------------------------------------------------------------------------------------
insert into public.wheel_spins (customer_id, merchant_id, prize_id, device_hash, email_hash, spun_at)
select r.customer_id, r.merchant_id, pz.id, sha256(convert_to(gen_random_uuid()::text, 'UTF8')),
       sha256(convert_to(gen_random_uuid()::text, 'UTF8')), app.now() - make_interval(days => 1 + floor(random() * (r.a - 1))::int)
from rel r
join lateral (select w.id from private.wheel_prizes w where w.merchant_id = r.merchant_id
              order by (w.id::text || r.customer_id::text) limit 1) pz on true
where random() < 0.25;

insert into public.push_campaigns (merchant_id, idempotency_key, title, body, has_coupon, coupon_title, coupon_description,
                                   coupon_terms, coupon_validity_hours, local_month, status, recipients_count, sent_count, created_at)
select p.merchant_id, gen_random_uuid(), 'Oferta del mes', 'Visítanos y aprovecha tu cupón.', true, 'Cupón del mes',
       'Descuento especial.', 'Válido en tienda.', 48, date_trunc('month', app.local_today() - make_interval(months => m))::date,
       'sent', 1000, 1000, app.now() - make_interval(months => m)
from pool p cross join generate_series(1, 2) m
where p.idx < 12;

----------------------------------------------------------------------------------------------
-- Coupons (~80 k): card_reward, wheel, push, birthday; codes unique per merchant
----------------------------------------------------------------------------------------------
create temp table cpn as
-- Reward of every completed cycle: 30 days from closing.
select cc.customer_id, cc.merchant_id, 'card_reward'::public.coupon_source as source, cc.id as cycle_id, null::uuid as spin_id,
       null::uuid as campaign_id, null::smallint as birthday_year, cc.reward_title as title, cc.reward_description as description,
       cc.terms, cc.closed_at as issued_at, cc.closed_at + interval '30 days' as expires_at
from public.card_cycles cc where cc.status = 'completed' and cc.id in (select done_id from rel)
union all
select ws.customer_id, ws.merchant_id, 'wheel', null, ws.id, null, null, wp.benefit_title, wp.benefit_description, null,
       ws.spun_at, ws.spun_at + interval '48 hours'
from public.wheel_spins ws join private.wheel_prizes wp on wp.id = ws.prize_id
where wp.prize_type = 'coupon' and ws.customer_id in (select id from cust)
union all
-- Push coupon to ~1,200 of the merchant's customers per campaign.
select cm.customer_id, pc.merchant_id, 'push', null, null, pc.id, null, pc.coupon_title, pc.coupon_description, pc.coupon_terms,
       pc.created_at, pc.created_at + interval '48 hours'
from public.push_campaigns pc
join lateral (select x.customer_id from public.customer_merchants x where x.merchant_id = pc.merchant_id
              order by md5(x.customer_id::text || pc.id::text) limit 1200) cm on true
union all
-- Birthday coupon on 8 % of the relations (one year per relation).
select r.customer_id, r.merchant_id, 'birthday', null, null, null, (2025 + (random() < 0.5)::int)::smallint,
       'Beneficio de cumpleaños', 'Regalo de cumpleaños.', null,
       app.now() - make_interval(days => 1 + floor(random() * 300)::int), null
from rel r where random() < 0.08;

insert into public.coupons (customer_id, merchant_id, source, cycle_id, spin_id, campaign_id, birthday_year, title, description,
                            terms, code, status, issued_at, expires_at, redeemed_at)
select customer_id, merchant_id, source, cycle_id, spin_id, campaign_id, birthday_year, title, description, terms,
       pg_temp.code31(row_number() over (partition by merchant_id order by issued_at, customer_id)),
       st, issued_at, exp, case when st = 'redeemed' then issued_at + interval '3 days' end
from (
  select *, coalesce(expires_at, issued_at + interval '30 days') as exp,
         case when random() < 0.55 then 'redeemed' else 'active' end::public.coupon_status as st
  from cpn
) x;

analyze public.customers, public.merchants, public.customer_merchants, public.card_cycles, public.stamps, public.coupons, public.visit_qr_tokens, public.wheel_spins;
commit;

select 'merchants' as t, count(*) from public.merchants union all
select 'customers', count(*) from public.customers union all
select 'customer_merchants', count(*) from public.customer_merchants union all
select 'card_cycles', count(*) from public.card_cycles union all
select 'stamps', count(*) from public.stamps union all
select 'coupons', count(*) from public.coupons union all
select 'visit_qr_tokens', count(*) from public.visit_qr_tokens union all
select 'products', count(*) from public.products;
