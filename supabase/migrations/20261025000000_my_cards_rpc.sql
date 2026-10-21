-- Backend §4.2 list_my_cards (S6).

create function public.list_my_cards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers := app.current_customer();
  v_now timestamptz := app.now();
begin
  -- WHY every relation, including unavailable merchants: RN-71 shows them as "No disponible".
  -- Lazy cycle rollover (TRD §7.2) runs per relation so expired partial stamps read as 0 (RN-25).
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'merchant_id', card.merchant_id,
        'merchant_name', card.merchant_name,
        'logo_path', card.logo_path,
        'merchant_available', card.merchant_available,
        'stamps_count', card.stamps_count,
        'stamps_required', card.stamps_required,
        'cycle_expires_at', card.cycle_expires_at,
        'reward_available', card.reward_available,
        'wheel_status', card.wheel_status
      )
      order by card.reward_available desc, card.merchant_available desc, card.created_at desc, card.merchant_id
    )
    from (
      select
        m.id as merchant_id, m.name as merchant_name, m.logo_path, cm.created_at,
        m.is_active and m.is_visible as merchant_available,
        cy.stamps_count, cy.stamps_required, cy.expires_at as cycle_expires_at,
        exists (
          select 1 from public.coupons c
          where c.customer_id = v_customer.id and c.merchant_id = m.id and c.source = 'card_reward'
            and c.status = 'active' and c.expires_at > v_now
        ) as reward_available,
        app.wheel_status(v_customer, m) as wheel_status
      from public.customer_merchants cm
      join public.merchants m on m.id = cm.merchant_id
      cross join lateral app.roll_cycle(cm.customer_id, cm.merchant_id) cy
      where cm.customer_id = v_customer.id
    ) card
  ), '[]'::jsonb);
end;
$$;

-- WHY: Supabase grants EXECUTE on new public functions to anon by default.
revoke execute on function public.list_my_cards() from public, anon;
grant execute on function public.list_my_cards() to authenticated;
