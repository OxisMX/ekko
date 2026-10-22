// Shared by the operation scripts: find one merchant by id or by its panel login email.
import type postgres from 'postgres';

export function fail(message: string, code = 1): never {
  console.error(`Error: ${message}`);
  process.exit(code);
}

export function requireDbUrl(): string {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) fail('missing environment variable: SUPABASE_DB_URL', 2);
  return url;
}

export async function findMerchant(tx: postgres.TransactionSql, ref: string) {
  const isId = !ref.includes('@');
  const [merchant] = await tx<{ id: string; name: string }[]>`
    select m.id, m.name from public.merchants m
    where ${isId
      ? tx`m.id = ${ref}`
      : tx`m.auth_user_id = (select u.id from auth.users u where lower(u.email) = lower(${ref}))`}
    for update`;
  if (!merchant) fail(`no merchant found for ${ref}`);
  return merchant;
}
