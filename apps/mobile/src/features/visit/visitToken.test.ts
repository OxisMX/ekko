import { isVisitToken, parseVisitToken } from "./visitToken";

const TOKEN = "AbCdEfGhIjKlMnOpQr_-12";

describe("parseVisitToken (TC-051)", () => {
  it.each([
    `https://ekko.oxis.mx/v/${TOKEN}`,
    `https://staging.ekko.oxis.mx/v/${TOKEN}`,
    `http://localhost:5173/v/${TOKEN}`,
    `ekko://v/${TOKEN}`,
    `exp://192.168.1.10:8081/--/v/${TOKEN}`,
    `  https://ekko.oxis.mx/v/${TOKEN}\n`,
  ])("accepts %s", (raw) => {
    expect(parseVisitToken(raw, "http://localhost:5173")).toBe(TOKEN);
  });

  it.each([
    TOKEN,
    `https://ekko.oxis.mx/v/${TOKEN}x`,
    `https://ekko.oxis.mx/v/${TOKEN.slice(1)}`,
    `https://ekko.oxis.mx/v/${TOKEN}/extra`,
    `https://ekko.oxis.mx/v/${TOKEN}?a=1`,
    `https://ekko.oxis.mx/v/AbCdEfGhIjKlMnOpQr!@12`,
    `https://evil.mx/v/${TOKEN}`,
    `https://ekko.oxis.mx.evil.mx/v/${TOKEN}`,
    `http://ekko.oxis.mx/v/${TOKEN}`,
    `https://ekko.oxis.mx/x/${TOKEN}`,
    `http://localhost:3000/v/${TOKEN}`,
    "WIFI:S:cafe;T:WPA;P:secret;;",
    "",
  ])("rejects %s", (raw) => {
    expect(parseVisitToken(raw, "http://localhost:5173")).toBeNull();
  });

  it("validates bare tokens", () => {
    expect(isVisitToken(TOKEN)).toBe(true);
    expect(isVisitToken("short")).toBe(false);
    expect(isVisitToken(undefined)).toBe(false);
  });
});
