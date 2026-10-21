-- =============================================================================
-- LOCAL ONLY. Never run against staging or production: it contains known
-- passwords and a non-secret hash pepper. Staging is populated with the
-- onboarding scripts. Deterministic data of docs/ekko_plan_qa.md §4.2
-- (C4 is production-only and is not seeded).
--
-- Test accounts (password for all: ekko-local-123; merchant PIN: 1234)
-- | Account        | Kind     | State                                                         |
-- |----------------|----------|---------------------------------------------------------------|
-- | c1@ekko.test   | merchant | C1 active + visible, 6-stamp card, wheel, birthday, menu      |
-- | c2@ekko.test   | merchant | C2 active + visible, 4-stamp card, no birthday benefit        |
-- | c3@ekko.test   | merchant | C3 inactive + invisible; U4 related with an active coupon     |
-- | c05..c16@...   | merchant | C5–C16 active + visible, catalog filler (no menu or wheel)    |
-- | u1@ekko.test   | customer | verified email; C1 card with 3 stamps                         |
-- | u2@ekko.test   | customer | unverified email; no relations                                |
-- | u3@ekko.test   | customer | Google identity; birthday this month; C1 and C2 cards         |
-- | u4@ekko.test   | customer | C1 reward coupon (30 d) + C1 wheel coupon expiring in 2 h; C3 |
-- U3 also has a password so it can sign in locally without Google OAuth.
-- =============================================================================

select vault.create_secret('local-dev-pepper-not-secret', 'hash_pepper');

-- Auth users. The auth_trigger migration assigns role = customer and creates the customers rows;
-- merchants carry role = merchant in raw_app_meta_data like the admin API would set it.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('ekko-local-123', extensions.gen_salt('bf')), app.now(),
  u.app_meta, '{}'::jsonb, app.now(), app.now(), '', '', '', ''
from (values
  ('10000000-0000-0000-0000-0000000000c1'::uuid, 'c1@ekko.test',
   '{"provider":"email","providers":["email"],"role":"merchant","merchant_id":"20000000-0000-0000-0000-0000000000c1"}'::jsonb),
  ('10000000-0000-0000-0000-0000000000c2', 'c2@ekko.test',
   '{"provider":"email","providers":["email"],"role":"merchant","merchant_id":"20000000-0000-0000-0000-0000000000c2"}'),
  ('10000000-0000-0000-0000-0000000000c3', 'c3@ekko.test',
   '{"provider":"email","providers":["email"],"role":"merchant","merchant_id":"20000000-0000-0000-0000-0000000000c3"}'),
  ('10000000-0000-0000-0000-0000000000a1', 'u1@ekko.test', '{"provider":"email","providers":["email"]}'),
  ('10000000-0000-0000-0000-0000000000a2', 'u2@ekko.test', '{"provider":"email","providers":["email"]}'),
  ('10000000-0000-0000-0000-0000000000a3', 'u3@ekko.test', '{"provider":"google","providers":["google"]}'),
  ('10000000-0000-0000-0000-0000000000a4', 'u4@ekko.test', '{"provider":"email","providers":["email"]}')
) as u (id, email, app_meta);

-- C5–C16: lightweight visible merchants so the catalog has more than one page (TC-020).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  ('10000000-0000-0000-0000-000000000c' || lpad(n::text, 2, '0'))::uuid, 'authenticated', 'authenticated',
  'c' || lpad(n::text, 2, '0') || '@ekko.test', extensions.crypt('ekko-local-123', extensions.gen_salt('bf')), app.now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'merchant',
                     'merchant_id', '20000000-0000-0000-0000-000000000c' || lpad(n::text, 2, '0')),
  '{}'::jsonb, app.now(), app.now(), '', '', '', ''
from generate_series(5, 16) n;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), x.id, x.provider_id, x.provider,
       jsonb_build_object('sub', x.provider_id, 'email', x.email, 'email_verified', true),
       app.now(), app.now(), app.now()
from (
  select u.id, u.email, u.raw_app_meta_data ->> 'provider' as provider,
         case when u.raw_app_meta_data ->> 'provider' = 'google' then '100000000000000000003' else u.id::text end as provider_id
  from auth.users u
  where u.email like '%@ekko.test'
) x;

