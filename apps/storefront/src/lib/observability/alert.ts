/**
 * Outbound alerting for unhandled server errors — the half of audit finding
 * #15 that instrumentation.ts's logging deliberately left open ("logging and
 * performance monitoring now exist, but nothing pages anyone yet").
 *
 * Why a webhook rather than Sentry. The audit's own note said a real tracker
 * "needs an external account/DSN this session has no way to create", and that
 * is still true — but it conflated two things. The *dashboard and history*
 * genuinely need a vendor. The *alert* does not: a webhook URL is one string
 * the owner pastes from Slack, Discord, Teams or an incident tool, with no
 * SDK, no new dependency, no CSP change (this fetch is server-to-server, never
 * from the browser), and no credentials in the repo. That is the same
 * reasoning lib/storage/upload.ts already applies to Supabase Storage — one
 * `fetch` instead of a client SDK.
 *
 * This is a genuine alerting channel, not a replacement for a tracker. There
 * is still no searchable history, no grouping, no release tracking and no
 * stack traces beyond the message. If those are wanted later, adding
 * @sentry/nextjs alongside this is a small, additive change — the
 * onRequestError hook stays the same shape either way.
 *
 * Unset ERROR_ALERT_WEBHOOK_URL means every function here is a no-op, which
 * is the state the app ships in today. Nothing breaks, nothing is sent, and
 * the existing console.error logging is unaffected.
 */

/**
 * How long the same error digest stays silenced after one alert fires.
 *
 * The failure mode this exists for is real and worse than the outage it would
 * be reporting: a broken high-traffic page throws on every request, and an
 * un-throttled hook turns one incident into thousands of webhook POSTs —
 * rate-limited by the receiver, drowning the channel, and adding latency to
 * every already-failing request. One alert per distinct error per window says
 * the same thing.
 */
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Ceiling on the dedupe map, so a pathological stream of *distinct* digests
 * cannot grow it without bound in a long-lived instance. Small on purpose:
 * this only needs to cover the handful of distinct errors one incident
 * produces, not a catalogue of everything that has ever failed.
 */
const MAX_TRACKED = 100;

/** Never let a slow or hanging webhook keep a serverless function alive. */
const WEBHOOK_TIMEOUT_MS = 2_000;

/**
 * digest → timestamp of the last alert sent for it. Per-instance and
 * in-memory, which is the right trade here rather than the Postgres-backed
 * approach lib/auth/session.ts uses for rate limiting: that one had to be
 * shared because a bypassable login throttle is a security hole, whereas the
 * worst case here is N instances each sending one alert for the same incident
 * — mild duplication, and never a missed alert. Paying a database write on
 * the error path, which may itself be failing because the database is down,
 * would be actively wrong.
 */
const lastAlertedAt = new Map<string, number>();

function shouldSend(key: string, now: number): boolean {
  const previous = lastAlertedAt.get(key);
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return false;

  if (lastAlertedAt.size >= MAX_TRACKED) {
    // Drop whatever is oldest by insertion order. Map iterates in insertion
    // order, and re-setting an existing key does not reorder it, so this is
    // approximately-LRU without tracking access times — close enough for a
    // bounded incident window, and the only cost of evicting wrongly is one
    // duplicate alert.
    const oldest = lastAlertedAt.keys().next();
    if (!oldest.done) lastAlertedAt.delete(oldest.value);
  }

  lastAlertedAt.set(key, now);
  return true;
}

export interface ErrorAlert {
  message: string;
  digest?: string;
  path?: string;
  method?: string;
  routePath?: string;
}

/**
 * Formats one alert as a payload that works, unmodified, with the three
 * receivers an owner is most likely to have: Slack and Teams read `text`,
 * Discord reads `content`. Sending both costs nothing and removes the
 * "which shape does my webhook want" step from setup entirely.
 */
function buildPayload(alert: ErrorAlert): string {
  const lines = [
    `🔴 Σφάλμα διακομιστή — ${alert.routePath ?? alert.path ?? "unknown route"}`,
    alert.method && alert.path ? `${alert.method} ${alert.path}` : null,
    alert.message,
    alert.digest ? `digest: ${alert.digest}` : null,
  ].filter(Boolean);

  const text = lines.join("\n");
  return JSON.stringify({ text, content: text });
}

/**
 * Sends one alert, unless it is a duplicate inside the dedupe window or no
 * webhook is configured.
 *
 * Deliberately swallows every failure. This runs on the error path: if the
 * alerting itself throws, it would replace a useful logged error with a
 * confusing one, and in a hook like onRequestError an unhandled rejection is
 * a genuine risk to the process. A webhook that is down is not an incident
 * worth creating a second incident over — the console.error line was already
 * written before this was ever called.
 */
export async function sendErrorAlert(alert: ErrorAlert): Promise<void> {
  const webhookUrl = process.env.ERROR_ALERT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  // Dedupe on the digest when Next gave us one (stable per distinct error),
  // and fall back to route+message, which is stable enough for the same
  // purpose. Never the raw path alone — two different bugs on one route
  // should not silence each other.
  const key = alert.digest ?? `${alert.routePath ?? alert.path ?? ""}:${alert.message}`;
  if (!shouldSend(key, Date.now())) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buildPayload(alert),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
  } catch {
    // Intentionally silent — see the note above.
  }
}

/** Test seam: the dedupe map is module state and would leak between cases. */
export function __resetAlertDedupeForTests(): void {
  lastAlertedAt.clear();
}
