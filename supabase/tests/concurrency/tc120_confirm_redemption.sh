#!/usr/bin/env bash
# TC-120: two tablets confirm the same coupon at the same time -> exactly one redemption, the other E-11.
# Needs local Supabase running with the seed (U1, C1). Run: bash supabase/tests/concurrency/tc120_confirm_redemption.sh
# Not part of `supabase test db` (pgTAP runs in one session). Deletes the coupon it creates.
set -euo pipefail
DB=${DB_CONTAINER:-supabase_db_ekko}
sql() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

COUPON_ID=$(sql -c "insert into public.coupons (customer_id, merchant_id, source, birthday_year, title, description, code, expires_at)
  select id, '20000000-0000-0000-0000-0000000000c1', 'birthday', 1900 + (random() * 99)::int, 'tc120', 'tc120', app.random_code(), app.now() + interval '1 day'
  from public.customers where auth_user_id = '10000000-0000-0000-0000-0000000000a1'
  returning id")

# Each tablet confirms, then holds its transaction open 2 s so the other one overlaps it.
confirm() {
  sql <<SQL 2>&1 || true
begin;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-0000000000c1","role":"authenticated","session_id":"$1","app_metadata":{"role":"merchant","merchant_id":"20000000-0000-0000-0000-0000000000c1"}}', true) is null;
set local role authenticated;
select 'redeemed_at=' || (public.confirm_redemption('$COUPON_ID') ->> 'redeemed_at');
select pg_sleep(2) is null;
commit;
SQL
}
OUT_A=$(mktemp); OUT_B=$(mktemp)
confirm aaaaaaaa-0000-0000-0000-0000000000a1 > "$OUT_A" &
confirm aaaaaaaa-0000-0000-0000-0000000000a2 > "$OUT_B" &
wait

OK=$(grep -l 'redeemed_at=20' "$OUT_A" "$OUT_B" | wc -l)
E11=$(grep -l 'E-11' "$OUT_A" "$OUT_B" | wc -l)
REDEEMED=$(sql -c "select count(*) from public.coupons where id = '$COUPON_ID' and status = 'redeemed'")
rm -f "$OUT_A" "$OUT_B"
sql -c "delete from public.coupons where id = '$COUPON_ID'"

if [ "$OK" = 1 ] && [ "$E11" = 1 ] && [ "$REDEEMED" = 1 ]; then echo "TC-120 PASS: 1 redemption, other E-11"; else echo "TC-120 FAIL: ok=$OK e11=$E11 redeemed=$REDEEMED"; exit 1; fi
