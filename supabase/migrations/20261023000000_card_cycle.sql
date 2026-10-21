-- Backend §3 app.roll_cycle (S4). Lazy cycle resolution (TRD §7.2): no job closes cycles; every
-- reader/writer of a card calls this first.

create function app.roll_cycle(p_customer_id uuid, p_merchant_id uuid)
returns public.card_cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.card_cycles;
begin
  -- WHY two attempts: a concurrent caller can insert the active cycle between our read and our
  -- insert. The partial unique index (one active per relation) rejects the second insert; the
  -- retry re-reads (new snapshot under READ COMMITTED) and returns the winner's cycle.
  for v_attempt in 1..2 loop
    select c.* into v_cycle
    from public.card_cycles c
    where c.customer_id = p_customer_id and c.merchant_id = p_merchant_id and c.status = 'active'
    for update;

    if found and v_cycle.expires_at > app.now() then
      return v_cycle;
    end if;

    begin
      if found then
        -- RN-25: partial stamps expire with the cycle.
        update public.card_cycles
        set status = 'expired', closed_at = app.now()
        where id = v_cycle.id;
      end if;

      -- RN-29: the new cycle copies the current program config.
      insert into public.card_cycles (
        customer_id, merchant_id, status, stamps_required, reward_title, reward_description, terms, started_at, expires_at
      )
      select p_customer_id, p_merchant_id, 'active', lp.stamps_required, lp.reward_title, lp.reward_description, lp.terms,
             app.now(), app.now() + pg_catalog.make_interval(months => lp.cycle_months)
      from public.loyalty_programs lp
      where lp.merchant_id = p_merchant_id
      returning * into v_cycle;

      if not found then
        perform app.raise('E-99', '{"reason":"loyalty_program missing"}');
      end if;
      return v_cycle;
    exception when unique_violation then
      null; -- lost the race; the next attempt reads the winner's cycle
    end;
  end loop;

  perform app.raise('E-99', '{"reason":"roll_cycle contention"}');
end;
$$;

revoke execute on function app.roll_cycle(uuid, uuid) from public, anon, authenticated;
