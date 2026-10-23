-- Backend §4.5 Ofertas (US-24) and §4.6 push campaigns (US-26, RN-46..RN-49): panel RPCs (P-09, P-10)
-- plus the internal RPCs the send-push Edge Function calls with service_role.

------------------------------------------------------------------------------------------------
-- Weekly offers
------------------------------------------------------------------------------------------------

create function app.offer_json(o public.weekly_offers)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'title', o.title, 'description', o.description,
    'weekday', o.weekday, 'image_path', o.image_path, 'position', o.position);
$$;
revoke execute on function app.offer_json(public.weekly_offers) from public, anon, authenticated;

-- Same gate as list_menu_admin: PIN-protected section, inactive merchants may read.
create function public.list_offers_admin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  perform app.require_admin_session();
  return coalesce((
    select jsonb_agg(app.offer_json(o) order by o.weekday, o.position, o.id)
    from public.weekly_offers o where o.merchant_id = v_merchant.id), '[]'::jsonb);
end;
$$;

create function public.upsert_offer(
  p_id uuid default null, p_title text default null, p_description text default null,
  p_weekday smallint default null, p_image_path text default null, p_position smallint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant(); -- RN-71
  v_title text := pg_catalog.btrim(p_title);
  v_description text := pg_catalog.btrim(p_description);
  v_prefix text := 'merchants/' || v_merchant.id || '/offer/';
  v_row public.weekly_offers;
begin
  perform app.require_admin_session();

  if p_id is not null and not exists (select 1 from public.weekly_offers o where o.id = p_id and o.merchant_id = v_merchant.id) then
    perform app.raise('E-23', '{"field":"id"}');
  elsif v_title is null or pg_catalog.char_length(v_title) not between 1 and 60 then
    perform app.raise('E-23', '{"field":"title"}');
  elsif v_description is null or pg_catalog.char_length(v_description) not between 1 and 200 then
    perform app.raise('E-23', '{"field":"description"}');
  elsif p_weekday is null or p_weekday not between 1 and 7 then
    perform app.raise('E-23', '{"field":"weekday"}');
  end if;

  -- WHY same check as product image_path: stored without the _{width}.webp suffix; ".jpg" fallback keeps its extension.
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
    insert into public.weekly_offers (merchant_id, title, description, weekday, image_path, position)
    values (v_merchant.id, v_title, v_description, p_weekday, p_image_path, coalesce(p_position,
      (select coalesce(max(o.position), 0) + 1 from public.weekly_offers o
       where o.merchant_id = v_merchant.id and o.weekday = p_weekday)))
    returning * into v_row;
  else
    update public.weekly_offers o
    set title = v_title, description = v_description, weekday = p_weekday, image_path = p_image_path,
        position = coalesce(p_position, o.position)
    where o.id = p_id
    returning * into v_row;
  end if;
  return app.offer_json(v_row);
end;
$$;

create function public.delete_offer(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.require_active_merchant();
begin
  perform app.require_admin_session();
  delete from public.weekly_offers o where o.id = p_id and o.merchant_id = v_merchant.id;
  if not found then
    perform app.raise('E-23', '{"field":"id"}');
  end if;
end;
$$;

------------------------------------------------------------------------------------------------
-- Push: quota helpers and panel RPCs
------------------------------------------------------------------------------------------------

-- RN-47: 5 sends per merchant per local calendar month, every campaign counts (with or without coupon).
create function app.push_month_start()
returns date
language sql
stable
set search_path = ''
as $$
  select pg_catalog.date_trunc('month', app.local_today())::date;
$$;

create function app.push_remaining(p_merchant_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select greatest(5 - count(*), 0)::integer
  from public.push_campaigns c where c.merchant_id = p_merchant_id and c.local_month = app.push_month_start();
$$;

-- RN-46: recipients are customers with a relation to the merchant (not deleted accounts).
create function app.push_recipient_ids(p_merchant_id uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select cm.customer_id
  from public.customer_merchants cm join public.customers c on c.id = cm.customer_id
  where cm.merchant_id = p_merchant_id and c.status = 'active';
$$;

revoke execute on function app.push_month_start() from public, anon, authenticated;
revoke execute on function app.push_remaining(uuid) from public, anon, authenticated;
revoke execute on function app.push_recipient_ids(uuid) from public, anon, authenticated;

create function public.get_push_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  perform app.require_admin_session();
  return jsonb_build_object(
    'remaining_this_month', app.push_remaining(v_merchant.id),
    'limit', 5,
    'resets_on', (app.push_month_start() + interval '1 month')::date,
    'recipients_count', (select count(*) from app.push_recipient_ids(v_merchant.id)),
    'push_coupon_validity_hours', v_merchant.push_coupon_validity_hours);
end;
$$;

create function public.list_push_campaigns()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  perform app.require_admin_session();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'title', x.title, 'has_coupon', x.has_coupon, 'status', x.status,
      'recipients_count', x.recipients_count, 'sent_count', x.sent_count, 'failed_count', x.failed_count,
      'created_at', x.created_at) order by x.created_at desc, x.id)
    from (select c.* from public.push_campaigns c where c.merchant_id = v_merchant.id
          order by c.created_at desc, c.id limit 50) x), '[]'::jsonb);
