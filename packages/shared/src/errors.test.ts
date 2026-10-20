import { describe, expect, it } from "vitest";
import { parseRpcError } from "./errors";

describe("parseRpcError", () => {
  it("returns known code with parsed details", () => {
    expect(parseRpcError({ message: "E-04", details: '{"next_available_on":"2026-10-21"}' })).toEqual({
      code: "E-04",
      details: { next_available_on: "2026-10-21" },
    });
  });

  it("returns null details when absent", () => {
    expect(parseRpcError({ message: "E-02", details: null })).toEqual({ code: "E-02", details: null });
  });

  it("maps unknown codes to E-99", () => {
    expect(parseRpcError({ message: "boom" })).toEqual({ code: "E-99", details: null });
    expect(parseRpcError({})).toEqual({ code: "E-99", details: null });
  });

  it("keeps the code when details JSON is malformed", () => {
    expect(parseRpcError({ message: "E-14", details: "{not json" })).toEqual({ code: "E-14", details: null });
  });
});
