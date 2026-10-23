// NF-02 light load test (LOCAL ONLY): 50 customers claim 50 distinct QR tokens at the same time through
// PostgREST (the real path: JWT -> rpc/claim_visit). Needs seed-scale.sql (users perf-u001..perf-u200).
//   export SUPABASE_ANON_KEY=$(pnpm -s supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"/\1/p')
//   node scripts/perf/claim-load.ts
// Optional env: SUPABASE_URL (default http://127.0.0.1:54321), SUPABASE_DB_URL (default local Postgres),
// CLAIMS (default 50). Targets: 0 errors, p95 < 500 ms. Exit code 1 when missed.
// WHY tokens via SQL: generate_visit_qr keeps ONE pending QR per merchant, so 50 distinct tokens through
// the RPC would need 50 merchants signed in. The token row is identical to what the RPC inserts.
// Each run consumes one (customer, merchant) pair per user for today (RN-17): after ~7 runs on the
// same day the users run out of free relations; use more users or `pnpm db:reset` + seed-scale.
import { createHash, randomUUID } from 'node:crypto';
import postgres from 'postgres';

const apiUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const dbUrl = process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const anonKey = process.env.SUPABASE_ANON_KEY;
const claims = Number(process.env.CLAIMS ?? 50);
const password = 'ekko-local-123'; // seed-scale users, local only
if (!anonKey) {
  console.error('Error: SUPABASE_ANON_KEY is required (see the header of this file).');
  process.exit(2);
}

type Plan = { email: string; customerId: string; merchantId: string; token: string };

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });

async function buildPlan(): Promise<Plan[]> {
  // First free (customer, merchant) pair per user: active merchant, no visit stamp today.
  const rows = await sql<{ email: string; customer_id: string; merchant_id: string }[]>`
    select u.email, c.id as customer_id, pick.merchant_id
    from auth.users u
    join public.customers c on c.auth_user_id = u.id
    cross join lateral (
      select cm.merchant_id from public.customer_merchants cm
      join public.merchants m on m.id = cm.merchant_id and m.is_active
      where cm.customer_id = c.id
        and not exists (select 1 from public.stamps s where s.customer_id = cm.customer_id and s.merchant_id = cm.merchant_id
                        and not s.is_bonus and s.local_date = app.local_today())
      order by cm.merchant_id limit 1) pick
    where u.email like 'perf-u%@ekko.test'
    order by u.email limit ${claims}`;
  if (rows.length < claims) throw new Error(`only ${rows.length} users with a free merchant today; need ${claims}`);
  return rows.map((r) => ({ email: r.email, customerId: r.customer_id, merchantId: r.merchant_id, token: randomUUID() }));
}

async function insertTokens(plan: Plan[]) {
  const rows = plan.map((p) => ({
    merchant_id: p.merchantId,
    token_hash: createHash('sha256').update(p.token, 'utf8').digest('hex'),
  }));
  await sql`
    insert into public.visit_qr_tokens (merchant_id, token_hash, expires_at)
    select r.merchant_id::uuid, decode(r.token_hash, 'hex'), app.now() + interval '10 minutes'
    from jsonb_to_recordset(${sql.json(rows)}) as r (merchant_id text, token_hash text)`;
}

async function signIn(email: string): Promise<string> {
  const res = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign-in ${email}: HTTP ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function claim(jwt: string, token: string): Promise<{ ms: number; ok: boolean; detail: string }> {
  const t0 = performance.now();
  const res = await fetch(`${apiUrl}/rest/v1/rpc/claim_visit`, {
    method: 'POST',
    headers: { apikey: anonKey!, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_device_id_digest: 'ab'.repeat(32) }),
  });
  const body = (await res.text()).slice(0, 120);
  return { ms: performance.now() - t0, ok: res.ok, detail: res.ok ? '' : `HTTP ${res.status} ${body}` };
}

function percentile(sortedMs: number[], p: number): number {
  return sortedMs[Math.min(sortedMs.length - 1, Math.ceil(p * sortedMs.length) - 1)]!;
}

try {
  const plan = await buildPlan();
  await insertTokens(plan);
  const jwts = await Promise.all(plan.map((p) => signIn(p.email)));

  const started = performance.now();
  const results = await Promise.all(plan.map((p, i) => claim(jwts[i]!, p.token)));
  const wallMs = performance.now() - started;

  const errors = results.filter((r) => !r.ok);
  const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
  const p95 = percentile(sorted, 0.95);
  console.log(`claims=${claims} errors=${errors.length} wall=${wallMs.toFixed(0)}ms`);
  console.log(`p50=${percentile(sorted, 0.5).toFixed(0)}ms p95=${p95.toFixed(0)}ms max=${sorted.at(-1)!.toFixed(0)}ms`);
  for (const e of errors.slice(0, 5)) console.log(`  error: ${e.detail}`);
  process.exitCode = errors.length === 0 && p95 < 500 ? 0 : 1;
  console.log(process.exitCode === 0 ? 'NF-02 OK' : 'NF-02 FAILED');
} finally {
  await sql.end();
}
