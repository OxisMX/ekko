-- Backend §3 helpers needed from S1. require_admin_session, roll_cycle and grant_stamps ship
-- with their RPCs (S4/S5/S8). The app schema is not exposed: these run inside SECURITY DEFINER RPCs.

create function app.local_now()
returns timestamp
language sql
stable
set search_path = ''
as $$
  select app.now() at time zone 'America/Mexico_City';
$$;

create function app.local_today()
returns date
language sql
stable
set search_path = ''
as $$
  select app.local_now()::date;
$$;

-- Backend §3.1 contract: PostgREST maps MESSAGE -> message (E-xx) and DETAIL -> details.
create function app.raise(code text, detail jsonb default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- WHY: RAISE ... USING rejects a null option, so the detail-less form is a separate branch.
  if detail is null then
    raise exception using errcode = 'P0001', message = code;
  end if;
  raise exception using errcode = 'P0001', message = code, detail = detail::text;
end;
$$;

create function app.current_customer()
returns public.customers
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer public.customers;
begin
  if v_uid is null then
    perform app.raise('E-18');
  end if;
  if auth.jwt() -> 'app_metadata' ->> 'role' is distinct from 'customer' then
    perform app.raise('E-19');
  end if;

  select c.* into v_customer
  from public.customers c
  where c.auth_user_id = v_uid and c.status = 'active';
  if not found then
    perform app.raise('E-19');
  end if;
  return v_customer;
end;
$$;

create function app.current_merchant()
returns public.merchants
language plpgsql
stable
set search_path = ''
as $$
declare
  v_app_metadata jsonb := auth.jwt() -> 'app_metadata';
  v_merchant public.merchants;
begin
  if v_app_metadata ->> 'role' is distinct from 'merchant' then
    perform app.raise('E-19');
  end if;

  -- WHY: compare as text so a malformed merchant_id claim is E-19, not a cast error.
  select m.* into v_merchant
  from public.merchants m
  where m.id::text = v_app_metadata ->> 'merchant_id'
    and m.auth_user_id = auth.uid();
  if not found then
    perform app.raise('E-19');
  end if;
  return v_merchant;
end;
$$;

create function app.require_active_merchant()
returns public.merchants
language plpgsql
stable
set search_path = ''
as $$
declare
  v_merchant public.merchants := app.current_merchant();
begin
  if not v_merchant.is_active then
    perform app.raise('E-05');
  end if;
  return v_merchant;
end;
$$;

create function app.is_email_verified(customer public.customers)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select customer.auth_provider in ('google', 'apple') or customer.email_verified_at is not null;
$$;

-- SECURITY DEFINER: reads the pepper from Vault.
create function app.peppered_hash(value text)
returns bytea
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pepper text;
begin
  select s.decrypted_secret into v_pepper
  from vault.decrypted_secrets s
  where s.name = 'hash_pepper';
  if v_pepper is null then
    perform app.raise('E-99', '{"reason":"hash_pepper missing"}');
  end if;
  return pg_catalog.sha256(pg_catalog.convert_to(value || v_pepper, 'UTF8'));
end;
$$;

create function app.random_code()
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
begin
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
