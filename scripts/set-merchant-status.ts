// F-31 / F-32: deactivate or reactivate a merchant (RN-70..RN-72). Never deletes data.
//   node scripts/set-merchant-status.ts --merchant <email|uuid> --status active|inactive
//        [--paid-until YYYY-MM-DD] [--visible true|false]
// Env: SUPABASE_DB_URL. Prints a summary without secrets.
import postgres from 'postgres';
import { parseStatusArgs } from './merchant-admin-input.ts';
import { fail, findMerchant, requireDbUrl } from './merchant-lookup.ts';

const dbUrl = requireDbUrl();
const parsed = parseStatusArgs(process.argv.slice(2), new Date().toISOString().slice(0, 10));
if (!parsed.ok) fail(`invalid arguments:\n  ${parsed.errors.join('\n  ')}`, 2);
const { merchantRef, changes, closeAdminSessions } = parsed.data;

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
try {
  const summary = await sql.begin(async (tx) => {
    const merchant = await findMerchant(tx, merchantRef);
    const [row] = await tx<{ is_active: boolean; is_visible: boolean; subscription_status: string; paid_until: string }[]>`
      update public.merchants set ${tx(changes)} where id = ${merchant.id}
      returning is_active, is_visible, subscription_status, paid_until::text`;
    // WHY: RN-71 blocks admin edits for inactive merchants; an open PIN session must not outlive that.
    const closed = closeAdminSessions
      ? (await tx`delete from private.merchant_admin_sessions where merchant_id = ${merchant.id}`).count
      : 0;
    return { id: merchant.id, name: merchant.name, ...row!, admin_sessions_closed: closed };
  });
  console.log(JSON.stringify(summary, null, 2));
} catch (e) {
  fail(`could not update the merchant: ${(e as Error).message}`);
} finally {
  await sql.end();
}
