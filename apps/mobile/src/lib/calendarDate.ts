// WHY: the API speaks 'YYYY-MM-DD'; DateField speaks local-midnight Dates. Converting with local
// getters (never toISOString) keeps the picked day from shifting across timezones.

export function toIsoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function fromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}
