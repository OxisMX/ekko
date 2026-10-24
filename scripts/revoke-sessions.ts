// P-S5: sign a merchant out of every device (stolen tablet), including open admin (PIN) sessions.
//   node scripts/revoke-sessions.ts --merchant <email|uuid>
// Env: SUPABASE_DB_URL. Prints a summary without secrets.
import postgres from 'postgres';
import { parseRevokeSessionsArgs } from './merchant-admin-input.ts';
import { fail, findMerchant, requireDbUrl } from './merchant-lookup.ts';

const dbUrl = requireDbUrl();
const parsed = parseRevokeSessionsArgs(process.argv.slice(2));
if (!parsed.ok) fail(`invalid arguments:\n  ${parsed.errors.join('\n  ')}`, 2);

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
try {
  const summary = await sql.begin(async (tx) => {
    const merchant = await findMerchant(tx, parsed.data.merchantRef);
    const [owner] = await tx<{ auth_user_id: string }[]>`select auth_user_id from public.merchants where id = ${merchant.id}`;
    const [revoked] = await tx<{ count: number }[]>`select public.revoke_user_sessions(${owner!.auth_user_id}) as count`;
    return { id: merchant.id, name: merchant.name, sessions_revoked: revoked!.count };
  });
  console.log(JSON.stringify(summary, null, 2));
} catch (e) {
  fail(`could not revoke the sessions: ${(e as Error).message}`);
} finally {
  await sql.end();
}
