-- Backend §4.5 get_card_config / update_card_config, §4.1 ensure_birthday_coupons, §7 Storage (S9).

-- WHY a helper: get and update return the same shape. push_coupon_validity_hours lives in
-- merchants (core_tables), the rest in loyalty_programs.
create function app.card_config_json(p_merchant_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'stamps_required', lp.stamps_required, 'cycle_months', lp.cycle_months,
    'reward_title', lp.reward_title, 'reward_description', lp.reward_description, 'terms', lp.terms,
    'card_background_path', lp.card_background_path,
    'push_coupon_validity_hours', m.push_coupon_validity_hours)
  from public.loyalty_programs lp join public.merchants m on m.id = lp.merchant_id
  where lp.merchant_id = p_merchant_id;
$$;
revoke execute on function app.card_config_json(uuid) from public, anon, authenticated;

-- Reading the config needs an admin session too (F-12): the screen sits behind the PIN.
create function public.get_card_config()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  perform app.require_admin_session();
  return app.card_config_json(v_merchant.id);
end;
$$;

create function public.update_card_config(
  p_stamps_required smallint, p_cycle_months smallint, p_reward_title text, p_reward_description text,
  p_terms text, p_card_background_path text, p_push_coupon_validity_hours smallint)
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
  elsif p_push_coupon_validity_hours is null or p_push_coupon_validity_hours not between 24 and 48 then
    perform app.raise('E-23', '{"field":"push_coupon_validity_hours"}');
  end if;

  -- WHY allowlist regex (no '/' beyond the prefix, so no '..' segments) + existence: the path is
  -- stored without the _{width}.webp suffix (§7), so any uploaded object starting with it counts.
  -- ponytail: existence only proves some object exists under the path, not that it is an image of
  -- the right size; the bucket's mime/size limits already guarantee that.
  if p_card_background_path is not null and (
    p_card_background_path !~ ('^' || v_prefix || '[A-Za-z0-9_.-]+$')
    or p_card_background_path like '%..%'
    or not exists (
      select 1 from storage.objects o
      -- WHY regexp_replace: a JPEG fallback stores the real extension ("<base>.jpg"; backend §7).
      where o.bucket_id = 'merchant-media'
        and pg_catalog.starts_with(o.name, pg_catalog.regexp_replace(p_card_background_path, '\.jpg$', '') || '_'))
  ) then
    perform app.raise('E-23', '{"field":"card_background_path"}');
  end if;

  -- RN-29: only the program changes; running cycles keep their own copy.
  update public.loyalty_programs lp
  set stamps_required = p_stamps_required, cycle_months = p_cycle_months, reward_title = v_title,
      reward_description = v_description, terms = v_terms, card_background_path = p_card_background_path,
      updated_at = app.now()
  where lp.merchant_id = v_merchant.id;
  update public.merchants m
  set push_coupon_validity_hours = p_push_coupon_validity_hours, updated_at = app.now()
  where m.id = v_merchant.id;

  return app.card_config_json(v_merchant.id);
end;
$$;

revoke execute on function public.get_card_config() from public, anon;
revoke execute on function public.update_card_config(smallint, smallint, text, text, text, text, smallint) from public, anon;
grant execute on function public.get_card_config() to authenticated;
grant execute on function public.update_card_config(smallint, smallint, text, text, text, text, smallint) to authenticated;

-- RN-43..RN-45. Lazy: the app calls it on open; the unique index coupons_birthday_once_idx makes it
-- idempotent and safe under concurrent calls (ON CONFLICT DO NOTHING).
create function public.ensure_birthday_coupons()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_local_now timestamp := app.local_now();
  v_expires_at timestamptz;
  v_created int := 0;
  v_rel record;
  v_inserted int;
begin
  if v_customer.birth_date is null
     or pg_catalog.date_part('month', v_customer.birth_date) <> pg_catalog.date_part('month', v_local_now) then
    return jsonb_build_object('created', 0);
  end if;

  -- Last second of the local month, converted back to an instant.
  v_expires_at := (pg_catalog.date_trunc('month', v_local_now) + interval '1 month' - interval '1 second')
    at time zone 'America/Mexico_City';

  for v_rel in
    select m.id, m.birthday_benefit
    from public.customer_merchants cm join public.merchants m on m.id = cm.merchant_id
    where cm.customer_id = v_customer.id and m.is_active and m.birthday_benefit is not null
  loop
    -- A random code can collide within the merchant; retry with a new one (as spin_wheel does).
    for v_attempt in 1..5 loop
      begin
        insert into public.coupons (customer_id, merchant_id, source, birthday_year, title, description, code, issued_at, expires_at)
        values (v_customer.id, v_rel.id, 'birthday', pg_catalog.date_part('year', v_local_now)::smallint,
                'Regalo de cumpleaños', v_rel.birthday_benefit, app.random_code(), app.now(), v_expires_at)
        on conflict (customer_id, merchant_id, birthday_year) where source = 'birthday' do nothing;
        get diagnostics v_inserted = row_count;
        v_created := v_created + v_inserted;
        exit;
      exception when unique_violation then
        null; -- (merchant_id, code) collision
      end;
    end loop;
  end loop;

  return jsonb_build_object('created', v_created);
end;
$$;

revoke execute on function public.ensure_birthday_coupons() from public, anon;
grant execute on function public.ensure_birthday_coupons() to authenticated;

-- Storage §7. WHY idempotent: local CLI and hosted projects may already have the bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merchant-media', 'merchant-media', true, 307200, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Policies run as the caller, so the helper lives in `rls` (usable by authenticated; `app` is not).
-- Non-throwing and it does NOT extend the admin session: it only answers yes/no.
-- Path: merchants/{own merchant_id}/{card|product|offer}/file. Logo/cover are service_role only.
create function rls.can_write_merchant_media(p_name text)
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
      and (storage.foldername(p_name))[3] in ('card', 'product', 'offer')
  );
$$;
revoke execute on function rls.can_write_merchant_media(text) from public, anon;
grant execute on function rls.can_write_merchant_media(text) to authenticated;

create policy merchant_media_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'merchant-media');
create policy merchant_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'merchant-media' and rls.can_write_merchant_media(name));
create policy merchant_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'merchant-media' and rls.can_write_merchant_media(name));
