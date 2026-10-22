// Pure logic for clean-orphan-media.ts (backend §7). No I/O.
import { parseArgs } from 'node:util';
import { z } from 'zod';

const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const VARIANT = /_\d+\.(webp|jpg)$/;

const cleanArgs = z.strictObject({ apply: z.boolean().optional() });

export function parseCleanArgs(argv: string[]): { ok: true; apply: boolean } | { ok: false; error: string } {
  try {
    const { values } = parseArgs({ args: argv, options: { apply: { type: 'boolean' } }, strict: true, allowPositionals: false });
    const parsed = cleanArgs.safeParse(values);
    return parsed.success ? { ok: true, apply: parsed.data.apply ?? false } : { ok: false, error: '--apply takes no value' };
  } catch (e) {
    return { ok: false, error: (e as Error).message.split(/[.:]/)[0]! };
  }
}

// Mirrors merchantImageUrl (packages/shared/src/catalog.ts): the DB stores the base path; a JPEG
// fallback keeps its ".jpg" extension, so "<base>_540.jpg" belongs to "<base>.jpg".
export function basePathOf(objectName: string): string {
  const match = VARIANT.exec(objectName);
  if (!match) return objectName;
  const stem = objectName.slice(0, match.index);
  return match[1] === 'jpg' ? `${stem}.jpg` : stem;
}

export type StoredObject = { name: string; createdAt: Date };

// WHY min age: an upload in progress is not saved in the DB yet, so a fresh object is not an orphan.
export function selectOrphans(objects: StoredObject[], referencedBasePaths: ReadonlySet<string>, now: Date): string[] {
  return objects
    .filter((o) => now.getTime() - o.createdAt.getTime() > MIN_AGE_MS && !referencedBasePaths.has(basePathOf(o.name)))
    .map((o) => o.name);
}
