import { z } from "zod";
import { ERRORS } from "./errors";
import { MIN_AGE, PASSWORD_MIN_LENGTH, TIMEZONE } from "./rules";

// WHY: client-side mirror of the server rules (F-02 validations, complete_profile); the DB stays
// authoritative and re-checks everything.

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Same rule as the server: `birth + interval '18 years' <= local_today()`. Postgres clamps the
 * day to the end of the month, so a Feb 29 birthday turns 18 on Feb 28 of a non-leap year.
 */
export function isAdult(birthDate: string, today: string): boolean {
  const match = ISO_DATE.exec(birthDate);
  if (!match || !ISO_DATE.test(today)) return false;
  const year = Number(match[1]) + MIN_AGE;
  const month = Number(match[2]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Number(match[3]), daysInMonth);
  const adultOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // ISO dates compare correctly as strings.
  return adultOn <= today;
}

/** Calendar date ('YYYY-MM-DD') in the business timezone (ADR-13), whatever the device timezone. */
export function localToday(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(2, { error: `Tu ${label} debe tener al menos 2 caracteres.` })
    .max(50, { error: `Tu ${label} puede tener hasta 50 caracteres.` });

const email = z.string().trim().pipe(z.email({ error: "Escribe un correo válido, por ejemplo nombre@correo.com." }));

// NOTE: mirrors Auth's `letters_digits` policy (config.toml); Supabase enforces it server-side.
const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { error: `Usa al menos ${PASSWORD_MIN_LENGTH} caracteres.` })
  .regex(/\p{L}/u, { error: "Incluye letras y números." })
  .regex(/\d/, { error: "Incluye letras y números." });

const birthDate = z
  .string()
  .regex(ISO_DATE, { error: "Elige tu fecha de nacimiento." })
  // NOTE: evaluated at parse time against today's date in Mexico City, like the server.
  .refine((value) => isAdult(value, localToday(new Date())), { error: ERRORS["E-07"].message });

export const completeProfileSchema = z.object({
  first_name: name("nombre"),
  last_name: name("apellido"),
  birth_date: birthDate,
});

export const registerSchema = completeProfileSchema.extend({
  email,
  password: newPassword,
  // WHY: boolean input (not z.literal(true)) so forms can start unchecked.
  privacy_accepted: z.boolean().refine((v) => v, { error: "Acepta el aviso de privacidad para continuar." }),
});

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Escribe tu contraseña." }),
});

export const recoverSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "Las contraseñas no coinciden.", path: ["confirm"] });

export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterValues = z.output<typeof registerSchema>;
export type CompleteProfileInput = z.input<typeof completeProfileSchema>;
export type CompleteProfileValues = z.output<typeof completeProfileSchema>;
export type SignInValues = z.output<typeof signInSchema>;
export type RecoverValues = z.output<typeof recoverSchema>;
export type ResetPasswordValues = z.output<typeof resetPasswordSchema>;
