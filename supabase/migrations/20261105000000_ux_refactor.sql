-- UX refactor: favorites, editable customer profile, merchant profile, custom stamp image,
-- push validity options and metric series.

------------------------------------------------------------------------------------------------
-- 5. Push coupon validity: fixed options instead of a range
------------------------------------------------------------------------------------------------

-- WHY: rows saved under the old 24..48 range (e.g. 30) are moved to 24 so the new check can apply.
update public.merchants set push_coupon_validity_hours = 24
where push_coupon_validity_hours not in (6, 12, 24, 36, 48);
alter table public.merchants drop constraint merchants_push_coupon_validity_hours_check;
alter table public.merchants add constraint merchants_push_coupon_validity_hours_check
  check (push_coupon_validity_hours in (6, 12, 24, 36, 48));
-- WHY not valid: sent campaigns are history and keep the validity they were issued with.
alter table public.push_campaigns drop constraint push_campaigns_coupon_validity_hours_check;
alter table public.push_campaigns add constraint push_campaigns_coupon_validity_hours_check
  check (coupon_validity_hours in (6, 12, 24, 36, 48)) not valid;

-- Same body as offers_push; only the validity allowlist changes.
create or replace function public.create_push_campaign(p_merchant_id uuid, p_auth_session_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := app.now();
  v_merchant public.merchants;
  v_coupon jsonb := p_payload -> 'coupon';
  v_has_coupon boolean := coalesce(pg_catalog.jsonb_typeof(p_payload -> 'coupon') = 'object', false);
  v_key_text text := p_payload ->> 'idempotency_key';
  v_key uuid;
  v_title text := pg_catalog.btrim(p_payload ->> 'title');
  v_body text := pg_catalog.btrim(p_payload ->> 'body');
  v_coupon_title text := pg_catalog.btrim(v_coupon ->> 'title');
  v_coupon_description text := pg_catalog.btrim(v_coupon ->> 'description');
  v_coupon_terms text := pg_catalog.btrim(v_coupon ->> 'terms');
  v_hours_text text := v_coupon ->> 'validity_hours';
  v_hours smallint;
  v_campaign public.push_campaigns;
  v_customer_id uuid;
  v_recipients integer := 0;
begin
  if p_merchant_id is null or p_auth_session_id is null then
    perform app.raise('E-19');
  end if;

  -- WHY lock first: serializes sends of one merchant so concurrent calls cannot exceed the quota.
  select m.* into v_merchant from public.merchants m where m.id = p_merchant_id for update;
  if not found then
    perform app.raise('E-19');
  end if;

  update private.merchant_admin_sessions a
  set expires_at = v_now + interval '5 minutes'
  where a.merchant_id = p_merchant_id and a.auth_session_id = p_auth_session_id and a.expires_at > v_now;
  if not found then
    perform app.raise('E-16');
  end if;
  if not v_merchant.is_active then
    perform app.raise('E-05'); -- RN-71
  end if;

  if v_key_text is null or v_key_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform app.raise('E-23', '{"field":"idempotency_key"}');
  end if;
  v_key := v_key_text::uuid;
  if v_title is null or pg_catalog.char_length(v_title) not between 1 and 50 then
    perform app.raise('E-23', '{"field":"title"}');
  elsif v_body is null or pg_catalog.char_length(v_body) not between 1 and 150 then
    perform app.raise('E-23', '{"field":"body"}');
  elsif p_payload -> 'coupon' is not null and pg_catalog.jsonb_typeof(p_payload -> 'coupon') not in ('object', 'null') then
    perform app.raise('E-23', '{"field":"coupon_title"}');
  elsif v_has_coupon then
    if v_coupon_title is null or pg_catalog.char_length(v_coupon_title) not between 1 and 60 then
      perform app.raise('E-23', '{"field":"coupon_title"}');
    elsif v_coupon_description is null or pg_catalog.char_length(v_coupon_description) not between 1 and 200 then
      perform app.raise('E-23', '{"field":"coupon_description"}');
    elsif v_coupon_terms is null or pg_catalog.char_length(v_coupon_terms) not between 1 and 1000 then
      perform app.raise('E-23', '{"field":"coupon_terms"}');
    elsif v_hours_text is null or v_hours_text !~ '^(6|12|24|36|48)$' then
      perform app.raise('E-23', '{"field":"coupon_validity_hours"}');
    end if;
    v_hours := v_hours_text::smallint;
  end if;

  -- Idempotency (RN-46 retries): same key returns the stored campaign and does not use quota.
  select c.* into v_campaign from public.push_campaigns c
  where c.merchant_id = p_merchant_id and c.idempotency_key = v_key;
  if found then
    return app.push_campaign_result(v_campaign, true);
  end if;

  if app.push_remaining(p_merchant_id) = 0 then
    perform app.raise('E-17', pg_catalog.jsonb_build_object(
      'resets_on', (app.push_month_start() + interval '1 month')::date));
  end if;

  select pg_catalog.count(*) into v_recipients from app.push_recipient_ids(p_merchant_id);
  insert into public.push_campaigns (
    merchant_id, idempotency_key, title, body, has_coupon, coupon_title, coupon_description, coupon_terms,
    coupon_validity_hours, local_month, status, recipients_count)
  values (p_merchant_id, v_key, v_title, v_body, v_has_coupon, v_coupon_title, v_coupon_description,
    v_coupon_terms, v_hours, app.push_month_start(), 'sending', v_recipients)
  returning * into v_campaign;

  -- RN-48: a coupon for every recipient, even those with notifications off.
  if v_has_coupon then
    for v_customer_id in select r from app.push_recipient_ids(p_merchant_id) r loop
      -- A random code can collide within the merchant; retry with a new one (as spin_wheel does).
      for v_attempt in 1..5 loop
        begin
          insert into public.coupons (customer_id, merchant_id, source, campaign_id, title, description, terms, code, issued_at, expires_at)
          values (v_customer_id, p_merchant_id, 'push', v_campaign.id, v_coupon_title, v_coupon_description,
                  v_coupon_terms, app.random_code(), v_now, v_now + pg_catalog.make_interval(hours => v_hours));
          exit;
        exception when unique_violation then
          if v_attempt = 5 then raise; end if;
        end;
      end loop;
    end loop;
  end if;

  return app.push_campaign_result(v_campaign, false);
end;
$$;

------------------------------------------------------------------------------------------------
-- Storage: customer avatars bucket and merchant brand folder
------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-avatars', 'customer-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy customer_avatars_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'customer-avatars');
-- WHY folder = auth.uid(): each user writes only under their own folder.
create policy customer_avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy customer_avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy customer_avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'customer-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- WHY 'brand': logo and cover are now editable from the panel (update_merchant_profile), under
-- merchants/{id}/brand/. Everything else is unchanged from card_config_storage.
create or replace function rls.can_write_merchant_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.merchants m
    join private.merchant_admin_sessions a on a.merchant_id = m.id
    where auth.jwt() -> 'app_metadata' ->> 'role' = 'merchant'
      and m.auth_user_id = auth.uid()
      and m.is_active
      and a.auth_session_id::text = auth.jwt() ->> 'session_id'
      and a.expires_at > app.now()
      and (storage.foldername(p_name))[1] = 'merchants'
      and (storage.foldername(p_name))[2] = m.id::text
      and (storage.foldername(p_name))[3] in ('card', 'product', 'offer', 'brand')
  );
