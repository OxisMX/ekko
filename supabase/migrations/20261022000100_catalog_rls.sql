-- Backend §6.2, catalog part of migration 013: SELECT policies for merchants, loyalty_programs,
-- menu_categories, products and weekly_offers. No INSERT/UPDATE/DELETE policies (RPC/scripts only).

-- WHY a separate schema: the policy runs as the caller, so `authenticated` needs USAGE on the
-- helper's schema. `app` and `private` must stay closed to it (TC-205, 01_core); `rls` holds only
-- this helper and is not exposed by PostgREST (config.toml api.schemas).
create schema rls;
revoke all on schema rls from public;
grant usage on schema rls to authenticated;

-- Merchants whose catalog rows the caller may read: a customer reads visible merchants and the
-- ones it has a relation with (RN-53, a C3-style card stays readable); a merchant reads its own.
-- SECURITY DEFINER so it reads customers/customer_merchants without their RLS (no recursion).
create function rls.readable_merchant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.merchants m
  where m.auth_user_id = auth.uid()
     or (auth.jwt() -> 'app_metadata' ->> 'role' = 'customer' and m.is_visible)
  union
  select cm.merchant_id
  from public.customer_merchants cm
  join public.customers c on c.id = cm.customer_id
  where c.auth_user_id = auth.uid()
    and c.status = 'active'
    and auth.jwt() -> 'app_metadata' ->> 'role' = 'customer';
$$;

revoke execute on function rls.readable_merchant_ids() from public, anon;
grant execute on function rls.readable_merchant_ids() to authenticated;

-- WHY `in (select ...)`: the helper runs once per statement (hashed subplan), not once per row.
create policy merchants_select on public.merchants
  for select to authenticated
  using (id in (select rls.readable_merchant_ids()));
create policy loyalty_programs_select on public.loyalty_programs
  for select to authenticated
  using (merchant_id in (select rls.readable_merchant_ids()));
create policy menu_categories_select on public.menu_categories
  for select to authenticated
  using (merchant_id in (select rls.readable_merchant_ids()));
create policy products_select on public.products
  for select to authenticated
  using (merchant_id in (select rls.readable_merchant_ids()));
create policy weekly_offers_select on public.weekly_offers
  for select to authenticated
  using (merchant_id in (select rls.readable_merchant_ids()));

-- §6.2: anon has no access; RLS already returns zero rows, this makes it an explicit denial.
revoke all on public.merchants, public.loyalty_programs, public.menu_categories, public.products,
  public.weekly_offers from anon;
