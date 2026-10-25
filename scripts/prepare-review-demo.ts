// R2 (App Store audit): leave a demo customer one stamp away from a full card at a HIDDEN test merchant,
// so an Apple reviewer completes stamp -> reward -> wheel -> coupon in one session.
//   node scripts/prepare-review-demo.ts --merchant <email|uuid> --customer <email>
// Env: SUPABASE_DB_URL. Idempotent. Prints a summary without secrets.
import postgres from 'postgres';
import { parseReviewDemoArgs } from './merchant-admin-input.ts';
import { fail, findMerchant, requireDbUrl } from './merchant-lookup.ts';

const dbUrl = requireDbUrl();
const parsed = parseReviewDemoArgs(process.argv.slice(2));
if (!parsed.ok) fail(`invalid arguments:\n  ${parsed.errors.join('\n  ')}`, 2);
const { merchantRef, customerEmail } = parsed.data;

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
try {
  const summary = await sql.begin(async (tx) => {
    const merchant = await findMerchant(tx, merchantRef);
    const [state] = await tx<{ is_active: boolean; is_visible: boolean }[]>`
      select is_active, is_visible from public.merchants where id = ${merchant.id}`;
    // WHY: this script rewrites a customer's card; it must never run against a real public merchant.
    if (state!.is_visible) fail(`${merchant.name} is visible in the catalog; use a hidden test merchant`);
    if (!state!.is_active) fail(`${merchant.name} is not active`);

    const [customer] = await tx<{ id: string }[]>`
      select c.id from public.customers c join auth.users u on u.id = c.auth_user_id
      where lower(u.email) = lower(${customerEmail}) for update of c`;
    if (!customer) fail(`no customer found for ${customerEmail}`);

    // WHY both: RN-05 reads customers.email_verified_at; GoTrue reads auth.users.email_confirmed_at.
    await tx`update auth.users set email_confirmed_at = now()
             where lower(email) = lower(${customerEmail}) and email_confirmed_at is null`;
    await tx`update public.customers set email_verified_at = coalesce(email_verified_at, now()) where id = ${customer!.id}`;

    // Same relation row claim_visit creates; pending_extra_stamps = 0 so the next scan adds exactly one.
    await tx`insert into public.customer_merchants (customer_id, merchant_id, origin)
             values (${customer!.id}, ${merchant.id}, 'first_stamp')
             on conflict (customer_id, merchant_id) do update set pending_extra_stamps = 0`;

    const [cycle] = await tx<{ id: string; stamps_required: number }[]>`
      select id, stamps_required from app.roll_cycle(${customer!.id}, ${merchant.id})`;
    const preloaded = cycle!.stamps_required - 1;

    // Clear the active cycle and any visit stamp of today or of the days we are about to fill (RN-17
    // unique index), then write one stamp per previous day, ending yesterday in local time.
    await tx`delete from public.stamps s
             where s.customer_id = ${customer!.id} and s.merchant_id = ${merchant.id}
               and (s.cycle_id = ${cycle!.id} or s.local_date >= app.local_today() - ${preloaded}::int)`;
    await tx`insert into public.stamps (cycle_id, customer_id, merchant_id, is_bonus, local_date, granted_at)
             select ${cycle!.id}, ${customer!.id}, ${merchant.id}, false, app.local_today() - n,
                    (app.local_today() - n + time '12:00') at time zone 'America/Mexico_City'
             from generate_series(1, ${preloaded}::int) n`;
    await tx`update public.card_cycles set stamps_count = ${preloaded} where id = ${cycle!.id}`;

    return { merchant_id: merchant.id, merchant_name: merchant.name, customer_id: customer!.id,
             stamps: preloaded, stamps_required: cycle!.stamps_required };
  });
  console.log(JSON.stringify(summary, null, 2));
} catch (e) {
  fail(`could not prepare the demo: ${(e as Error).message}`);
} finally {
  await sql.end();
}
