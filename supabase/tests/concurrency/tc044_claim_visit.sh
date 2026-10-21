#!/usr/bin/env bash
# TC-044: two customers claim the same QR token at the same time -> exactly one stamp, the other E-03.
# Needs local Supabase running with the seed (U1, U3, C1). Run from anywhere:
#   bash supabase/tests/concurrency/tc044_claim_visit.sh
# Not part of `supabase test db` (pgTAP runs in one session). Cleans up the token and stamp it creates.
set -euo pipefail
DB=${DB_CONTAINER:-supabase_db_ekko}
sql() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }

TOKEN="tc044-$(date +%s%N)"
QR_ID=$(sql -c "insert into public.visit_qr_tokens (merchant_id, token_hash, expires_at)
  values ('20000000-0000-0000-0000-0000000000c1', sha256(convert_to('$TOKEN', 'UTF8')), app.now() + interval '60 seconds')
  returning id")

# Each session claims, then holds its transaction open 2 s so the other one overlaps it.
claim() {
  sql <<SQL 2>&1 || true
begin;
select set_config('request.jwt.claims', '{"sub":"$1","role":"authenticated","app_metadata":{"role":"customer"}}', true) is null;
set local role authenticated;
select 'stamps_added=' || (public.claim_visit('$TOKEN', repeat('ab', 32)) ->> 'stamps_added');
select pg_sleep(2) is null;
commit;
SQL
}
OUT_A=$(mktemp); OUT_B=$(mktemp)
claim 10000000-0000-0000-0000-0000000000a1 > "$OUT_A" &
claim 10000000-0000-0000-0000-0000000000a3 > "$OUT_B" &
wait

echo "session U1: $(grep -Eo 'stamps_added=[0-9]+|E-[0-9]+' "$OUT_A" | sort -u | tr '\n' ' ')"
echo "session U3: $(grep -Eo 'stamps_added=[0-9]+|E-[0-9]+' "$OUT_B" | sort -u | tr '\n' ' ')"
STAMPS=$(sql -c "select count(*) from public.stamps where qr_token_id = '$QR_ID'")
E03=$(grep -l 'E-03' "$OUT_A" "$OUT_B" | wc -l)
rm -f "$OUT_A" "$OUT_B"

sql -c "update public.card_cycles c set stamps_count = c.stamps_count - 1
          from public.stamps s where s.qr_token_id = '$QR_ID' and c.id = s.cycle_id;
        delete from public.stamps where qr_token_id = '$QR_ID';
        delete from public.visit_qr_tokens where id = '$QR_ID';"

if [ "$STAMPS" = 1 ] && [ "$E03" = 1 ]; then echo "TC-044 PASS: 1 stamp, 1 E-03"; else echo "TC-044 FAIL: stamps=$STAMPS e03=$E03"; exit 1; fi
