#!/usr/bin/env bash
# LOCAL DEV ONLY: runs the mobile app on a real phone (any network) against the local Supabase.
# Opens two temporary Cloudflare quick tunnels (no account): one for the Supabase API (54321) and
# one for Metro (8081 or $METRO_PORT), then starts Expo pointing at them. Ctrl+C closes everything.
# WHY: the phone cannot reach 127.0.0.1 on this machine; `expo start --tunnel` only covers Metro.
# NOTE: while it runs, the local API (with the seed's known passwords) is reachable through a random
# public URL. Do not leave it running unattended.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v cloudflared >/dev/null || { echo "Falta cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"; exit 1; }
curl -s -o /dev/null http://127.0.0.1:54321/ || { echo "Supabase local no responde en 54321: ejecuta 'pnpm db:start'."; exit 1; }

metro_port="${METRO_PORT:-8081}" # METRO_PORT=8082 if the emulator's Metro already uses 8081
logs=$(mktemp -d)
pids=()
cleanup() { kill "${pids[@]}" 2>/dev/null || true; rm -rf "$logs"; }
trap cleanup EXIT INT TERM

# Started here (not inside $(...)) so the trap can kill them.
for port in 54321 "$metro_port"; do
  cloudflared tunnel --no-autoupdate --url "http://localhost:$port" >"$logs/$port.log" 2>&1 &
  pids+=($!)
done

tunnel_url() { # $1 = local port, prints the public https URL
  for _ in $(seq 1 30); do
    url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$logs/$1.log" | head -1 || true)
    [ -n "$url" ] && { echo "$url"; return; }
    sleep 1
  done
  echo "No se pudo abrir el túnel del puerto $1:" >&2; cat "$logs/$1.log" >&2; exit 1
}

supabase_url=$(tunnel_url 54321)
metro_url=$(tunnel_url "$metro_port")
echo "Supabase: $supabase_url"
echo "Metro:    $metro_url"

cd apps/mobile
# Process env wins over apps/mobile/.env; --clear so the inlined EXPO_PUBLIC_* values are rebuilt.
EXPO_PUBLIC_SUPABASE_URL="$supabase_url" EXPO_PACKAGER_PROXY_URL="$metro_url" pnpm start --clear --port "$metro_port"
