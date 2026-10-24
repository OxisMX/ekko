import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildOnboardingPlan, generatePassword, parseMerchantInput } from './merchant-input.ts';

const example = JSON.parse(readFileSync(new URL('./examples/merchant.example.json', import.meta.url), 'utf8'));
const MERCHANT_ID = '11111111-2222-4333-8444-555555555555';

function withField(path: string[], value: unknown): Record<string, unknown> {
  const copy = structuredClone(example);
  let target = copy;
  for (const key of path.slice(0, -1)) target = target[key];
  const last = path.at(-1)!;
  if (value === undefined) delete target[last];
  else target[last] = value;
  return copy;
}

function rejectedFields(raw: unknown): string[] {
  const result = parseMerchantInput(raw);
  assert.equal(result.ok, false, 'expected the input to be rejected');
  return result.ok ? [] : result.errors.map((e) => e.split(':')[0]!);
}

test('the example fixture is valid', () => {
  const result = parseMerchantInput(example);
  assert.ok(result.ok, result.ok ? '' : result.errors.join('\n'));
});

test('push_coupon_validity_hours defaults to 48 and birthday_benefit is optional', () => {
  const result = parseMerchantInput(withField(['birthday_benefit'], undefined));
  assert.ok(result.ok);
  const noHours = parseMerchantInput(withField(['push_coupon_validity_hours'], undefined));
  assert.ok(noHours.ok && noHours.data.push_coupon_validity_hours === 48);
  assert.ok(result.data.birthday_benefit === undefined);
});

const rejections: Array<[string, string[], unknown]> = [
  ['name over 40 chars', ['name'], 'x'.repeat(41)],
  ['unknown category', ['category'], 'cafeteria'],
  ['description over 140 chars', ['description'], 'x'.repeat(141)],
  ['empty address', ['address'], '  '],
  ['http maps_url', ['maps_url'], 'http://maps.example/x'],
  ['non-URL reviews_url', ['reviews_url'], 'not a url'],
  ['missing logo_path', ['logo_path'], undefined],
  ['unknown billing_period', ['billing_period'], 'monthly'],
  ['invalid paid_until', ['paid_until'], '2026-02-30'],
  ['invalid email', ['email'], 'nope'],
  ['password under 10 chars', ['password'], 'short-pa1'],
  ['password without a digit', ['password'], 'only-letters-here'],
  ['password without a letter', ['password'], '1234567890123'],
  ['3-digit PIN', ['pin'], '123'],
  ['non-digit PIN', ['pin'], '12a4'],
  ['numeric PIN', ['pin'], 1234],
  ['stamps_required 3', ['loyalty_program', 'stamps_required'], 3],
  ['stamps_required 11', ['loyalty_program', 'stamps_required'], 11],
  ['cycle_months 2', ['loyalty_program', 'cycle_months'], 2],
  ['cycle_months 13', ['loyalty_program', 'cycle_months'], 13],
  ['push hours 23', ['push_coupon_validity_hours'], 23],
  ['push hours 49', ['push_coupon_validity_hours'], 49],
  ['no wheel prizes', ['wheel_prizes'], []],
  ['prize label over 30', ['wheel_prizes', '0', 'label'], 'x'.repeat(31)],
  ['unknown prize_type', ['wheel_prizes', '0', 'prize_type'], 'cash'],
  ['zero weight', ['wheel_prizes', '0', 'weight'], 0],
  ['unknown field', ['is_visible'], true],
];

for (const [label, path, value] of rejections) {
  test(`rejects ${label}`, () => {
    assert.ok(rejectedFields(withField(path, value)).includes(path.join('.')));
  });
}

test('validation errors never echo the PIN or the password', () => {
  const raw = withField(['pin'], '98765');
  raw.password = 'abc';
  const result = parseMerchantInput(raw);
  assert.ok(!result.ok);
  const text = result.errors.join('\n');
  assert.ok(!text.includes('98765') && !text.includes('abc'));
});

test('plan maps the input to rows: invisible, active, merchant role', () => {
  const result = parseMerchantInput(example);
  assert.ok(result.ok);
  const plan = buildOnboardingPlan(result.data, MERCHANT_ID);
  assert.deepEqual(plan.authUser, {
    email: example.email,
    app_metadata: { role: 'merchant', merchant_id: MERCHANT_ID },
  });
  assert.equal(plan.merchant.id, MERCHANT_ID);
  assert.equal(plan.merchant.is_visible, false);
  assert.equal(plan.merchant.is_active, true);
  assert.equal(plan.merchant.subscription_status, 'active');
  assert.equal(plan.merchant.logo_path, `merchants/${MERCHANT_ID}/logo/logo-1`);
  assert.equal(plan.loyaltyProgram.merchant_id, MERCHANT_ID);
  assert.deepEqual(plan.wheelPrizes.map((p) => p.position), plan.wheelPrizes.map((_, i) => i + 1));
  assert.ok(plan.wheelPrizes.every((p) => p.merchant_id === MERCHANT_ID));
});

test('the plan never contains the PIN or the password', () => {
  const result = parseMerchantInput(example);
  assert.ok(result.ok);
  const text = JSON.stringify(buildOnboardingPlan(result.data, MERCHANT_ID));
  assert.ok(!text.includes(example.pin), 'PIN leaked into the plan');
  assert.ok(!text.includes(example.password), 'password leaked into the plan');
});

test('password is optional and generatePassword always satisfies the policy', () => {
  assert.ok(parseMerchantInput(withField(['password'], undefined)).ok);
  for (let i = 0; i < 200; i++) {
    const password = generatePassword();
    assert.ok(password.length >= 16);
    assert.ok(parseMerchantInput(withField(['password'], password)).ok, 'generated password rejected by the rule');
  }
});
