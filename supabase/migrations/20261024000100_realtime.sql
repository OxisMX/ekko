-- Backend §8 (migration 015): the panel listens to UPDATE on its QR row (RN-21). Realtime applies
-- RLS (visit_qr_tokens_select) and drops columns the subscriber cannot SELECT, so token_hash,
-- used_by_customer_id and claim_result never reach the panel.
alter publication supabase_realtime add table public.visit_qr_tokens;
