import { localToday, TIMEZONE } from "@ekko/shared";

/** `dd/mm/aa` (year "2-digit") or `dd/mm/aaaa` ("numeric"), always in the business timezone (ADR-13). */
export function formatDate(iso: string, year: "2-digit" | "numeric" = "numeric"): string {
  const parts = new Intl.DateTimeFormat("es-MX", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", year }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

/** `12 abr`: day and short month in the business timezone, for compact "Vence el …" labels. */
export function formatShortDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("es-MX", { timeZone: TIMEZONE, day: "numeric", month: "short" }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month").replace(".", "")}`;
}

/** ISO weekday (1 = lunes … 7 = domingo, as `weekly_offers.weekday`) of `now` in Mexico City. */
export function isoWeekdayInMexico(now: Date): number {
  // WHY: noon UTC of the local calendar date keeps getUTCDay() on that same date.
  const day = new Date(`${localToday(now)}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMXN(amount: number): string {
  return mxn.format(amount);
}