$$;

-- WHY a helper: card background, stamp image, logo and cover share the same path check. The path is
-- stored without the _{width}.webp suffix (§7), so any uploaded object starting with it counts.
create function app.merchant_media_path_valid(p_path text, p_prefix text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_path ~ ('^' || p_prefix || '[A-Za-z0-9_.-]+$')
    and p_path not like '%..%'
    and exists (
      select 1 from storage.objects o
      -- WHY regexp_replace: a JPEG fallback stores the real extension ("<base>.jpg"; backend §7).
      where o.bucket_id = 'merchant-media'
        and pg_catalog.starts_with(o.name, pg_catalog.regexp_replace(p_path, '\.jpg$', '') || '_'));
$$;
revoke execute on function app.merchant_media_path_valid(text, text) from public, anon, authenticated;

------------------------------------------------------------------------------------------------
-- 1. Favorites
------------------------------------------------------------------------------------------------

create table public.customer_favorites (
  customer_id uuid not null references public.customers (id),
  merchant_id uuid not null references public.merchants (id),
  created_at timestamptz not null default app.now(),
  primary key (customer_id, merchant_id)
);
-- WHY the reverse index: list_merchants filters by customer (PK), but deleting a merchant looks up by merchant.
create index customer_favorites_merchant_idx on public.customer_favorites (merchant_id);
alter table public.customer_favorites enable row level security;
revoke all on public.customer_favorites from anon, authenticated;

-- Returns the new state. WHY removal is always allowed: a merchant that went invisible must still be un-favoritable.
create function public.toggle_favorite(p_merchant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
begin
  delete from public.customer_favorites f
  where f.customer_id = v_customer.id and f.merchant_id = p_merchant_id;
  if found then
    return '{"is_favorite": false}'::jsonb;
  end if;

  perform 1 from public.merchants m where m.id = p_merchant_id and m.is_active and m.is_visible;
  if not found then
    perform app.raise('E-05');
  end if;

  insert into public.customer_favorites (customer_id, merchant_id)
  values (v_customer.id, p_merchant_id)
  on conflict do nothing;
  return '{"is_favorite": true}'::jsonb;
end;
$$;
revoke execute on function public.toggle_favorite(uuid) from public, anon;
grant execute on function public.toggle_favorite(uuid) to authenticated;

-- Same body as catalog_rpc; adds is_favorite and favorites-first order.
create or replace function public.list_merchants(
  p_seed text,
  p_query text default null,
  p_category public.merchant_category default null,
  p_offset integer default 0,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_query text := nullif(pg_catalog.btrim(p_query), '');
  v_pattern text;
  v_result jsonb;
begin
  if p_seed is null or pg_catalog.char_length(p_seed) not between 1 and 64 then
    perform app.raise('E-23', '{"field":"seed"}');
  end if;
  if p_limit is null or p_limit not between 1 and 20 then
    perform app.raise('E-23', '{"field":"limit"}');
  end if;
  if p_offset is null or p_offset < 0 then
    perform app.raise('E-23', '{"field":"offset"}');
  end if;

  -- WHY: the query is a literal substring; LIKE wildcards typed by the user must not match anything.
  if v_query is not null then
    v_pattern := '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
      app.search_text(v_query), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  -- One extra row (limit + 1) tells whether another page exists (has_more).
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(r.item order by r.ord) filter (where r.ord <= p_offset + p_limit), '[]'::jsonb),
    'has_more', pg_catalog.count(*) > p_limit
  ) into v_result
  from (
    select
      jsonb_build_object(
        'id', m.id, 'name', m.name, 'category', m.category, 'description', m.description,
        'logo_path', m.logo_path, 'cover_path', m.cover_path, 'maps_url', m.maps_url,
        'is_favorite', fav.is_favorite
      ) as item,
      -- RN-52: stable random order per session seed; id breaks (improbable) md5 ties. Favorites go
      -- first, and inside each group the seeded order is kept so pagination stays stable.
      pg_catalog.row_number() over (order by fav.is_favorite desc, pg_catalog.md5(m.id::text || p_seed), m.id) as ord
    from public.merchants m
    cross join lateral (
      select exists (select 1 from public.customer_favorites f
                     where f.customer_id = v_customer.id and f.merchant_id = m.id) as is_favorite
    ) fav
    where m.is_visible
      and (p_category is null or m.category = p_category)
      and (v_pattern is null or app.search_text(m.name) like v_pattern)
    order by ord
    offset p_offset
    limit p_limit + 1
  ) r;

  return v_result;
end;
$$;

-- Same body as merchant_detail_rpc; adds is_favorite, stamp_image_path and logo_path.
create or replace function public.get_merchant_detail(p_merchant_id uuid)
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
      'stamp_image_path', v_program.stamp_image_path,
      'logo_path', v_merchant.logo_path,
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
      'stamp_image_path', v_program.stamp_image_path,
      'logo_path', v_merchant.logo_path,
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
      'available', v_merchant.is_active and v_merchant.is_visible,
      'is_favorite', exists (select 1 from public.customer_favorites f
                             where f.customer_id = v_customer.id and f.merchant_id = v_merchant.id)
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

-- Same body as my_cards_rpc; adds stamp_image_path.
create or replace function public.list_my_cards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_now timestamptz := app.now();
begin
  -- WHY every relation, including unavailable merchants: RN-71 shows them as "No disponible".
  -- Lazy cycle rollover (TRD §7.2) runs per relation so expired partial stamps read as 0 (RN-25).
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'merchant_id', card.merchant_id,
        'merchant_name', card.merchant_name,
        'logo_path', card.logo_path,
        'stamp_image_path', card.stamp_image_path,
        'merchant_available', card.merchant_available,
        'stamps_count', card.stamps_count,
        'stamps_required', card.stamps_required,
        'cycle_expires_at', card.cycle_expires_at,
        'reward_available', card.reward_available,
        'wheel_status', card.wheel_status
      )
      order by card.reward_available desc, card.merchant_available desc, card.created_at desc, card.merchant_id
    )
    from (
      select
        m.id as merchant_id, m.name as merchant_name, m.logo_path, lp.stamp_image_path, cm.created_at,
        m.is_active and m.is_visible as merchant_available,
        cy.stamps_count, cy.stamps_required, cy.expires_at as cycle_expires_at,
        exists (
          select 1 from public.coupons c
          where c.customer_id = v_customer.id and c.merchant_id = m.id and c.source = 'card_reward'
            and c.status = 'active' and c.expires_at > v_now
        ) as reward_available,
        app.wheel_status(v_customer, m) as wheel_status
      from public.customer_merchants cm
      join public.merchants m on m.id = cm.merchant_id
      join public.loyalty_programs lp on lp.merchant_id = m.id
      cross join lateral app.roll_cycle(cm.customer_id, cm.merchant_id) cy
      where cm.customer_id = v_customer.id
    ) card
  ), '[]'::jsonb);
