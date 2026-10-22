// F-33 / RN-65: reset a merchant's admin PIN.
//   node scripts/reset-pin.ts --merchant <email|uuid> [--pin NNNN]
// Env: SUPABASE_DB_URL. A generated PIN is printed ONCE to stdout (the only way to hand it over); it
// never goes to stderr or logs. A PIN passed with --pin is not echoed.
import postgres from 'postgres';
import { parseResetPinArgs } from './merchant-admin-input.ts';
import { fail, findMerchant, requireDbUrl } from './merchant-lookup.ts';

const dbUrl = requireDbUrl();
const parsed = parseResetPinArgs(process.argv.slice(2));
if (!parsed.ok) fail(`invalid arguments:\n  ${parsed.errors.join('\n  ')}`, 2);
const { merchantRef, pin, generated } = parsed.data;

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
try {
  const merchant = await sql.begin(async (tx) => {
    const found = await findMerchant(tx, merchantRef);
    const updated = await tx`
      update private.merchant_security
      set pin_hash = extensions.crypt(${pin}, extensions.gen_salt('bf')),
          pin_failed_count = 0, pin_locked_until = null, updated_at = app.now()
      where merchant_id = ${found.id}`;
    if (updated.count === 0) throw new Error('the merchant has no security row');
    await tx`delete from private.merchant_admin_sessions where merchant_id = ${found.id}`;
    return found;
  });
  console.log(`PIN reset for ${merchant.id} (${merchant.name}); lock cleared and admin sessions closed.`);
  if (generated) console.log(`New PIN (shown once): ${pin}`);
} catch (e) {
  fail(`could not reset the PIN: ${(e as Error).message}`);
} finally {
  await sql.end();
}
