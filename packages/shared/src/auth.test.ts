import { describe, expect, it } from "vitest";
import {
  completeProfileSchema,
  isAdult,
  localToday,
  recoverSchema,
  registerSchema,
  resetPasswordSchema,
  signInSchema,
} from "./auth";
import { ERRORS } from "./errors";

describe("isAdult (mirrors `birth + interval '18 years' <= local_today`)", () => {
  it.each([
    ["2008-10-20", "2026-10-20", true], // TC-002: turns 18 today
    ["2008-10-21", "2026-10-20", false], // TC-003: turns 18 tomorrow
    ["2008-10-19", "2026-10-20", true],
    ["1990-01-01", "2026-10-20", true],
    ["2026-10-20", "2026-10-20", false],
    // Feb 29: Postgres clamps 2008-02-29 + 18 years to 2026-02-28.
    ["2008-02-29", "2026-02-27", false],
    ["2008-02-29", "2026-02-28", true],
    ["2008-02-29", "2026-03-01", true],
    // Leap target year: the 29th exists, so no clamping.
    ["2010-02-29", "2028-02-28", false],
    ["2006-02-28", "2024-02-28", true],
  ])("born %s, today %s -> %s", (birth, today, expected) => {
    expect(isAdult(birth, today)).toBe(expected);
  });

  it.each(["", "2008-1-1", "20081020", "not a date"])("rejects malformed %j", (birth) => {
    expect(isAdult(birth, "2026-10-20")).toBe(false);
  });
});

describe("localToday", () => {
  it("uses America/Mexico_City, not UTC", () => {
    // 2026-10-21 03:00 UTC is still 2026-10-20 21:00 in Mexico City (UTC-6).
    expect(localToday(new Date("2026-10-21T03:00:00Z"))).toBe("2026-10-20");
    expect(localToday(new Date("2026-10-21T06:00:00Z"))).toBe("2026-10-21");
  });

  it("pads month and day", () => {
    expect(localToday(new Date("2026-01-05T18:00:00Z"))).toBe("2026-01-05");
  });
});

const validRegister = {
  first_name: "  Daniela ",
  last_name: "Ruiz",
  email: " daniela@example.com ",
  password: "abcdefgh12",
  birth_date: "2000-03-12",
  privacy_accepted: true,
};

function fieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));
}

describe("registerSchema", () => {
  it("accepts valid data and trims names and email", () => {
    const result = registerSchema.safeParse(validRegister);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ first_name: "Daniela", email: "daniela@example.com" });
  });

  it.each([
    ["first_name", "A"],
    ["first_name", "   Al   ".replace("l", "")],
    ["last_name", "x".repeat(51)],
    ["email", "daniela@"],
    ["password", "abcdefgh1"],
    ["birth_date", ""],
    ["privacy_accepted", false],
  ])("rejects invalid %s", (field, value) => {
    const errors = fieldErrors(registerSchema.safeParse({ ...validRegister, [field]: value }));
    expect(Object.keys(errors)).toEqual([field]);
    expect(errors[field]).toMatch(/\S/);
  });

  it("accepts 50-character names", () => {
    expect(registerSchema.safeParse({ ...validRegister, last_name: "x".repeat(50) }).success).toBe(true);
  });

  it("rejects an under-18 birth date with the E-07 message", () => {
    const nextYear = String(new Date().getFullYear() + 1);
    const errors = fieldErrors(registerSchema.safeParse({ ...validRegister, birth_date: `${nextYear}-01-01` }));
    expect(errors.birth_date).toBe(ERRORS["E-07"].message);
  });
});

describe("completeProfileSchema", () => {
  it("validates names and birth date only", () => {
    expect(completeProfileSchema.safeParse({ first_name: "Ana", last_name: "Lo", birth_date: "1999-01-01" }).success).toBe(true);
    expect(Object.keys(fieldErrors(completeProfileSchema.safeParse({ first_name: "A", last_name: "Lo", birth_date: "" })))).toEqual([
      "first_name",
      "birth_date",
    ]);
  });
});

describe("signInSchema / recoverSchema / resetPasswordSchema", () => {
  it("signIn needs an email and any password", () => {
    expect(signInSchema.safeParse({ email: "a@b.mx", password: "x" }).success).toBe(true);
    expect(Object.keys(fieldErrors(signInSchema.safeParse({ email: "", password: "" })))).toEqual(["email", "password"]);
  });

  it.each([
    ["too short", "abcdefg12", "Usa al menos 10 caracteres."],
    ["no digit", "abcdefghijk", "Incluye letras y números."],
    ["no letter", "1234567890", "Incluye letras y números."],
  ])("password rule: %s", (_label, password, message) => {
    const result = resetPasswordSchema.safeParse({ password, confirm: password });
    expect(fieldErrors(result).password).toContain(message);
  });

  it("recover needs a valid email", () => {
    expect(recoverSchema.safeParse({ email: "a@b.mx" }).success).toBe(true);
    expect(recoverSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("reset needs a strong password and a matching confirmation", () => {
    expect(resetPasswordSchema.safeParse({ password: "abcdefgh12", confirm: "abcdefgh12" }).success).toBe(true);
    expect(fieldErrors(resetPasswordSchema.safeParse({ password: "abcdefgh12", confirm: "abcdefgh13" }))).toHaveProperty("confirm");
    expect(fieldErrors(resetPasswordSchema.safeParse({ password: "123", confirm: "123" }))).toHaveProperty("password");
  });
});
