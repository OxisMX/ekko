import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chunk,
  classifyTickets,
  mapRpcError,
  parseSendPushBody,
  sumOutcomes,
} from "../supabase/functions/send-push/logic.mts";

const KEY = "11111111-1111-4111-8111-111111111111";
const coupon = { title: "2x1", description: "En bebidas.", terms: "Solo sucursal.", validity_hours: 24 };
const field = (input: unknown) => {
  const result = parseSendPushBody(input);
  return result.ok ? null : result.field;
};

test("parseSendPushBody accepts and trims a valid body, coupon optional", () => {
  const plain = parseSendPushBody({ idempotency_key: KEY, title: " Hola ", body: "Mundo" });
  assert.deepEqual(plain, { ok: true, value: { idempotency_key: KEY, title: "Hola", body: "Mundo" } });
  const withCoupon = parseSendPushBody({ idempotency_key: KEY, title: "a", body: "b", coupon });
  assert.ok(withCoupon.ok && withCoupon.value.coupon?.validity_hours === 24);
});

test("parseSendPushBody reports the failing field", () => {
  const base = { idempotency_key: KEY, title: "a", body: "b" };
  assert.equal(field(null), "body");
  assert.equal(field({ ...base, idempotency_key: "x" }), "idempotency_key");
  assert.equal(field({ ...base, title: " " }), "title");
  assert.equal(field({ ...base, title: "x".repeat(51) }), "title");
  assert.equal(field({ ...base, body: "x".repeat(151) }), "body");
  assert.equal(field({ ...base, coupon: { ...coupon, title: "" } }), "coupon_title");
  assert.equal(field({ ...base, coupon: { ...coupon, description: "x".repeat(201) } }), "coupon_description");
  assert.equal(field({ ...base, coupon: { ...coupon, terms: "x".repeat(1001) } }), "coupon_terms");
  assert.equal(field({ ...base, coupon: { ...coupon, validity_hours: 23 } }), "coupon_validity_hours");
  assert.equal(field({ ...base, coupon: { ...coupon, validity_hours: 24.5 } }), "coupon_validity_hours");
});

test("chunk splits in batches of 100", () => {
  const sizes = chunk(Array.from({ length: 250 }, (_, i) => i)).map((b) => b.length);
  assert.deepEqual(sizes, [100, 100, 50]);
  assert.deepEqual(chunk([]), []);
});

test("classifyTickets counts ok/error and collects DeviceNotRegistered tokens", () => {
  const outcome = classifyTickets(["a", "b", "c"], {
    data: [
      { status: "ok", id: "1" },
      { status: "error", message: "x", details: { error: "DeviceNotRegistered" } },
      { status: "error", message: "y", details: { error: "MessageRateExceeded" } },
    ],
  });
  assert.deepEqual(outcome, { sent: 1, failed: 2, invalidTokens: ["b"] });
});

test("classifyTickets counts the whole batch as failed when the response does not line up", () => {
  assert.deepEqual(classifyTickets(["a", "b"], { data: [{ status: "ok" }] }), { sent: 0, failed: 2, invalidTokens: [] });
  assert.deepEqual(classifyTickets(["a"], { errors: [{}] }), { sent: 0, failed: 1, invalidTokens: [] });
});

test("sumOutcomes adds batches", () => {
  const total = sumOutcomes([
    { sent: 1, failed: 2, invalidTokens: ["a"] },
    { sent: 3, failed: 0, invalidTokens: ["b"] },
  ]);
  assert.deepEqual(total, { sent: 4, failed: 2, invalidTokens: ["a", "b"] });
});

test("mapRpcError maps app errors and hides everything else as E-99", () => {
  assert.deepEqual(mapRpcError({ message: "E-17", details: '{"resets_on":"2027-06-01"}' }), {
    status: 429, body: { error: "E-17", details: { resets_on: "2027-06-01" } },
  });
  assert.deepEqual(mapRpcError({ message: "E-16", details: null }), { status: 403, body: { error: "E-16" } });
  assert.deepEqual(mapRpcError({ message: "E-23", details: "{bad" }), { status: 400, body: { error: "E-23" } });
  assert.deepEqual(mapRpcError({ message: "relation x does not exist" }), { status: 500, body: { error: "E-99" } });
});
