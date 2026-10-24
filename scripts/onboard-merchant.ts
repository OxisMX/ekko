// US-27 / F-30: merchant onboarding.
//   node scripts/onboard-merchant.ts <path-to-merchant.json>
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL. Never logs the PIN; a generated password
// is printed ONCE to stdout (the only way to hand it over), a provided one is never echoed.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { buildOnboardingPlan, generatePassword, parseMerchantInput } from './merchant-input.ts';

function fail(message: string, code = 1): never {
  console.error(`Error: ${message}`);
  process.exit(code);
}

const file = process.argv[2];
if (!file) fail('usage: node scripts/onboard-merchant.ts <path-to-merchant.json>', 2);

const env = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL'] as const;
const missing = env.filter((name) => !process.env[name]);
if (missing.length) fail(`missing environment variables: ${missing.join(', ')}`, 2);
const [url, serviceKey, dbUrl] = env.map((name) => process.env[name]!) as [string, string, string];

let raw: unknown;
try {
  raw = JSON.parse(await readFile(file, 'utf8'));
} catch (e) {
  fail(`cannot read ${file} as JSON: ${(e as Error).message}`);
}

const parsed = parseMerchantInput(raw);
if (!parsed.ok) fail(`invalid input:\n  ${parsed.errors.join('\n  ')}`);
const input = parsed.data;
const password = input.password ?? generatePassword();

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

try {
  // Idempotency: a re-run with the same file must not create a second merchant.
  const [existing] = await sql<{ email_taken: boolean; merchant_taken: boolean }[]>`
    select
      exists (select 1 from auth.users where lower(email) = lower(${input.email})) as email_taken,
      exists (
        select 1 from public.merchants
        where lower(name) = lower(${input.name}) and lower(address) = lower(${input.address})
      ) as merchant_taken`;
  if (existing!.email_taken) fail(`a user with email ${input.email} already exists; nothing was created`);
  if (existing!.merchant_taken) fail('a merchant with the same name and address already exists; nothing was created');

  const plan = buildOnboardingPlan(input, randomUUID());

  // (a) Auth user. The auth_trigger migration keeps role = merchant only for admin-API users.
  const { data, error } = await supabase.auth.admin.createUser({
    email: plan.authUser.email,
    password,
    email_confirm: true,
    app_metadata: plan.authUser.app_metadata,
  });
  if (error || !data.user) fail(`could not create the auth user: ${error?.message ?? 'no user returned'}`);
  const authUserId = data.user.id;

  // (b) All database rows in one transaction.
  try {
    await sql.begin(async (tx) => {
      await tx`insert into public.merchants ${tx({ ...plan.merchant, auth_user_id: authUserId })}`;
      await tx`insert into public.loyalty_programs ${tx(plan.loyaltyProgram)}`;
      await tx`insert into private.merchant_security (merchant_id, pin_hash)
               values (${plan.merchant.id}, extensions.crypt(${input.pin}, extensions.gen_salt('bf')))`;
      await tx`insert into private.wheel_prizes ${tx(plan.wheelPrizes)}`;
    });
  } catch (e) {
    // (c) Compensation: without its rows the auth user would be an orphan login.
    const { error: deleteError } = await supabase.auth.admin.deleteUser(authUserId);
    const cleanup = deleteError
      ? `; ALSO FAILED to delete auth user ${authUserId} (${deleteError.message}), delete it manually`
      : '; the auth user was deleted';
    fail(`database insert failed: ${(e as Error).message}${cleanup}`);
  }

  console.log(`Merchant created: ${plan.merchant.id} (${plan.merchant.name})`);
  console.log(`Panel login: ${plan.authUser.email}`);
  if (!input.password) console.log(`Panel password (shown once): ${password}`);
  console.log('Reminder: is_visible stays false until training is done (F-30 step 6).');
} finally {
  await sql.end();
}
