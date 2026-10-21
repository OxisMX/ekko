-- Backend §4.2 get_merchant_detail / add_card and §4.4 generate_visit_qr (S4), plus the
-- visit_qr_tokens part of migration 013 (§6.2), needed by the panel's Realtime subscription (S5).

-- Wheel status for a customer that HAS a relation with the merchant. 'device_used' is not
-- returned here: the device is only known at spin time (spin_wheel, S8, E-09).
-- WHY 'unavailable' before 'needs_verification': asking to verify for a wheel that cannot be
-- spun (inactive merchant, RN-71, or no active prizes) would be a dead end.
create function app.wheel_status(p_customer public.customers, p_merchant public.merchants)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.wheel_spins ws where ws.customer_id = p_customer.id and ws.merchant_id = p_merchant.id) then 'spun'
    when not p_merchant.is_active
      or not exists (select 1 from private.wheel_prizes wp where wp.merchant_id = p_merchant.id and wp.is_active) then 'unavailable'
    when not app.is_email_verified(p_customer) then 'needs_verification'
    else 'available'
  end;
$$;

revoke execute on function app.wheel_status(public.customers, public.merchants) from public, anon, authenticated;

create function public.add_card(p_merchant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_merchant public.merchants;
  v_created boolean;
begin
  select m.* into v_merchant
  from public.merchants m
  where m.id = p_merchant_id and m.is_active and m.is_visible;
  if not found then
    perform app.raise('E-05');
  end if;

  insert into public.customer_merchants (customer_id, merchant_id, origin)
  values (v_customer.id, p_merchant_id, 'add_card')
  on conflict do nothing;
  v_created := found;

  perform app.roll_cycle(v_customer.id, p_merchant_id);

  return jsonb_build_object('created', v_created, 'wheel', jsonb_build_object('status', app.wheel_status(v_customer, v_merchant)));
end;
$$;

create function public.get_merchant_detail(p_merchant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_now timestamptz := app.now();
  v_today date := app.local_today();
  v_merchant public.merchants;
  v_program public.loyalty_programs;
  v_relation public.customer_merchants;
  v_has_relation boolean;
  v_cycle public.card_cycles;
  v_card jsonb;
begin
  select cm.* into v_relation
  from public.customer_merchants cm
  where cm.customer_id = v_customer.id and cm.merchant_id = p_merchant_id;
  v_has_relation := found;

  select m.* into v_merchant from public.merchants m where m.id = p_merchant_id;
  -- RN-53 / RN-71: an invisible merchant is only reachable through an existing relation.
  if not found or (not v_merchant.is_visible and not v_has_relation) then
    perform app.raise('E-05');
  end if;

  select lp.* into v_program from public.loyalty_programs lp where lp.merchant_id = p_merchant_id;

  if v_has_relation then
    v_cycle := app.roll_cycle(v_customer.id, p_merchant_id);
    v_card := jsonb_build_object(
      'has_relation', true,
      'stamps_required', v_cycle.stamps_required,
      'stamps', (
        select coalesce(jsonb_agg(jsonb_build_object('granted_at', s.granted_at, 'is_bonus', s.is_bonus) order by s.granted_at), '[]'::jsonb)
        from public.stamps s where s.cycle_id = v_cycle.id
      ),
      'cycle_expires_at', v_cycle.expires_at,
      'reward_title', v_cycle.reward_title,
      'reward_description', v_cycle.reward_description,
      'terms', v_cycle.terms,
      'background_path', v_program.card_background_path,
      'pending_extra_stamps', v_relation.pending_extra_stamps,
      -- RN-27: the earliest-expiring active reward coupon, if any.
      'reward_coupon_id', (
        select c.id from public.coupons c
        where c.customer_id = v_customer.id and c.merchant_id = p_merchant_id and c.source = 'card_reward'
          and c.status = 'active' and c.expires_at > v_now
        order by c.expires_at limit 1
      ),
      'stamped_today', exists (
        select 1 from public.stamps s
        where s.customer_id = v_customer.id and s.merchant_id = p_merchant_id and not s.is_bonus and s.local_date = v_today
      )
    );
  else
    v_card := jsonb_build_object(
      'has_relation', false,
      'stamps_required', v_program.stamps_required,
      'stamps', '[]'::jsonb,
      'cycle_expires_at', null,
      'reward_title', v_program.reward_title,
      'reward_description', v_program.reward_description,
      'terms', v_program.terms,
      'background_path', v_program.card_background_path,
      'pending_extra_stamps', 0,
      'reward_coupon_id', null,
      'stamped_today', false
    );
  end if;

  return jsonb_build_object(
    'merchant', jsonb_build_object(
      'id', v_merchant.id, 'name', v_merchant.name, 'category', v_merchant.category,
      'description', v_merchant.description, 'address', v_merchant.address,
      'logo_path', v_merchant.logo_path, 'cover_path', v_merchant.cover_path,
      'maps_url', v_merchant.maps_url, 'reviews_url', v_merchant.reviews_url,
      'available', v_merchant.is_active and v_merchant.is_visible
    ),
    'card', v_card,
    'wheel', jsonb_build_object('status',
      case when v_has_relation then app.wheel_status(v_customer, v_merchant) else 'no_relation' end),
    'menu', jsonb_build_object(
      'categories', (
        select coalesce(jsonb_agg(jsonb_build_object('id', mc.id, 'name', mc.name, 'position', mc.position)
                                  order by mc.position, mc.id), '[]'::jsonb)
        from public.menu_categories mc where mc.merchant_id = p_merchant_id
      ),
      'products', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'id', p.id, 'category_id', p.category_id, 'name', p.name, 'description', p.description,
                 'price', p.price, 'image_path', p.image_path, 'is_featured', p.is_featured,
                 -- RN-56: sold out only on the local day it was marked.
                 'is_sold_out', p.sold_out_on is not distinct from v_today
               ) order by mc.position, mc.id, p.position, p.id), '[]'::jsonb)
        from public.products p
        join public.menu_categories mc on mc.id = p.category_id
        where p.merchant_id = p_merchant_id
      )
    ),
    'offers', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'title', o.title, 'description', o.description, 'weekday', o.weekday, 'image_path', o.image_path
             ) order by o.weekday, o.position, o.id), '[]'::jsonb)
      from public.weekly_offers o where o.merchant_id = p_merchant_id
    ),
    -- WHY no code: the code is only revealed by reveal_coupon_code (RN-05, S7).
    'coupons', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'source', c.source, 'title', c.title, 'description', c.description,
               'terms', c.terms, 'expires_at', c.expires_at
             ) order by c.expires_at, c.id), '[]'::jsonb)
      from public.coupons c
      where c.customer_id = v_customer.id and c.merchant_id = p_merchant_id
        and c.status = 'active' and c.expires_at > v_now
    )
  );
