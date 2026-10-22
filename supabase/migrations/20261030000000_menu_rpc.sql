-- Backend §4.6 Menú (US-23, F-25): categories and products managed from the merchant panel (P-07).

-- WHY a helper: every product RPC and list_menu_admin return the same shape. is_sold_out is derived
-- from sold_out_on (RN-56), so it resets by itself on the next local day.
create function app.product_json(p public.products)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'category_id', p.category_id, 'name', p.name, 'description', p.description,
    'price', p.price, 'image_path', p.image_path, 'is_featured', p.is_featured,
    'is_sold_out', p.sold_out_on is not distinct from app.local_today(), 'position', p.position);
$$;
revoke execute on function app.product_json(public.products) from public, anon, authenticated;

-- Same gate as get_card_config: the Menú section sits behind the PIN; inactive merchants may read.
create function public.list_menu_admin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  perform app.require_admin_session();
  return jsonb_build_object('categories', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'position', c.position,
      'products', coalesce((
        select jsonb_agg(app.product_json(p) order by p.position, p.created_at)
        from public.products p where p.category_id = c.id), '[]'::jsonb)
    ) order by c.position, c.id)
    from public.menu_categories c where c.merchant_id = v_merchant.id), '[]'::jsonb));
end;
$$;

create function public.upsert_menu_category(p_id uuid default null, p_name text default null, p_position smallint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant(); -- RN-71
  v_name text := pg_catalog.btrim(p_name);
  v_row public.menu_categories;
begin
  perform app.require_admin_session();
  if v_name is null or pg_catalog.char_length(v_name) not between 1 and 30 then
    perform app.raise('E-23', '{"field":"name"}');
  end if;

  if p_id is null then
    insert into public.menu_categories (merchant_id, name, position)
    values (v_merchant.id, v_name, coalesce(p_position,
      (select coalesce(max(c.position), 0) + 1 from public.menu_categories c where c.merchant_id = v_merchant.id)))
    returning * into v_row;
  else
    update public.menu_categories c
    set name = v_name, position = coalesce(p_position, c.position)
    where c.id = p_id and c.merchant_id = v_merchant.id
    returning * into v_row;
    if not found then
      perform app.raise('E-23', '{"field":"id"}');
    end if;
  end if;
  return jsonb_build_object('id', v_row.id, 'name', v_row.name, 'position', v_row.position);
end;
$$;

create function public.delete_menu_category(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant();
begin
  perform app.require_admin_session();
  if not exists (select 1 from public.menu_categories c where c.id = p_id and c.merchant_id = v_merchant.id) then
    perform app.raise('E-23', '{"field":"id"}');
  end if;
  if exists (select 1 from public.products p where p.category_id = p_id) then
    perform app.raise('E-23', '{"field":"category_not_empty"}');
  end if;
  delete from public.menu_categories c where c.id = p_id;
end;
$$;

create function public.upsert_product(
  p_id uuid default null, p_category_id uuid default null, p_name text default null, p_description text default null,
  p_price numeric default null, p_image_path text default null, p_position smallint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant(); -- RN-71
  v_name text := pg_catalog.btrim(p_name);
  v_description text := nullif(pg_catalog.btrim(p_description), '');
  v_prefix text := 'merchants/' || v_merchant.id || '/product/';
  v_row public.products;
begin
  perform app.require_admin_session();

  if p_id is not null and not exists (select 1 from public.products p where p.id = p_id and p.merchant_id = v_merchant.id) then
    perform app.raise('E-23', '{"field":"id"}');
  elsif p_category_id is null
     or not exists (select 1 from public.menu_categories c where c.id = p_category_id and c.merchant_id = v_merchant.id) then
    perform app.raise('E-23', '{"field":"category_id"}');
  elsif v_name is null or pg_catalog.char_length(v_name) not between 1 and 60 then
    perform app.raise('E-23', '{"field":"name"}');
  elsif pg_catalog.char_length(v_description) > 200 then
    perform app.raise('E-23', '{"field":"description"}');
  elsif p_price is null or p_price < 0 or p_price > 99999999.99 or p_price <> pg_catalog.round(p_price, 2) then
    perform app.raise('E-23', '{"field":"price"}');
  end if;

  -- WHY same check as card_background_path: path stored without the _{width}.webp suffix (§7); a JPEG
  -- fallback stores the real ".jpg" extension.
  if p_image_path is not null and (
    p_image_path !~ ('^' || v_prefix || '[A-Za-z0-9_.-]+$')
    or p_image_path like '%..%'
    or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'merchant-media'
        and pg_catalog.starts_with(o.name, pg_catalog.regexp_replace(p_image_path, '\.jpg$', '') || '_'))
  ) then
    perform app.raise('E-23', '{"field":"image_path"}');
  end if;

  if p_id is null then
    insert into public.products (merchant_id, category_id, name, description, price, image_path, position)
    values (v_merchant.id, p_category_id, v_name, v_description, p_price, p_image_path, coalesce(p_position,
      (select coalesce(max(p.position), 0) + 1 from public.products p where p.category_id = p_category_id)))
    returning * into v_row;
  else
    update public.products p
    set category_id = p_category_id, name = v_name, description = v_description, price = p_price,
        image_path = p_image_path, position = coalesce(p_position, p.position), updated_at = app.now()
    where p.id = p_id
    returning * into v_row;
  end if;
  return app.product_json(v_row);
end;
$$;

create function public.delete_product(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant();
begin
  perform app.require_admin_session();
  delete from public.products p where p.id = p_id and p.merchant_id = v_merchant.id;
  if not found then
    perform app.raise('E-23', '{"field":"id"}');
  end if;
end;
$$;

create function public.set_product_flags(p_id uuid, p_sold_out_today boolean, p_is_featured boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant();
  v_row public.products;
begin
  perform app.require_admin_session();
  if p_sold_out_today is null then
    perform app.raise('E-23', '{"field":"sold_out_today"}');
  elsif p_is_featured is null then
    perform app.raise('E-23', '{"field":"is_featured"}');
  end if;

  update public.products p
  set sold_out_on = case when p_sold_out_today then app.local_today() end,
      is_featured = p_is_featured, updated_at = app.now()
  where p.id = p_id and p.merchant_id = v_merchant.id
  returning * into v_row;
  if not found then
    perform app.raise('E-23', '{"field":"id"}');
  end if;
  return app.product_json(v_row);
end;
$$;

revoke execute on function public.list_menu_admin() from public, anon;
revoke execute on function public.upsert_menu_category(uuid, text, smallint) from public, anon;
revoke execute on function public.delete_menu_category(uuid) from public, anon;
revoke execute on function public.upsert_product(uuid, uuid, text, text, numeric, text, smallint) from public, anon;
revoke execute on function public.delete_product(uuid) from public, anon;
revoke execute on function public.set_product_flags(uuid, boolean, boolean) from public, anon;
grant execute on function public.list_menu_admin() to authenticated;
grant execute on function public.upsert_menu_category(uuid, text, smallint) to authenticated;
grant execute on function public.delete_menu_category(uuid) to authenticated;
grant execute on function public.upsert_product(uuid, uuid, text, text, numeric, text, smallint) to authenticated;
grant execute on function public.delete_product(uuid) to authenticated;
grant execute on function public.set_product_flags(uuid, boolean, boolean) to authenticated;
