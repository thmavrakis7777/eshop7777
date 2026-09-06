import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { daysSince } from "./dates";

// QA-012: the admin product editor showed "Δημιουργήθηκε πριν -1 ημέρες" for
// a just-created product. Root cause: Math.floor() on a diff that can be
// (very slightly) negative — e.g. app-server/DB clock skew of a few
// milliseconds — rounds toward -1, not 0. Elapsed time since creation is
// never actually negative, so daysSince() must clamp at 0 ("today").
describe("daysSince", () => {
  const NOW = new Date("2026-09-06T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a product created moments ago is 0 days old, not -1", () => {
    const createdAt = new Date(NOW.getTime() - 500).toISOString(); // 500ms ago
    expect(daysSince(createdAt)).toBe(0);
  });

  it("clamps at 0 even if the timestamp is (slightly) in the future — clock skew, not a real negative age", () => {
    const createdAt = new Date(NOW.getTime() + 500).toISOString(); // 500ms "ahead"
    expect(daysSince(createdAt)).toBe(0);
  });

  it("created earlier today is 0 days old", () => {
    const createdAt = new Date(NOW.getTime() - 6 * 60 * 60 * 1000).toISOString(); // 6h ago
    expect(daysSince(createdAt)).toBe(0);
  });

  it("just under 24 hours ago is still 0 days old", () => {
    const createdAt = new Date(NOW.getTime() - (24 * 60 * 60 * 1000 - 1)).toISOString();
    expect(daysSince(createdAt)).toBe(0);
  });

  it("exactly 24 hours ago is 1 day old", () => {
    const createdAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(daysSince(createdAt)).toBe(1);
  });

  it("just over 24 hours ago is still 1 day old", () => {
    const createdAt = new Date(NOW.getTime() - (24 * 60 * 60 * 1000 + 1)).toISOString();
    expect(daysSince(createdAt)).toBe(1);
  });

  it("30 days ago is 30 days old", () => {
    const createdAt = new Date(NOW.getTime() - 30 * 86_400_000).toISOString();
    expect(daysSince(createdAt)).toBe(30);
  });
});
