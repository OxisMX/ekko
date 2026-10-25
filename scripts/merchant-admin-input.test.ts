import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generatePin, parseResetPinArgs, parseReviewDemoArgs, parseRevokeSessionsArgs, parseStatusArgs } from './merchant-admin-input.ts';

const TODAY = '2026-10-21';
const ID = '11111111-2222-4333-8444-555555555555';
import type { Parsed } from './merchant-admin-input.ts';
function ok<T>(r: Parsed<T>): T {
  if (!r.ok) assert.fail(r.errors.join('\n'));
  return r.data;
}
function errors(r: Parsed<unknown>): string {
  if (r.ok) assert.fail('expected a rejection');
  return r.errors.join('\n');
}

test('inactive hides the merchant, closes admin sessions and never touches data', () => {
  const plan = ok(parseStatusArgs(['--merchant', 'c3@ekko.test', '--status', 'inactive'], TODAY));
  assert.deepEqual(plan.changes, { is_active: false, subscription_status: 'inactive', is_visible: false });
  assert.equal(plan.closeAdminSessions, true);
});

test('active needs a future paid-until and shows the merchant again unless told otherwise', () => {
  const plan = ok(parseStatusArgs(['--merchant', ID, '--status', 'active', '--paid-until', '2027-01-31'], TODAY));
  assert.deepEqual(plan.changes, { is_active: true, subscription_status: 'active', paid_until: '2027-01-31', is_visible: true });
  const hidden = ok(parseStatusArgs(['--merchant', ID, '--status', 'active', '--paid-until', '2027-01-31', '--visible', 'false'], TODAY));
  assert.equal(hidden.changes.is_visible, false);
});

for (const [label, argv] of [
  ['active without paid-until', ['--merchant', ID, '--status', 'active']],
  ['active with today as paid-until', ['--merchant', ID, '--status', 'active', '--paid-until', TODAY]],
  ['active with a past paid-until', ['--merchant', ID, '--status', 'active', '--paid-until', '2026-01-01']],
  ['impossible date', ['--merchant', ID, '--status', 'active', '--paid-until', '2027-02-30']],
  ['inactive with paid-until', ['--merchant', ID, '--status', 'inactive', '--paid-until', '2027-01-31']],
  ['inactive and visible', ['--merchant', ID, '--status', 'inactive', '--visible', 'true']],
  ['unknown status', ['--merchant', ID, '--status', 'paused']],
  ['merchant neither id nor email', ['--merchant', 'abc', '--status', 'inactive']],
  ['missing merchant', ['--status', 'inactive']],
  ['unknown flag', ['--merchant', ID, '--status', 'inactive', '--force']],
] as const) {
  test(`set-merchant-status rejects ${label}`, () => {
    assert.ok(!parseStatusArgs([...argv], TODAY).ok);
  });
}

test('reset-pin generates a 4-digit PIN with leading zeros, or keeps the given one', () => {
  assert.equal(generatePin(() => 7), '0007');
  assert.match(generatePin(), /^\d{4}$/);
  const generated = ok(parseResetPinArgs(['--merchant', ID], () => 42));
  assert.deepEqual(generated, { merchantRef: ID, pin: '0042', generated: true });
  const given = ok(parseResetPinArgs(['--merchant', 'a@b.co', '--pin', '4321']));
  assert.deepEqual(given, { merchantRef: 'a@b.co', pin: '4321', generated: false });
});

test('reset-pin rejects malformed PINs without echoing them', () => {
  for (const pin of ['123', '12345', '12a4']) {
    const text = errors(parseResetPinArgs(['--merchant', ID, '--pin', pin]));
    assert.ok(!text.includes(pin));
  }
  assert.ok(!parseResetPinArgs(['--pin', '1234']).ok);
});

test('revoke-sessions takes exactly one merchant reference', () => {
  assert.deepEqual(ok(parseRevokeSessionsArgs(['--merchant', 'a@b.co'])), { merchantRef: 'a@b.co' });
  assert.deepEqual(ok(parseRevokeSessionsArgs(['--merchant', ID])), { merchantRef: ID });
  assert.ok(!parseRevokeSessionsArgs([]).ok);
  assert.ok(!parseRevokeSessionsArgs(['--merchant', 'nope']).ok);
  assert.ok(!parseRevokeSessionsArgs(['--merchant', ID, '--all']).ok);
});

test('review-demo needs a merchant (email or id) and a customer email, nothing else', () => {
  assert.deepEqual(ok(parseReviewDemoArgs(['--merchant', ID, '--customer', 'revisor@oxis.mx'])), { merchantRef: ID, customerEmail: 'revisor@oxis.mx' });
  assert.ok(parseReviewDemoArgs(['--merchant', 'panel@oxis.mx', '--customer', 'revisor@oxis.mx']).ok);
  assert.ok(!parseReviewDemoArgs(['--merchant', ID]).ok);
  assert.ok(!parseReviewDemoArgs(['--customer', 'revisor@oxis.mx']).ok);
  assert.ok(!parseReviewDemoArgs(['--merchant', ID, '--customer', ID]).ok);
  assert.ok(!parseReviewDemoArgs(['--merchant', ID, '--customer', 'a@b.co', '--force']).ok);
});