-- Customers (rows created by the trigger): profile and verification state.
update public.customers c
set first_name = p.first_name,
    last_name = p.last_name,
    birth_date = p.birth_date,
    email_verified_at = p.verified_at
from (values
  ('10000000-0000-0000-0000-0000000000a1'::uuid, 'Ana', 'Uno', '1995-03-14'::date, app.now()),
  ('10000000-0000-0000-0000-0000000000a2', 'Beto', 'Dos', '1998-07-02', null),
  -- U3: birthday in the current local month, computed at seed time.
  ('10000000-0000-0000-0000-0000000000a3', 'Carla', 'Tres',
   make_date(1992, extract(month from app.local_today())::int, 1), null),
  ('10000000-0000-0000-0000-0000000000a4', 'Diego', 'Cuatro', '1990-11-23', app.now())
) as p (auth_user_id, first_name, last_name, birth_date, verified_at)
where c.auth_user_id = p.auth_user_id;

-- Merchants
insert into public.merchants (
  id, auth_user_id, name, category, description, address, logo_path, cover_path, maps_url,
  reviews_url, birthday_benefit, is_active, is_visible, subscription_status, billing_period, paid_until
) values
  ('20000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-0000000000c1',
   'Café Ekko Centro', 'cafeterias_postres', 'Café de especialidad y postres de la casa.',
   'Av. Juárez 100, Centro', 'merchants/c1/logo', 'merchants/c1/cover',
   'https://maps.example/c1', 'https://reviews.example/c1', 'Un postre gratis en tu mes de cumpleaños',
   true, true, 'active', 'annual', (app.local_today() + interval '1 year')::date),
  ('20000000-0000-0000-0000-0000000000c2', '10000000-0000-0000-0000-0000000000c2',
   'Barbería Ekko', 'barberias', 'Cortes clásicos y arreglo de barba.',
   'Calle Hidalgo 22, Centro', 'merchants/c2/logo', 'merchants/c2/cover',
   'https://maps.example/c2', 'https://reviews.example/c2', null,
   true, true, 'active', 'quarterly', (app.local_today() + interval '3 months')::date),
  ('20000000-0000-0000-0000-0000000000c3', '10000000-0000-0000-0000-0000000000c3',
   'Tacos Ekko (inactivo)', 'restaurantes', 'Comercio inactivo para probar E-05.',
   'Calle Morelos 7, Centro', 'merchants/c3/logo', 'merchants/c3/cover',
   'https://maps.example/c3', 'https://reviews.example/c3', null,
   false, false, 'inactive', 'annual', (app.local_today() - interval '2 months')::date);

insert into public.merchants (
  id, auth_user_id, name, category, description, address, logo_path, cover_path, maps_url,
  reviews_url, is_active, is_visible, subscription_status, billing_period, paid_until
)
select
  ('20000000-0000-0000-0000-000000000c' || f.n)::uuid, ('10000000-0000-0000-0000-000000000c' || f.n)::uuid,
  f.name, f.category::public.merchant_category, f.description, 'Calle ' || f.n || ', Centro',
  'merchants/c' || f.n || '/logo', 'merchants/c' || f.n || '/cover',
  'https://maps.example/c' || f.n, 'https://reviews.example/c' || f.n,
  true, true, 'active', 'annual', (app.local_today() + interval '1 year')::date
from (values
  ('05', 'Panadería La Espiga', 'cafeterias_postres', 'Pan dulce recién horneado.'),
  ('06', 'Cafetería Doña Lupe', 'cafeterias_postres', 'Café de olla y desayunos.'),
  ('07', 'Estética Bella Luz', 'belleza', 'Corte, color y peinado.'),
  ('08', 'Spa Jardín Zen', 'spas', 'Masajes y faciales.'),
  ('09', 'Gimnasio Fuerza Total', 'deporte_salud', 'Pesas y clases grupales.'),
  ('10', 'Bar El Rincón', 'bares_snacks', 'Botanas y cerveza artesanal.'),
  ('11', 'Pizzería Napoli', 'restaurantes', 'Pizza al horno de leña.'),
  ('12', 'Lavandería Exprés', 'servicios', 'Lavado y planchado el mismo día.'),
  ('13', 'Barbería Don Ramón', 'barberias', 'Corte clásico y afeitado.'),
  ('14', 'Uñas y Más', 'belleza', 'Manicure y pedicure.'),
  ('15', 'Mariscos El Güero', 'restaurantes', 'Cocteles y tostadas de mariscos.'),
  ('16', 'Papelería Ábaco', 'otros', 'Útiles escolares y copias.')
) as f (n, name, category, description);

