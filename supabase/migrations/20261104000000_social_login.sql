-- F-03 / ADR-15: Google and Apple sign-ins.

-- WHY: OAuth users arrive with names in raw_user_meta_data (Google: given_name/family_name/full_name;
-- Apple: only on the very first sign-in, often absent). Prefill them so the user only types the birth
-- date; values outside the 2..50 CHECK are dropped (profile stays incomplete and A-04 asks for them).
create or replace function app.create_customer_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name text := pg_catalog.btrim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', ''));
  v_first text := pg_catalog.btrim(coalesce(v_meta ->> 'given_name', pg_catalog.split_part(v_full_name, ' ', 1)));
  v_last text := pg_catalog.btrim(coalesce(
    v_meta ->> 'family_name',
    pg_catalog.substr(v_full_name, pg_catalog.length(pg_catalog.split_part(v_full_name, ' ', 1)) + 2)
  ));
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
begin
  if v_provider not in ('google', 'apple') then
    v_first := null;
    v_last := null;
  end if;
  insert into public.customers (auth_user_id, auth_provider, first_name, last_name)
  values (
    new.id,
    v_provider,
    case when pg_catalog.char_length(v_first) between 2 and 50 then v_first end,
    case when pg_catalog.char_length(v_last) between 2 and 50 then v_last end
  );
  return null;
end;
$$;

-- WHY: RN-05. Linking Google/Apple to an existing email customer does not create a user row, so
-- customers.auth_provider stays 'email'. The provider vouches for the inbox, so mark it verified.
create function app.mark_email_verified_by_provider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customers c
  set email_verified_at = coalesce(c.email_verified_at, app.now())
  where c.auth_user_id = new.user_id;
  return null;
end;
$$;

create trigger mark_email_verified_by_provider
  after insert on auth.identities
  for each row
  when (new.provider in ('google', 'apple'))
  execute function app.mark_email_verified_by_provider();
