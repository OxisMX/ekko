-- S14 hardening (audit in supabase/tests/23_security_audit.test.sql).

-- 1. Least privilege on tables. WHY: Supabase default privileges grant ALL on every new public table to
-- anon and authenticated. Clients only use RPCs (SECURITY DEFINER) and Storage, so these tables had no
-- policy and relied on "RLS enabled + zero policies" alone. Dropping the grants makes a future permissive
-- policy by mistake (e.g. on coupons.code or wheel_spins.*_hash) harmless, as RN-66/RN-38 intend.
revoke all on public.customers, public.customer_devices, public.customer_merchants, public.card_cycles,
  public.stamps, public.coupons, public.wheel_spins, public.push_campaigns from anon, authenticated;

-- Catalog tables keep read access for authenticated (RLS policy), but nothing beyond SELECT.
revoke all on public.merchants, public.loyalty_programs, public.menu_categories, public.products,
  public.weekly_offers from authenticated;
grant select on public.loyalty_programs, public.menu_categories, public.products, public.weekly_offers
  to authenticated;
-- WHY column list: billing state (RN-70) must not reach customers; auth_user_id stays because the
-- visit_qr_tokens_select policy filters merchants by it with the caller's privileges.
grant select (id, auth_user_id, name, category, description, address, logo_path, cover_path, maps_url,
  reviews_url, birthday_benefit, push_coupon_validity_hours, is_active, is_visible, created_at, updated_at)
  on public.merchants to authenticated;

-- Future tables/functions in public are closed by default; each migration grants what it needs.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;

-- 2. private tables: RLS as a second lock behind the schema being closed to API roles.
-- The owner and service_role bypass it, so SECURITY DEFINER functions are unaffected.
alter table private.merchant_admin_sessions enable row level security;
alter table private.merchant_security enable row level security;
alter table private.wheel_prizes enable row level security;

-- 3. RQ-2: deterministic coupon codes for tests. app.fake_codes is a comma-separated list; each call takes
-- the next entry (by app.fake_code_seq) and falls back to random once the list is used up. Like
-- app.fake_now it can only be set from a direct SQL session, never through PostgREST.
-- WHY a sequence and not a consumed GUC: the callers retry inside a sub-transaction that rolls back on
-- a collision, which would also undo a GUC change; nextval is not transactional. Tests restart it with
-- setval('app.fake_code_seq', 1, false).
create sequence app.fake_code_seq;

create or replace function app.random_code()
returns char(6)
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text := '';
  v_bytes bytea;
  v_byte int;
  v_fake text := pg_catalog.current_setting('app.fake_codes', true);
begin
  if v_fake is not null and v_fake <> '' then
    v_code := pg_catalog.split_part(v_fake, ',', pg_catalog.nextval('app.fake_code_seq')::int);
    if v_code <> '' then
      return v_code;
    end if;
  end if;
  while pg_catalog.length(v_code) < 6 loop
    v_bytes := extensions.gen_random_bytes(8);
    for i in 0..7 loop
      v_byte := pg_catalog.get_byte(v_bytes, i);
      -- WHY: rejection sampling. 256 % 31 <> 0, so bytes >= 248 (= 8 * 31) would bias the
      -- first 8 symbols; discarding them keeps all 31 symbols uniform.
      if v_byte < 248 and pg_catalog.length(v_code) < 6 then
        v_code := v_code || pg_catalog.substr(c_alphabet, v_byte % 31 + 1, 1);
      end if;
    end loop;
  end loop;
  return v_code;
end;
$$;

-- 4. TC-120 (defect found in S14): the 60 s idempotent replay of confirm_redemption was keyed on the
-- merchant only, so a second tablet of the same merchant confirming the same coupon within 60 s also got
-- a success and could hand out the reward twice. The replay now needs the same auth session (same till);
-- any other session gets E-11. Sessions without a session_id claim keep the old behaviour (null = null).
alter table public.coupons add column redeemed_by_session_id uuid;

create or replace function public.confirm_redemption(p_coupon_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant(); -- RN-71: inactive merchants may still redeem
  v_coupon public.coupons;
  v_now timestamptz := app.now();
  v_session_id uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  select c.* into v_coupon from public.coupons c
  where c.id = p_coupon_id and c.merchant_id = v_merchant.id
  for update;
  if not found then
    perform app.raise('E-12');
  end if;

  if v_coupon.status = 'redeemed' then
    -- WHY 60 s and same session: a double tap or a network retry from the same till gets the original answer.
    if v_coupon.redeemed_at > v_now - interval '60 seconds'
       and v_coupon.redeemed_by_session_id is not distinct from v_session_id then
      return jsonb_build_object('redeemed_at', v_coupon.redeemed_at);
    end if;
    perform app.raise('E-11');
  end if;
  if v_coupon.expires_at <= v_now then
    perform app.raise('E-10');
  end if;

  update public.coupons c set status = 'redeemed', redeemed_at = v_now, redeemed_by_session_id = v_session_id
  where c.id = v_coupon.id;
  return jsonb_build_object('redeemed_at', v_now);
end;
$$;
