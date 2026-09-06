/**
 * Calendar dates in the shop's own timezone.
 *
 * The store, its owner and its customers are all in Greece; the server is
 * not (Vercel runs UTC). Anything that renders a *date* from a timestamp
 * therefore has to name the timezone explicitly, or a 01:00 Athens
 * publication shows as the previous day.
 *
 * Pinning the zone also makes these safe to call during render in a Client
 * Component: server and client produce byte-identical output, so there is no
 * hydration mismatch and no need for the mount-time effect that would
 * otherwise be the only way to reach the browser's own zone.
 *
 * `sv-SE` is used purely because its date format is ISO order (YYYY-MM-DD),
 * which is what <input type="date"> requires — not because anything here is
 * Swedish.
 */
export const SHOP_TIME_ZONE = "Europe/Athens";

const isoDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-08-19" for the given instant, as the date reads in Greece. */
export function shopDateString(value: Date | string): string {
  return isoDate.format(typeof value === "string" ? new Date(value) : value);
}

/** Today's calendar date in Greece. Resolve on the server and pass it down. */
export function shopToday(): string {
  return isoDate.format(new Date());
}

/** True for a well-formed YYYY-MM-DD. Cheap guard before it reaches SQL. */
export function isCalendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Whole 24-hour periods elapsed since `createdAt`, clamped at 0.
 *
 * Deliberately elapsed wall-clock time, not calendar-day difference — this
 * matches what NEW_ARRIVAL_PREDICATE already means in SQL (`now() -
 * created_at`), not a timezone-dependent "how many midnights have passed."
 *
 * Clamped at 0 because Math.floor alone turns any negative diff into -1: if
 * the app server's clock lags the database's by even a few milliseconds, a
 * just-created row's diff is momentarily negative, and floor rounds that
 * toward -1 rather than 0. Elapsed time since creation is never actually
 * negative, so a product created moments ago must read "0 days" ("today"),
 * never "-1 days".
 */
export function daysSince(createdAt: Date | string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
