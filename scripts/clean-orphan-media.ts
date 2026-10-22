// Monthly ops (backend §7): delete merchant-media objects no DB row references and older than 24 h.
//   node scripts/clean-orphan-media.ts            # dry run: prints count + list
//   node scripts/clean-orphan-media.ts --apply    # deletes
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL. Prints object names only, no secrets.
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { parseCleanArgs, selectOrphans } from './orphan-media.ts';
import { fail, requireDbUrl } from './merchant-lookup.ts';

const BUCKET = 'merchant-media';
const BATCH = 100;

const args = parseCleanArgs(process.argv.slice(2));
if (!args.ok) fail(`invalid arguments: ${args.error}`, 2);
const dbUrl = requireDbUrl();
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) fail('missing environment variable: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY', 2);

const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
try {
  const objects = (await sql<{ name: string; created_at: Date }[]>`
    select name, created_at from storage.objects where bucket_id = ${BUCKET}`).map((o) => ({ name: o.name, createdAt: o.created_at }));
  // WHY no card_cycles: cycles don't copy the background (backend §4.5), only loyalty_programs holds it.
  const referenced = new Set(
    (await sql<{ path: string }[]>`
      select logo_path as path from public.merchants
      union select cover_path from public.merchants
      union select card_background_path from public.loyalty_programs
      union select image_path from public.products
      union select image_path from public.weekly_offers`)
      .map((r) => r.path).filter(Boolean),
  );

  const orphans = selectOrphans(objects, referenced, new Date());
  console.log(`${orphans.length} orphan object(s) of ${objects.length} in ${BUCKET}${args.apply ? '' : ' (dry run, use --apply to delete)'}`);
  for (const name of orphans) console.log(`  ${name}`);

  if (args.apply) {
    const storage = createClient(supabaseUrl, serviceKey).storage.from(BUCKET);
    for (let i = 0; i < orphans.length; i += BATCH) {
      const { error } = await storage.remove(orphans.slice(i, i + BATCH));
      if (error) fail(`could not delete a batch: ${error.message}`);
    }
    console.log(`deleted ${orphans.length}`);
  }
} catch (e) {
  fail(`could not clean orphan media: ${(e as Error).message}`);
} finally {
  await sql.end();
}
