import { AuthApiError } from "@supabase/supabase-js";

import { needsEmailVerification, retryAfterSeconds } from "./emailVerification";

jest.mock("../../lib/supabase", () => ({ supabase: {} }));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));

describe("retryAfterSeconds", () => {
  it("reads the wait from Auth's 429 message", () => {
    const error = new AuthApiError("For security purposes, you can only request this after 42 seconds.", 429, "over_email_send_rate_limit");
    expect(retryAfterSeconds(error)).toBe(42);
  });

  it("falls back to the full 60 s when the message has no number", () => {
    expect(retryAfterSeconds(new AuthApiError("Email rate limit exceeded", 429, "over_email_send_rate_limit"))).toBe(60);
  });

  it("returns null for anything that is not a rate limit", () => {
    expect(retryAfterSeconds(new AuthApiError("Bad", 400, "validation_failed"))).toBeNull();
    expect(retryAfterSeconds(new TypeError("Network request failed"))).toBeNull();
  });
});

describe("needsEmailVerification", () => {
  it("is true only for unverified email accounts (F-03: Google/Apple are verified)", () => {
    expect(needsEmailVerification({ auth_provider: "email", email_verified: false })).toBe(true);
    expect(needsEmailVerification({ auth_provider: "email", email_verified: true })).toBe(false);
    expect(needsEmailVerification({ auth_provider: "google", email_verified: false })).toBe(false);
    expect(needsEmailVerification(undefined)).toBe(false);
  });
});