insert into public.loyalty_programs (merchant_id, stamps_required, cycle_months, reward_title, reward_description, terms)
values
  ('20000000-0000-0000-0000-0000000000c1', 6, 6, 'Bebida gratis', 'Cualquier bebida mediana de la carta.', 'Consumo mínimo de $80 por visita.'),
  ('20000000-0000-0000-0000-0000000000c2', 4, 6, 'Corte gratis', 'Un corte clásico sin costo.', 'Consumo mínimo de $150 por visita.'),
  ('20000000-0000-0000-0000-0000000000c3', 6, 6, 'Orden gratis', 'Una orden de 3 tacos.', 'Consumo mínimo de $60 por visita.');

insert into public.loyalty_programs (merchant_id, reward_title, reward_description, terms)
select m.id, 'Premio de la casa', 'Un producto de cortesía.', 'Consumo mínimo de $100 por visita.'
from public.merchants m
where m.id::text like '20000000-0000-0000-0000-000000000c__';

insert into private.merchant_security (merchant_id, pin_hash)
select m.id, extensions.crypt('1234', extensions.gen_salt('bf'))
from public.merchants m
where m.id::text like '20000000-%';

-- C1: wheel (one extra-stamp prize), menu (2 categories, 6 products), 2 weekly offers
insert into private.wheel_prizes (id, merchant_id, label, prize_type, benefit_title, benefit_description, weight, position)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000c1', '10% de descuento', 'coupon', '10% de descuento', 'En tu siguiente consumo.', 60, 1),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000c1', 'Galleta gratis', 'coupon', 'Galleta gratis', 'Una galleta de la vitrina.', 30, 2),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-0000000000c1', 'Sello extra', 'extra_stamp', 'Sello extra', 'Se suma en tu próxima visita.', 10, 3);

insert into public.menu_categories (id, merchant_id, name, position) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000c1', 'Bebidas', 1),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000c1', 'Postres', 2);

insert into public.products (merchant_id, category_id, name, description, price, is_featured, position) values
  ('20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000001', 'Americano', 'Café de origen, 12 oz.', 45, true, 1),
  ('20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000001', 'Latte', 'Espresso con leche vaporizada.', 60, true, 2),
  ('20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000001', 'Chai', 'Té especiado con leche.', 65, false, 3),
  ('20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000002', 'Pay de queso', 'Rebanada con mermelada de frutos rojos.', 70, true, 1),
  ('20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000002', 'Brownie', 'Chocolate amargo y nuez.', 50, false, 2),
  ('20000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000002', 'Galleta', 'Chispas de chocolate.', 30, false, 3);

insert into public.weekly_offers (merchant_id, title, description, weekday, position) values
  ('20000000-0000-0000-0000-0000000000c1', 'Lunes de latte', 'Latte a $45 todo el día.', 1, 1),
  ('20000000-0000-0000-0000-0000000000c1', 'Viernes dulce', '2x1 en galletas después de las 5 pm.', 5, 2);

-- Relations and cycles
insert into public.customer_merchants (customer_id, merchant_id, origin)
select c.id, r.merchant_id, r.origin::public.relation_origin
from (values
  ('10000000-0000-0000-0000-0000000000a1'::uuid, '20000000-0000-0000-0000-0000000000c1'::uuid, 'first_stamp'),
  ('10000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000c1', 'add_card'),
  ('10000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000c2', 'add_card'),
  ('10000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-0000000000c1', 'first_stamp'),
  ('10000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-0000000000c3', 'first_stamp')
) as r (auth_user_id, merchant_id, origin)
join public.customers c on c.auth_user_id = r.auth_user_id;

