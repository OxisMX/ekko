import { describe, expect, it } from "vitest";
import { isValidRedemptionCode, normalizeRedemptionCode } from "./redemption";

describe("normalizeRedemptionCode", () => {
  it("uppercases and strips spaces and hyphens", () => {
    expect(normalizeRedemptionCode(" ab3 - k9z ")).toBe("AB3K9Z");
  });
});

describe("isValidRedemptionCode", () => {
  it("accepts a valid code", () => {
    expect(isValidRedemptionCode("AB3K9Z")).toBe(true);
  });

  it("rejects lowercase and unnormalized input", () => {
    expect(isValidRedemptionCode("ab3k9z")).toBe(false);
    expect(isValidRedemptionCode("AB3 K9")).toBe(false);
  });

  it.each(["0", "1", "I", "L", "O"])("rejects ambiguous char %s", (char) => {
    expect(isValidRedemptionCode(`AB3K9${char}`)).toBe(false);
  });

  it("rejects wrong length", () => {
    expect(isValidRedemptionCode("AB3K9")).toBe(false);
    expect(isValidRedemptionCode("AB3K9ZZ")).toBe(false);
  });
});
