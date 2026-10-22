import assert from 'node:assert/strict';
import { test } from 'node:test';
import { basePathOf, parseCleanArgs, selectOrphans } from './orphan-media.ts';

const NOW = new Date('2026-11-01T12:00:00Z');
const OLD = new Date('2026-10-30T12:00:00Z');
const FRESH = new Date('2026-11-01T06:00:00Z');

test('maps variants back to the stored base path', () => {
  assert.equal(basePathOf('merchants/m/card/abc_540.webp'), 'merchants/m/card/abc');
  assert.equal(basePathOf('merchants/m/card/abc_1080.webp'), 'merchants/m/card/abc');
  assert.equal(basePathOf('merchants/m/card/abc_540.jpg'), 'merchants/m/card/abc.jpg');
  assert.equal(basePathOf('merchants/m/card/odd.png'), 'merchants/m/card/odd.png');
});

test('keeps referenced and fresh objects, selects only old unreferenced ones', () => {
  const objects = [
    { name: 'merchants/m/product/a_360.webp', createdAt: OLD },
    { name: 'merchants/m/product/a_720.webp', createdAt: OLD },
    { name: 'merchants/m/product/b_360.jpg', createdAt: OLD },
    { name: 'merchants/m/product/c_360.webp', createdAt: OLD },
    { name: 'merchants/m/product/d_360.webp', createdAt: FRESH },
  ];
  const referenced = new Set(['merchants/m/product/a', 'merchants/m/product/b.jpg']);
  assert.deepEqual(selectOrphans(objects, referenced, NOW), ['merchants/m/product/c_360.webp']);
});

test('--apply is optional and nothing else is accepted', () => {
  assert.deepEqual(parseCleanArgs([]), { ok: true, apply: false });
  assert.deepEqual(parseCleanArgs(['--apply']), { ok: true, apply: true });
  assert.ok(!parseCleanArgs(['--force']).ok);
  assert.ok(!parseCleanArgs(['--apply=yes']).ok);
});