end;
$$;

create function public.generate_visit_qr()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant();
  v_token text;
  v_qr public.visit_qr_tokens;
begin
  -- WHY lock the merchant row: two concurrent generations (double tap) would otherwise both
  -- stay pending; serialized, the second one invalidates the first (RN-14).
  perform 1 from public.merchants m where m.id = v_merchant.id for update;

  update public.visit_qr_tokens t
  set invalidated_at = app.now()
  where t.merchant_id = v_merchant.id and t.used_at is null and t.invalidated_at is null and t.expires_at > app.now();

  -- TRD §6.4: 128 random bits as base64url without padding (22 chars). Only the SHA-256 of the
  -- token's UTF-8 text is stored; claim_visit (S5) hashes the received string the same way.
  v_token := pg_catalog.rtrim(pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(16), 'base64'), '+/', '-_'), '=');

  insert into public.visit_qr_tokens (merchant_id, token_hash, created_at, expires_at)
  values (v_merchant.id, pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')), app.now(), app.now() + interval '60 seconds')
  returning * into v_qr;

  -- ttl_seconds lets the panel run its countdown without trusting the tablet clock.
  return jsonb_build_object('qr_id', v_qr.id, 'token', v_token, 'expires_at', v_qr.expires_at, 'ttl_seconds', 60);
end;
$$;

-- WHY: Supabase grants EXECUTE on new public functions to anon by default.
revoke execute on function public.add_card(uuid) from public, anon;
revoke execute on function public.get_merchant_detail(uuid) from public, anon;
revoke execute on function public.generate_visit_qr() from public, anon;
grant execute on function public.add_card(uuid) to authenticated;
grant execute on function public.get_merchant_detail(uuid) to authenticated;
grant execute on function public.generate_visit_qr() to authenticated;

-- §6.2 visit_qr_tokens: the owning merchant reads status columns only (Realtime, S5). token_hash
-- and used_by_customer_id stay unreadable through column privileges; writes go through RPCs.
revoke all on public.visit_qr_tokens from anon, authenticated;
grant select (id, merchant_id, created_at, expires_at, used_at, invalidated_at) on public.visit_qr_tokens to authenticated;

create policy visit_qr_tokens_select on public.visit_qr_tokens
  for select to authenticated
  using (merchant_id in (select m.id from public.merchants m where m.auth_user_id = (select auth.uid())));
