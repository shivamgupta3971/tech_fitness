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

export type PlanWindow = "upcoming" | "active" | "ended";

/** Where `today` falls relative to a plan's dates (ascending YYYY-MM-DD). An unknown "today" counts as active. */
export function planWindow(dates: string[], today: string): PlanWindow {
  if (!today || dates.length === 0) return "active";
  if (today < dates[0]) return "upcoming";
  if (today > dates[dates.length - 1]) return "ended";
  return "active";
}

/** The day a plan view should open on: today, else the first day (not started) or the last (ended). */
export function defaultDayIndex(dates: string[], today: string): number {
  const exact = dates.indexOf(today);
  if (exact !== -1) return exact;
  return planWindow(dates, today) === "ended" ? Math.max(0, dates.length - 1) : 0;
}

/** Day-of-month number for chips ("5"). */
export function dayOfMonth(dateStr: string): number {
  return parseLocalDate(dateStr).getDate();
}
