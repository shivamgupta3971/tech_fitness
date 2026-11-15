/**
 * Local-calendar date helpers (YYYY-MM-DD).
 *
 * Plans are day-based, so "today" must be the user's *local* date. `toISOString()` returns the UTC date,
 * which is yesterday/tomorrow for a few hours every day outside UTC (e.g. before 05:30 in India).
 */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as YYYY-MM-DD. */
export function toLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses YYYY-MM-DD as a local date at midnight (never as UTC). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** True for a well-formed, real calendar date (rejects 2026-02-31). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  return toLocalDateString(parseLocalDate(value)) === value;
}

/** Adds (or subtracts) whole days to a YYYY-MM-DD string. */
export function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const ms = parseLocalDate(to).getTime() - parseLocalDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** "Mon", "Tue", ... for a YYYY-MM-DD string. */
export function weekdayShort(dateStr: string, locale = "en-US"): string {
  return parseLocalDate(dateStr).toLocaleDateString(locale, { weekday: "short" });
}

/** Index of `today` within a list of YYYY-MM-DD dates, or -1 if it isn't part of the list. */
export function indexOfDate(dates: string[], today: string): number {
  return dates.indexOf(today);
}
