-- App Store preflight fixes (docs/ekko_auditoria_app_store.md, W4).

-- WHY default false: Apple 4.5.4 requires explicit opt-in for promotional push. Existing rows keep
-- their value (pre-launch, no real consent history to preserve or revoke).
alter table public.customers alter column push_opt_in set default false;

-- WHY a dedicated RPC: the app calls it when the user accepts the notifications explainer, whose
-- copy mentions offers (consent language, Apple 4.5.4). update_profile needs names and avatar too.
create function public.set_push_opt_in(p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
begin
  if p_value is null then
    perform app.raise('E-23', '{"field":"push_opt_in"}');
  end if;
  update public.customers c set push_opt_in = p_value where c.id = v_customer.id;
end;
$$;
revoke execute on function public.set_push_opt_in(boolean) from public, anon;
grant execute on function public.set_push_opt_in(boolean) to authenticated;