end;
$$;

revoke execute on function public.list_offers_admin() from public, anon;
revoke execute on function public.upsert_offer(uuid, text, text, smallint, text, smallint) from public, anon;
revoke execute on function public.delete_offer(uuid) from public, anon;
revoke execute on function public.get_push_status() from public, anon;
revoke execute on function public.list_push_campaigns() from public, anon;
grant execute on function public.list_offers_admin() to authenticated;
grant execute on function public.upsert_offer(uuid, text, text, smallint, text, smallint) to authenticated;
grant execute on function public.delete_offer(uuid) to authenticated;
grant execute on function public.get_push_status() to authenticated;
grant execute on function public.list_push_campaigns() to authenticated;

------------------------------------------------------------------------------------------------
-- Push: internal RPCs (service_role only, called by the send-push Edge Function)
------------------------------------------------------------------------------------------------

create function app.push_campaign_result(p_campaign public.push_campaigns, p_duplicate boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'campaign_id', p_campaign.id, 'recipients', p_campaign.recipients_count, 'duplicate', p_duplicate,
    'status', p_campaign.status, 'sent', p_campaign.sent_count, 'failed', p_campaign.failed_count,
    'push_remaining_this_month', app.push_remaining(p_campaign.merchant_id));
$$;
revoke execute on function app.push_campaign_result(public.push_campaigns, boolean) from public, anon, authenticated;

-- payload: { idempotency_key, title, body, coupon?: { title, description, terms, validity_hours } }
-- WHY the session is checked with explicit params: the caller is service_role, so auth.jwt() is not the
-- merchant's. Mirrors app.require_admin_session (RN-64: a use extends the session 5 minutes).
create function public.create_push_campaign(p_merchant_id uuid, p_auth_session_id uuid, p_payload jsonb)
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
    elsif v_hours_text is null or v_hours_text !~ '^(2[4-9]|3[0-9]|4[0-8])$' then
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

-- RN-49: every device of every recipient that has push on, a token and an open session.
create function public.get_push_recipients(p_campaign_id uuid)
returns table (customer_id uuid, coupon_id uuid, token text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.customer_id, cp.id, d.expo_push_token
  from public.push_campaigns pc
  join lateral app.push_recipient_ids(pc.merchant_id) r(id) on true
  join public.customer_devices d on d.customer_id = r.id
  left join public.coupons cp on cp.campaign_id = pc.id and cp.customer_id = r.id
  where pc.id = p_campaign_id
    and d.push_enabled and d.expo_push_token is not null and d.signed_out_at is null
  order by d.customer_id, d.id;
$$;

create function public.record_push_result(p_campaign_id uuid, p_sent integer, p_failed integer, p_invalid_tokens text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.push_campaigns;
begin
  select c.* into v_campaign from public.push_campaigns c where c.id = p_campaign_id for update;
  if not found then
    perform app.raise('E-23', '{"field":"campaign_id"}');
  elsif p_sent is null or p_sent < 0 or p_failed is null or p_failed < 0 then
    perform app.raise('E-23', '{"field":"counts"}');
  end if;

  -- Tokens are invalid for every merchant, so they are cleared regardless of the campaign.
  update public.customer_devices d set push_enabled = false, expo_push_token = null
  where d.expo_push_token = any (coalesce(p_invalid_tokens, '{}'));

  -- WHY only while 'sending': a retried call must not overwrite the stored final result.
  if v_campaign.status = 'sending' then
    update public.push_campaigns c
    set sent_count = p_sent, failed_count = p_failed,
        status = case when p_sent = 0 and p_failed > 0 then 'failed'::public.campaign_status else 'sent'::public.campaign_status end
    where c.id = p_campaign_id
    returning * into v_campaign;
  end if;
  return pg_catalog.jsonb_build_object(
    'sent', v_campaign.sent_count, 'failed', v_campaign.failed_count,
    'push_remaining_this_month', app.push_remaining(v_campaign.merchant_id));
end;
$$;

revoke execute on function public.create_push_campaign(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.get_push_recipients(uuid) from public, anon, authenticated;
revoke execute on function public.record_push_result(uuid, integer, integer, text[]) from public, anon, authenticated;
grant execute on function public.create_push_campaign(uuid, uuid, jsonb) to service_role;
grant execute on function public.get_push_recipients(uuid) to service_role;
grant execute on function public.record_push_result(uuid, integer, integer, text[]) to service_role;
