-- Backend §4.2 list_merchants (Sprint 3). get_merchant_detail ships with S4.

-- WHY: TC-023 needs accent-insensitive search ("cafe" finds "Café"); unaccent is available on
-- Supabase but not installed by migration 001.
create extension if not exists unaccent with schema extensions;

-- WHY: unaccent(text) is only STABLE (it resolves its dictionary through search_path), so it
-- cannot appear in an index. With the dictionary fixed explicitly the result depends only on the
-- input, which makes this wrapper safe to declare IMMUTABLE.
create function app.search_text(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.lower(extensions.unaccent('extensions.unaccent'::regdictionary, value));
$$;

-- Replaces the §2.5 trigram index on the raw name: the search compares normalized text, so an
-- index on name alone would never be used.
drop index public.merchants_name_trgm_idx;
create index merchants_name_search_idx on public.merchants
  using gin (app.search_text(name) extensions.gin_trgm_ops);

create function public.list_merchants(
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
        'logo_path', m.logo_path, 'cover_path', m.cover_path, 'maps_url', m.maps_url
      ) as item,
      -- RN-52: stable random order per session seed; id breaks (improbable) md5 ties.
      pg_catalog.row_number() over (order by pg_catalog.md5(m.id::text || p_seed), m.id) as ord
    from public.merchants m
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

-- WHY: Supabase grants EXECUTE on new public functions to anon by default.
revoke execute on function public.list_merchants(text, text, public.merchant_category, integer, integer) from public, anon;
grant execute on function public.list_merchants(text, text, public.merchant_category, integer, integer) to authenticated;