-- Cycles: (seed id, customer, merchant, status, stamps, started days ago)
insert into public.card_cycles (
  id, customer_id, merchant_id, status, stamps_required, stamps_count,
  reward_title, reward_description, terms, started_at, expires_at, closed_at
)
select
  y.id, c.id, y.merchant_id, y.status::public.cycle_status, lp.stamps_required, y.stamps,
  lp.reward_title, lp.reward_description, lp.terms,
  app.now() - make_interval(days => y.started_days_ago),
  app.now() - make_interval(days => y.started_days_ago) + make_interval(months => lp.cycle_months),
  case when y.status = 'completed' then app.now() - interval '1 day' end
from (values
  -- U1 @ C1: active, 3 stamps
  ('50000000-0000-0000-0000-000000000001'::uuid, '10000000-0000-0000-0000-0000000000a1'::uuid, '20000000-0000-0000-0000-0000000000c1'::uuid, 'active', 3, 10),
  -- U3 @ C1 and C2: active, empty (add_card)
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000c1', 'active', 0, 5),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-0000000000a3', '20000000-0000-0000-0000-0000000000c2', 'active', 0, 5),
  -- U4 @ C1: completed 6/6 (reward coupon) + the new active cycle (RN-26)
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-0000000000c1', 'completed', 6, 20),
  ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-0000000000c1', 'active', 0, 1),
  -- U4 @ C3: completed 6/6 (active coupon at the inactive merchant)
  ('50000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-0000000000c3', 'completed', 6, 60),
  ('50000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-0000000000c3', 'active', 0, 30)
) as y (id, auth_user_id, merchant_id, status, stamps, started_days_ago)
join public.customers c on c.auth_user_id = y.auth_user_id
join public.loyalty_programs lp on lp.merchant_id = y.merchant_id;

-- One used QR token + one stamp per past local day, for every seeded stamp.
with stamp_days as (
  select cc.id as cycle_id, cc.customer_id, cc.merchant_id, n,
         app.now() - make_interval(days => n + 1) as granted_at
  from public.card_cycles cc, generate_series(1, cc.stamps_count) n
  where cc.id::text like '50000000-%'
), tokens as (
  insert into public.visit_qr_tokens (merchant_id, token_hash, created_at, expires_at, used_at, used_by_customer_id)
  select merchant_id, extensions.gen_random_bytes(32), granted_at - interval '10 seconds',
         granted_at + interval '50 seconds', granted_at, customer_id
  from stamp_days
  returning id, merchant_id, used_by_customer_id, used_at
)
insert into public.stamps (cycle_id, customer_id, merchant_id, qr_token_id, local_date, granted_at)
select d.cycle_id, d.customer_id, d.merchant_id, t.id,
       (d.granted_at at time zone 'America/Mexico_City')::date, d.granted_at
from stamp_days d
join tokens t on t.merchant_id = d.merchant_id and t.used_by_customer_id = d.customer_id and t.used_at = d.granted_at;

-- U4 wheel spin at C1 (coupon prize) with its coupon expiring in 2 hours
insert into public.wheel_spins (id, customer_id, merchant_id, prize_id, device_hash, email_hash, spun_at)
select '60000000-0000-0000-0000-000000000001', c.id, '20000000-0000-0000-0000-0000000000c1',
       '30000000-0000-0000-0000-000000000001', app.peppered_hash('seed-device-u4'),
       app.peppered_hash('u4@ekko.test'), app.now() - interval '22 hours'
from public.customers c
where c.auth_user_id = '10000000-0000-0000-0000-0000000000a4';

insert into public.coupons (customer_id, merchant_id, source, cycle_id, spin_id, title, description, terms, code, issued_at, expires_at)
select cc.customer_id, cc.merchant_id, 'card_reward'::public.coupon_source, cc.id, null::uuid,
       cc.reward_title, cc.reward_description, cc.terms, app.random_code(), cc.closed_at, app.now() + interval '30 days'
from public.card_cycles cc
where cc.id in ('50000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000006')
union all
select ws.customer_id, ws.merchant_id, 'wheel'::public.coupon_source, null::uuid, ws.id,
       wp.benefit_title, wp.benefit_description, null, app.random_code(), ws.spun_at, app.now() + interval '2 hours'
from public.wheel_spins ws
join private.wheel_prizes wp on wp.id = ws.prize_id
where ws.id = '60000000-0000-0000-0000-000000000001';
