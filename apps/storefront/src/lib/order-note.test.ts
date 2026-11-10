import { describe, expect, it } from "vitest";
import { ORDER_NOTE_MAX_LENGTH, normalizeOrderNote } from "@/lib/order-note";

describe("normalizeOrderNote", () => {
  it("keeps an ordinary note, trimmed", () => {
    expect(normalizeOrderNote("  κουδούνι Παπαδάκης, 2ος όροφος  ")).toBe("κουδούνι Παπαδάκης, 2ος όροφος");
  });

  it("stores nothing for an empty or whitespace-only note", () => {
    expect(normalizeOrderNote("")).toBeNull();
    expect(normalizeOrderNote("   \n  ")).toBeNull();
    expect(normalizeOrderNote(undefined)).toBeNull();
    expect(normalizeOrderNote(42)).toBeNull();
  });

  it("keeps line breaks but no more than one blank line, and drops control characters", () => {
    expect(normalizeOrderNote("α\r\n\r\n\r\n\r\nβ\tγ\u0007")).toBe("α\n\nβγ");
  });

  it("caps the length", () => {
    expect(normalizeOrderNote("x".repeat(ORDER_NOTE_MAX_LENGTH + 50))).toHaveLength(ORDER_NOTE_MAX_LENGTH);
  });
});
