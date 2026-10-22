#!/usr/bin/env bash
# LOCAL ONLY: prints a fresh visit QR link (valid 60 s) for a seeded merchant.
# Usage: scripts/dev-visit-qr.sh [c1|c2]   (default c1; seed password, see supabase/seed.sql)
set -euo pipefail
cd "$(dirname "$0")/.."
merchant="${1:-c1}"
api=http://127.0.0.1:54321
key=$(pnpm -s supabase status -o json 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)['ANON_KEY'])")
jwt=$(curl -s -H "apikey: $key" -H "Content-Type: application/json" "$api/auth/v1/token?grant_type=password" \
  -d "{\"email\":\"$merchant@ekko.test\",\"password\":\"ekko-local-123\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['access_token'])")
curl -s -X POST -H "apikey: $key" -H "Authorization: Bearer $jwt" -H "Content-Type: application/json" \
  "$api/rest/v1/rpc/generate_visit_qr" -d '{}' | python3 -c "import json,sys;print(json.load(sys.stdin)['token'])"
