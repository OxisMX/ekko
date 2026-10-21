import { parseRecoveryParams } from "./recoveryLink";

// Shapes as Expo Router hands them over: query params as keys, the URL fragment under "#".
describe("parseRecoveryParams (F-05)", () => {
  it("reads the PKCE code from the query", () => {
    expect(parseRecoveryParams({ code: "abc-123" })).toEqual({ kind: "code", code: "abc-123" });
  });

  it("reads tokens from the implicit-flow fragment", () => {
    expect(
      parseRecoveryParams({ "#": "access_token=at&expires_in=3600&refresh_token=rt&token_type=bearer&type=recovery" })
    ).toEqual({ kind: "tokens", accessToken: "at", refreshToken: "rt" });
  });

  it.each([
    [{ "#": "error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired" }],
    [{ error: "access_denied", error_code: "otp_expired" }],
    [{ "#": "access_token=at" }],
    [{ code: ["a", "b"] }],
  ])("treats %j as invalid", (params) => {
    expect(parseRecoveryParams(params)).toEqual({ kind: "invalid" });
  });

  it("returns none without recovery params", () => {
    expect(parseRecoveryParams({})).toEqual({ kind: "none" });
  });
});