end;
$$;

------------------------------------------------------------------------------------------------
-- 2. Customer profile
------------------------------------------------------------------------------------------------

alter table public.customers add column avatar_path text;
alter table public.customers add column push_opt_in boolean not null default true;

-- WHY a helper: get_my_profile and update_profile return the same shape.
create function app.customer_profile_json(p_customer public.customers)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'first_name', p_customer.first_name,
    'last_name', p_customer.last_name,
    'birth_date', p_customer.birth_date,
    'email', (select u.email from auth.users u where u.id = p_customer.auth_user_id),
    'auth_provider', p_customer.auth_provider,
    'email_verified', app.is_email_verified(p_customer),
    'profile_complete', p_customer.first_name is not null
      and p_customer.last_name is not null
      and p_customer.birth_date is not null,
    'avatar_path', p_customer.avatar_path,
    'push_opt_in', p_customer.push_opt_in);
$$;
revoke execute on function app.customer_profile_json(public.customers) from public, anon, authenticated;

create or replace function public.get_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return app.customer_profile_json(app.current_customer());
end;
$$;

-- WHY no email / birth_date params: they only change through Oxis support (RN-04).
create function public.update_profile(
  p_first_name text, p_last_name text, p_avatar_path text, p_push_opt_in boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_first_name text := pg_catalog.btrim(p_first_name);
  v_last_name text := pg_catalog.btrim(p_last_name);
begin
  if v_first_name is null or pg_catalog.char_length(v_first_name) not between 2 and 50 then
    perform app.raise('E-23', '{"field":"first_name"}');
  elsif v_last_name is null or pg_catalog.char_length(v_last_name) not between 2 and 50 then
    perform app.raise('E-23', '{"field":"last_name"}');
  elsif p_push_opt_in is null then
    perform app.raise('E-23', '{"field":"push_opt_in"}');
  end if;

  -- WHY allowlist regex: only a file directly inside the caller's own folder, no '..' segments.
  -- An unchanged value is accepted as is so saving the form never fails on an existing avatar.
  if p_avatar_path is not null and p_avatar_path is distinct from v_customer.avatar_path and (
    p_avatar_path !~ ('^' || v_customer.auth_user_id || '/[A-Za-z0-9_.-]+$')
    or p_avatar_path like '%..%'
    or not exists (
      select 1 from storage.objects o where o.bucket_id = 'customer-avatars' and o.name = p_avatar_path)
  ) then
    perform app.raise('E-23', '{"field":"avatar_path"}');
  end if;

  update public.customers c
  set first_name = v_first_name, last_name = v_last_name, avatar_path = p_avatar_path,
      push_opt_in = p_push_opt_in
  where c.id = v_customer.id
  returning * into v_customer;

  return app.customer_profile_json(v_customer);
end;
$$;
revoke execute on function public.update_profile(text, text, text, boolean) from public, anon;
grant execute on function public.update_profile(text, text, text, boolean) to authenticated;

-- WHY the filter lives here and not in push_recipient_ids: RN-48 still issues the coupon to every
-- recipient (it shows in the app); opting out of push only stops the notification itself.
create or replace function public.get_push_recipients(p_campaign_id uuid)
returns table (customer_id uuid, coupon_id uuid, token text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.customer_id, cp.id, d.expo_push_token
  from public.push_campaigns pc
  join lateral app.push_recipient_ids(pc.merchant_id) r(id) on true
  join public.customers cu on cu.id = r.id and cu.push_opt_in
  join public.customer_devices d on d.customer_id = r.id
  left join public.coupons cp on cp.campaign_id = pc.id and cp.customer_id = r.id
  where pc.id = p_campaign_id
    and d.push_enabled and d.expo_push_token is not null and d.signed_out_at is null
  order by d.customer_id, d.id;
$$;

-- Same body as metrics_delete_account; also clears avatar_path and favorites.
create or replace function public.anonymize_customer(p_customer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  select c.* into v_customer from public.customers c where c.id = p_customer_id for update;
  if not found then
    perform app.raise('E-23', '{"field":"customer_id"}');
  end if;
  if v_customer.status = 'deleted' then
    return false;
  end if;

  update public.customers
  set first_name = null, last_name = null, birth_date = null, avatar_path = null, status = 'deleted', deleted_at = app.now()
  where id = p_customer_id;

  -- device_hash stays (RN-07); the token goes so the account stops receiving push.
  update public.customer_devices set expo_push_token = null, push_enabled = false where customer_id = p_customer_id;
  delete from public.coupons where customer_id = p_customer_id and status = 'active';
  update public.card_cycles set status = 'expired', closed_at = app.now()
  where customer_id = p_customer_id and status = 'active';
  delete from public.customer_favorites where customer_id = p_customer_id;
  delete from public.customer_merchants where customer_id = p_customer_id;
  -- stamps, wheel_spins (email_hash, device_hash, RN-09) and redeemed coupons stay under the anonymous id.
  return true;
end;
$$;

------------------------------------------------------------------------------------------------
-- 3. Merchant profile (panel, PIN-protected)
------------------------------------------------------------------------------------------------

create function app.merchant_profile_json(p_merchant public.merchants)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'name', p_merchant.name, 'category', p_merchant.category, 'description', p_merchant.description,
    'maps_url', p_merchant.maps_url, 'reviews_url', p_merchant.reviews_url,
    'logo_path', p_merchant.logo_path, 'cover_path', p_merchant.cover_path);
$$;
revoke execute on function app.merchant_profile_json(public.merchants) from public, anon, authenticated;

create function public.get_merchant_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  perform app.require_admin_session();
  return app.merchant_profile_json(v_merchant);
end;
$$;

create function public.update_merchant_profile(
  p_name text, p_category public.merchant_category, p_description text, p_maps_url text,
  p_reviews_url text, p_logo_path text, p_cover_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant(); -- RN-71
  v_name text := pg_catalog.btrim(p_name);
  v_description text := pg_catalog.btrim(p_description);
  v_prefix text := 'merchants/' || v_merchant.id || '/brand/';
begin
  perform app.require_admin_session();

  if v_name is null or pg_catalog.char_length(v_name) not between 1 and 40 then
    perform app.raise('E-23', '{"field":"name"}');
  elsif p_category is null then
    perform app.raise('E-23', '{"field":"category"}');
  elsif v_description is null or pg_catalog.char_length(v_description) not between 1 and 140 then
    perform app.raise('E-23', '{"field":"description"}');
  elsif p_maps_url is null or p_maps_url !~ '^https://' or pg_catalog.char_length(p_maps_url) > 500 then
    perform app.raise('E-23', '{"field":"maps_url"}');
  elsif p_reviews_url is null or p_reviews_url !~ '^https://' or pg_catalog.char_length(p_reviews_url) > 500 then
    perform app.raise('E-23', '{"field":"reviews_url"}');
  -- WHY "unchanged is accepted": onboarding paths are set by Oxis and need not follow the brand/ layout.
  elsif p_logo_path is null or (p_logo_path <> v_merchant.logo_path and not app.merchant_media_path_valid(p_logo_path, v_prefix)) then
    perform app.raise('E-23', '{"field":"logo_path"}');
  elsif p_cover_path is null or (p_cover_path <> v_merchant.cover_path and not app.merchant_media_path_valid(p_cover_path, v_prefix)) then
    perform app.raise('E-23', '{"field":"cover_path"}');
  end if;

  update public.merchants m
  set name = v_name, category = p_category, description = v_description, maps_url = p_maps_url,
      reviews_url = p_reviews_url, logo_path = p_logo_path, cover_path = p_cover_path, updated_at = app.now()
  where m.id = v_merchant.id
  returning * into v_merchant;

  return app.merchant_profile_json(v_merchant);
end;
$$;

revoke execute on function public.get_merchant_profile() from public, anon;
revoke execute on function public.update_merchant_profile(text, public.merchant_category, text, text, text, text, text) from public, anon;
grant execute on function public.get_merchant_profile() to authenticated;
grant execute on function public.update_merchant_profile(text, public.merchant_category, text, text, text, text, text) to authenticated;

------------------------------------------------------------------------------------------------
-- 4. Custom stamp image (null = the merchant logo)
------------------------------------------------------------------------------------------------

alter table public.loyalty_programs add column stamp_image_path text;

create or replace function app.card_config_json(p_merchant_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'stamps_required', lp.stamps_required, 'cycle_months', lp.cycle_months,
    'reward_title', lp.reward_title, 'reward_description', lp.reward_description, 'terms', lp.terms,
    'card_background_path', lp.card_background_path,
    'stamp_image_path', lp.stamp_image_path,
    'push_coupon_validity_hours', m.push_coupon_validity_hours)
  from public.loyalty_programs lp join public.merchants m on m.id = lp.merchant_id
  where lp.merchant_id = p_merchant_id;
$$;

drop function public.update_card_config(smallint, smallint, text, text, text, text, smallint);
create function public.update_card_config(
  p_stamps_required smallint, p_cycle_months smallint, p_reward_title text, p_reward_description text,
  p_terms text, p_card_background_path text, p_push_coupon_validity_hours smallint,
  p_stamp_image_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant(); -- RN-71: inactive merchants cannot edit
  v_title text := pg_catalog.btrim(p_reward_title);
  v_description text := pg_catalog.btrim(p_reward_description);
  v_terms text := pg_catalog.btrim(p_terms);
  v_prefix text := 'merchants/' || v_merchant.id || '/card/';
begin
  perform app.require_admin_session();

  -- WHY E-23 {field}: same contract as complete_profile; the panel marks the offending input.
  if p_stamps_required is null or p_stamps_required not between 4 and 10 then
    perform app.raise('E-23', '{"field":"stamps_required"}');
  elsif p_cycle_months is null or p_cycle_months not between 3 and 12 then
    perform app.raise('E-23', '{"field":"cycle_months"}');
  elsif v_title is null or pg_catalog.char_length(v_title) not between 1 and 60 then
    perform app.raise('E-23', '{"field":"reward_title"}');
  elsif v_description is null or pg_catalog.char_length(v_description) not between 1 and 200 then
    perform app.raise('E-23', '{"field":"reward_description"}');
  elsif v_terms is null or pg_catalog.char_length(v_terms) not between 1 and 1000 then
    perform app.raise('E-23', '{"field":"terms"}');
  elsif p_push_coupon_validity_hours is null or p_push_coupon_validity_hours not in (6, 12, 24, 36, 48) then
    perform app.raise('E-23', '{"field":"push_coupon_validity_hours"}');
  elsif p_card_background_path is not null and not app.merchant_media_path_valid(p_card_background_path, v_prefix) then
    perform app.raise('E-23', '{"field":"card_background_path"}');
  elsif p_stamp_image_path is not null and not app.merchant_media_path_valid(p_stamp_image_path, v_prefix) then
    perform app.raise('E-23', '{"field":"stamp_image_path"}');
  end if;

  -- RN-29: only the program changes; running cycles keep their own copy.
  update public.loyalty_programs lp
  set stamps_required = p_stamps_required, cycle_months = p_cycle_months, reward_title = v_title,
      reward_description = v_description, terms = v_terms, card_background_path = p_card_background_path,
      stamp_image_path = p_stamp_image_path, updated_at = app.now()
  where lp.merchant_id = v_merchant.id;
  update public.merchants m
  set push_coupon_validity_hours = p_push_coupon_validity_hours, updated_at = app.now()
  where m.id = v_merchant.id;

  return app.card_config_json(v_merchant.id);
end;
$$;

revoke execute on function public.update_card_config(smallint, smallint, text, text, text, text, smallint, text) from public, anon;
grant execute on function public.update_card_config(smallint, smallint, text, text, text, text, smallint, text) to authenticated;

------------------------------------------------------------------------------------------------
-- 6. Metric series
------------------------------------------------------------------------------------------------

-- WHY local dates (America/Mexico_City, ADR-13): the merchant reads "today" and weeks in local time.
-- '30d' = 30 daily buckets; 'all' = 26 weekly buckets (Monday start). active_customers is always
-- 12 weekly buckets. Every bucket is zero-filled; only aggregates leave (RN-66).
create function public.get_metrics_series(p_range text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
  v_today date := app.local_today();
  v_this_week date := pg_catalog.date_trunc('week', v_today)::date;
  v_unit text;
  v_from date;
  v_step interval;
begin
  perform app.require_admin_session();
  if p_range is null or p_range not in ('30d', 'all') then
    perform app.raise('E-23', '{"field":"range"}');
  end if;

  if p_range = '30d' then
    v_unit := 'day'; v_from := v_today - 29; v_step := interval '1 day';
  else
    v_unit := 'week'; v_from := v_this_week - 25 * 7; v_step := interval '1 week';
  end if;

  return jsonb_build_object(
    'visits', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', b.d::date, 'count', coalesce(v.n, 0)) order by b.d), '[]'::jsonb)
      from pg_catalog.generate_series(v_from, v_today, v_step) b(d)
      left join (
        select pg_catalog.date_trunc(v_unit, t.used_at at time zone 'America/Mexico_City')::date as d, count(*) as n
        from public.visit_qr_tokens t
        where t.merchant_id = v_merchant.id and t.used_at is not null
        group by 1
      ) v on v.d = b.d::date),
    'coupons', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', b.d::date, 'issued', coalesce(i.n, 0), 'redeemed', coalesce(r.n, 0))
                                order by b.d), '[]'::jsonb)
      from pg_catalog.generate_series(v_from, v_today, v_step) b(d)
      left join (
        select pg_catalog.date_trunc(v_unit, c.issued_at at time zone 'America/Mexico_City')::date as d, count(*) as n
        from public.coupons c where c.merchant_id = v_merchant.id group by 1
      ) i on i.d = b.d::date
      left join (
        select pg_catalog.date_trunc(v_unit, c.redeemed_at at time zone 'America/Mexico_City')::date as d, count(*) as n
        from public.coupons c where c.merchant_id = v_merchant.id and c.redeemed_at is not null group by 1
      ) r on r.d = b.d::date),
    -- RN-67: deleted accounts do not count.
    'active_customers', (
      select coalesce(jsonb_agg(jsonb_build_object('bucket', b.d::date, 'count', coalesce(a.n, 0)) order by b.d), '[]'::jsonb)
      from pg_catalog.generate_series(v_this_week - 11 * 7, v_this_week, interval '1 week') b(d)
      left join (
        select pg_catalog.date_trunc('week', t.used_at at time zone 'America/Mexico_City')::date as d,
               count(distinct t.used_by_customer_id) as n
        from public.visit_qr_tokens t
        join public.customers cu on cu.id = t.used_by_customer_id and cu.status = 'active'
        where t.merchant_id = v_merchant.id and t.used_at is not null
        group by 1
      ) a on a.d = b.d::date));
end;
$$;

revoke execute on function public.get_metrics_series(text) from public, anon;
grant execute on function public.get_metrics_series(text) to authenticated;
