import type { Session } from "@supabase/supabase-js";

import { isCustomerSession } from "./roleGuard";

const withMetadata = (app_metadata: unknown) => ({ user: { app_metadata } }) as unknown as Session;

describe("isCustomerSession", () => {
  it("accepts customers", () => {
    expect(isCustomerSession(withMetadata({ role: "customer" }))).toBe(true);
  });

  it.each([
    ["merchant", { role: "merchant", merchant_id: "m1" }],
    ["no role", {}],
    ["undefined metadata", undefined],
    ["null metadata", null],
    ["non-string role", { role: ["customer"] }],
    ["differently cased role", { role: "Customer" }],
  ])("rejects %s", (_label, metadata) => {
    expect(isCustomerSession(withMetadata(metadata))).toBe(false);
  });

  it("rejects a session without user", () => {
    expect(isCustomerSession({} as Session)).toBe(false);
  });
});
