-- Backend §6.1 (roles) and §6.3 / ADR-14 (email verification).

-- WHY BEFORE INSERT: GoTrue re-reads the row after insert, so the role set here is already in
-- the first access token returned by signup (verified against the local Auth API in S1).
-- Public signup can only write raw_user_meta_data; only the admin API (service_role) can put
-- role = 'merchant' in raw_app_meta_data. Anything else becomes a customer.
create function app.assign_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'role', '') <> 'merchant' then
    new.raw_app_meta_data := (coalesce(new.raw_app_meta_data, '{}'::jsonb) - 'merchant_id')
      || '{"role":"customer"}'::jsonb;
  end if;
  return new;
end;
$$;

create trigger assign_user_role
  before insert on auth.users
  for each row execute function app.assign_user_role();

-- AFTER INSERT because customers.auth_user_id references the new auth.users row.
-- Names and birth_date stay null until complete_profile (S2).
create function app.create_customer_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customers (auth_user_id, auth_provider)
  values (new.id, coalesce(new.raw_app_meta_data ->> 'provider', 'email'));
  return null;
end;
$$;

create trigger create_customer_for_user
  after insert on auth.users
  for each row
  when (new.raw_app_meta_data ->> 'role' = 'customer')
  execute function app.create_customer_for_user();

-- ADR-14: an OTP session proves ownership of the inbox; a password session does not.
create function app.mark_email_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customers c
  set email_verified_at = coalesce(c.email_verified_at, app.now())
  from auth.sessions s
  where s.id = new.session_id
    and c.auth_user_id = s.user_id;
  return null;
end;
$$;

create trigger mark_email_verified
  after insert on auth.mfa_amr_claims
  for each row
  when (new.authentication_method = 'otp')
  execute function app.mark_email_verified();
