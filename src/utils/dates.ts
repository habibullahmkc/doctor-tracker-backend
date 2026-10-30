import { z } from "zod";

/** All calendar logic is done in Bangladesh time (UTC+6, no DST). */
export const TIMEZONE = "Asia/Dhaka";
const OFFSET = "+06:00";
export const DAY_MS = 24 * 60 * 60 * 1000;

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-10-30" for the given instant, in Dhaka time. */
export const toDhakaYMD = (date: Date) => ymdFormatter.format(date);

/** Midnight (Dhaka) at the start of the given "YYYY-MM-DD". */
export const startOfDhakaDay = (ymd: string) => new Date(`${ymd}T00:00:00${OFFSET}`);

/** Midnight (Dhaka) on the 1st of the month, `monthsAgo` months before now. */
export function startOfDhakaMonth(monthsAgo = 0, now = new Date()) {
  const [year, month] = toDhakaYMD(now).split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 - monthsAgo, 1));
  const ym = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}`;
  return { start: new Date(`${ym}-01T00:00:00${OFFSET}`), key: ym };
}

/** Query param "YYYY-MM-DD" → Date at Dhaka midnight. */
export const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform(startOfDhakaDay)
  .refine((date) => !Number.isNaN(date.getTime()), "Invalid date");

/** Inclusive calendar range: `to` covers the whole day. */
export function dateRangeFilter(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  const range: { $gte?: Date; $lt?: Date } = {};
  if (from) range.$gte = from;
  if (to) range.$lt = new Date(to.getTime() + DAY_MS);
  return range;
}
