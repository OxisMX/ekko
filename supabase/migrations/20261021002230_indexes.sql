-- Backend §2.5 (the unique/partial indexes of §2.3 live with their tables).

create index merchants_visible_category_idx on public.merchants (is_visible, category);
create index merchants_name_trgm_idx on public.merchants using gin (name extensions.gin_trgm_ops);
create index card_cycles_merchant_status_idx on public.card_cycles (merchant_id, status);
create index stamps_merchant_granted_idx on public.stamps (merchant_id, granted_at);
create index coupons_customer_status_expires_idx on public.coupons (customer_id, status, expires_at);
create index coupons_merchant_redeemed_idx on public.coupons (merchant_id, redeemed_at);
create index visit_qr_tokens_merchant_created_idx on public.visit_qr_tokens (merchant_id, created_at desc);
create index customer_merchants_merchant_idx on public.customer_merchants (merchant_id);
create index customer_devices_push_idx on public.customer_devices (customer_id)
  where expo_push_token is not null and signed_out_at is null;
create index products_menu_idx on public.products (merchant_id, category_id, position);
