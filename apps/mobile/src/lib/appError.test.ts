import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

import { toAppError } from "./appError";
import { reportError } from "./sentry";

jest.mock("./sentry", () => ({ reportError: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe("toAppError", () => {
  it.each([
    ["auth fetch failure", new AuthRetryableFetchError("Network request failed", 0), "E-01"],
    ["PostgREST fetch failure", { message: "TypeError: Network request failed", details: "", code: "" }, "E-01"],
    ["thrown TypeError", new TypeError("Network request failed"), "E-01"],
    ["existing user", new AuthApiError("User already registered", 422, "user_already_exists"), "E-20"],
    ["existing email", new AuthApiError("Email exists", 422, "email_exists"), "E-20"],
    ["auth rate limit", new AuthApiError("Too many", 429, "over_request_rate_limit"), "E-13"],
    ["RPC E-07", { message: "E-07", details: null, code: "P0001" }, "E-07"],
    ["RPC E-19", { message: "E-19", details: null, code: "P0001" }, "E-19"],
  ])("maps %s", (_name, error, code) => {
    expect(toAppError(error).code).toBe(code);
    expect(reportError).not.toHaveBeenCalled();
  });

  it("keeps RPC details (E-23 field)", () => {
    expect(toAppError({ message: "E-23", details: '{"field":"last_name"}', code: "P0001" })).toEqual({
      code: "E-23",
      details: { field: "last_name" },
    });
  });

  it.each([
    ["unknown auth error", new AuthApiError("boom", 500, "unexpected_failure")],
    ["unknown PostgREST error", { message: "permission denied", details: null, code: "42501" }],
    ["random value", "oops"],
  ])("maps %s to E-99 and reports it", (_name, error) => {
    expect(toAppError(error)).toEqual({ code: "E-99", details: null });
    expect(reportError).toHaveBeenCalledWith(error);
  });
});
