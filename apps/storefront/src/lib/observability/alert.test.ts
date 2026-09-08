import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendErrorAlert, __resetAlertDedupeForTests } from "@/lib/observability/alert";

/**
 * The dedupe path is the part of this module worth testing: it runs only
 * during an incident, which is exactly when nobody is watching it, and both
 * ways of getting it wrong are expensive — too eager and a real outage goes
 * unreported, too loose and one broken page floods the channel it was
 * supposed to alert.
 */

const WEBHOOK = "https://hooks.example.test/services/T000/B000/xxx";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetAlertDedupeForTests();
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sendErrorAlert", () => {
  it("does nothing at all when no webhook is configured", async () => {
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", "");
    await sendErrorAlert({ message: "boom", digest: "abc" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a payload both Slack-shaped and Discord-shaped receivers accept", async () => {
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", WEBHOOK);
    await sendErrorAlert({
      message: "connection terminated unexpectedly",
      digest: "abc123",
      path: "/proionta/test",
      method: "GET",
      routePath: "/proionta/[handle]",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe("POST");

    const body = JSON.parse(String(init.body));
    // Slack/Teams read `text`, Discord reads `content` — both must be present.
    expect(body.text).toBe(body.content);
    expect(body.text).toContain("/proionta/[handle]");
    expect(body.text).toContain("connection terminated unexpectedly");
    expect(body.text).toContain("abc123");
  });

  it("sends once per digest inside the dedupe window, not once per request", async () => {
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", WEBHOOK);
    // The real scenario: one broken page, many hits.
    for (let i = 0; i < 50; i++) {
      await sendErrorAlert({ message: "same failure", digest: "dup", path: "/kalathi" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never lets one silenced error hide a different one", async () => {
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", WEBHOOK);
    await sendErrorAlert({ message: "first", digest: "d1" });
    await sendErrorAlert({ message: "second", digest: "d2" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("distinguishes two different errors on the same route when there is no digest", async () => {
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", WEBHOOK);
    await sendErrorAlert({ message: "null variant", routePath: "/proionta/[handle]" });
    await sendErrorAlert({ message: "timeout", routePath: "/proionta/[handle]" });
    // Same route, different cause — deduping on route alone would lose one.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await sendErrorAlert({ message: "timeout", routePath: "/proionta/[handle]" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("alerts again once the dedupe window has passed", async () => {
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", WEBHOOK);
    vi.useFakeTimers();

    await sendErrorAlert({ message: "still broken", digest: "d" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Just inside the 5-minute window — still silenced.
    vi.advanceTimersByTime(4 * 60 * 1000);
    await sendErrorAlert({ message: "still broken", digest: "d" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Past it — an ongoing incident should say so again rather than go quiet
    // forever after its first minute.
    vi.advanceTimersByTime(2 * 60 * 1000);
    await sendErrorAlert({ message: "still broken", digest: "d" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("swallows a failing webhook instead of throwing on the error path", async () => {
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", WEBHOOK);
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    // A rejection here would surface as an unhandled rejection inside
    // onRequestError — a second, more confusing failure on top of the real one.
    await expect(sendErrorAlert({ message: "x", digest: "y" })).resolves.toBeUndefined();
  });

  it("keeps the dedupe map bounded when every error is distinct", async () => {
    vi.stubEnv("ERROR_ALERT_WEBHOOK_URL", WEBHOOK);
    // 250 distinct digests against a 100-entry ceiling: all must send, and
    // the map must not have grown to 250.
    for (let i = 0; i < 250; i++) {
      await sendErrorAlert({ message: "unique", digest: `d${i}` });
    }
    expect(fetchMock).toHaveBeenCalledTimes(250);

    // The oldest entries were evicted, so the very first digest is no longer
    // silenced — one duplicate alert, which is the intended cost of a bound.
    await sendErrorAlert({ message: "unique", digest: "d0" });
    expect(fetchMock).toHaveBeenCalledTimes(251);
  });
});
