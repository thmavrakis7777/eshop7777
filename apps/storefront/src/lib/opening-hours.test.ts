import { describe, expect, it } from "vitest";
import { parseOpeningHours, parseWeeklySchedule } from "./opening-hours";

// Exactly as saved in Settings on 2026-09-16 — one line, «Τρ» abbreviation,
// doubled spaces and en dashes included.
const STORE_HOURS =
  "Δευ: 9:00 – 15:00 Τρ: 9:00  – 14:30 & 17:30 – 21:00  Τετ:  9:00 – 15:00 Πεμ: 9:00  – 14:30 & 17:30 – 21:00 Παρ: 9:00  – 14:30 & 17:30 – 21:00 Σαβ: 9:00 – 15:00 Κυρ: Κλειστά";

const spec = (dayOfWeek: string[], opens: string, closes: string) => ({
  "@type": "OpeningHoursSpecification",
  dayOfWeek,
  opens,
  closes,
});
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

describe("parseOpeningHours", () => {
  it("reads a single weekday range", () => {
    expect(parseOpeningHours("Δευ-Παρ 09:00-18:00")).toEqual([spec(WEEKDAYS, "09:00", "18:00")]);
  });

  it("reads full Greek day names, split shifts, Saturday and a closed Sunday", () => {
    expect(
      parseOpeningHours("Δευτέρα - Παρασκευή: 9:00 - 14:00 & 17:30 - 21:00, Σάββατο: 9:00 - 14:00, Κυριακή: Κλειστά")
    ).toEqual([
      spec([...WEEKDAYS, "Saturday"], "09:00", "14:00"),
      spec(WEEKDAYS, "17:30", "21:00"),
    ]);
  });

  it("accepts separate lines, uppercase, «έως» and «Καθημερινές»", () => {
    expect(parseOpeningHours("ΚΑΘΗΜΕΡΙΝΕΣ 08.30-16.30\nΣάββατο έως Κυριακή 10:00-13:00")).toEqual([
      spec(WEEKDAYS, "08:30", "16:30"),
      spec(["Saturday", "Sunday"], "10:00", "13:00"),
    ]);
  });

  it("reads a list of individual days and English names", () => {
    expect(parseOpeningHours("Δευ, Τετ, Παρ 10:00-13:00")).toEqual([
      spec(["Monday", "Wednesday", "Friday"], "10:00", "13:00"),
    ]);
    expect(parseOpeningHours("Mon-Fri 9.00-17.00; Sat closed")).toEqual([spec(WEEKDAYS, "09:00", "17:00")]);
  });

  it("reads the store's real saved hours", () => {
    expect(parseOpeningHours(STORE_HOURS)).toEqual([
      spec(["Monday", "Wednesday", "Saturday"], "09:00", "15:00"),
      spec(["Tuesday", "Thursday", "Friday"], "09:00", "14:30"),
      spec(["Tuesday", "Thursday", "Friday"], "17:30", "21:00"),
    ]);
  });

  it("accepts two-letter abbreviations", () => {
    expect(parseOpeningHours("Δε-Πα 09:00-17:00")).toEqual([spec(WEEKDAYS, "09:00", "17:00")]);
  });

  it("returns null for empty input", () => {
    expect(parseOpeningHours(null)).toBeNull();
    expect(parseOpeningHours("   ")).toBeNull();
  });

  it("returns null instead of guessing when anything isn't understood", () => {
    expect(parseOpeningHours("Καθημερινές 9-5")).toBeNull(); // no minutes
    expect(parseOpeningHours("Δευ-Παρ 09:00-18:00 (εκτός αργιών)")).toBeNull(); // extra note
    expect(parseOpeningHours("Δευ-Παρ")).toBeNull(); // no hours
    expect(parseOpeningHours("Δευ-Παρ 09:00-18:00, Σάββατο")).toBeNull(); // trailing day without hours
    expect(parseOpeningHours("Δευ-Παρ 18:00-09:00")).toBeNull(); // closes before it opens
    expect(parseOpeningHours("Δευ-Παρ 09:00-25:00")).toBeNull(); // impossible time
    expect(parseOpeningHours("09:00-18:00")).toBeNull(); // hours with no days
    expect(parseOpeningHours("Δευ 09:00-15:00 & 14:00-21:00")).toBeNull(); // overlapping shifts
    expect(parseOpeningHours("Δευ Κλειστά, Δευ 09:00-15:00")).toBeNull(); // closed and open
    expect(parseOpeningHours("Δ 09:00-15:00")).toBeNull(); // one letter isn't a day
  });
});

describe("parseWeeklySchedule", () => {
  it("lists every mentioned day in week order, shifts sorted, closed days kept", () => {
    expect(parseWeeklySchedule(STORE_HOURS)).toEqual([
      { day: 0, ranges: [{ opens: "09:00", closes: "15:00" }], closed: false },
      { day: 1, ranges: [{ opens: "09:00", closes: "14:30" }, { opens: "17:30", closes: "21:00" }], closed: false },
      { day: 2, ranges: [{ opens: "09:00", closes: "15:00" }], closed: false },
      { day: 3, ranges: [{ opens: "09:00", closes: "14:30" }, { opens: "17:30", closes: "21:00" }], closed: false },
      { day: 4, ranges: [{ opens: "09:00", closes: "14:30" }, { opens: "17:30", closes: "21:00" }], closed: false },
      { day: 5, ranges: [{ opens: "09:00", closes: "15:00" }], closed: false },
      { day: 6, ranges: [], closed: true },
    ]);
  });

  it("returns null when every mentioned day is closed", () => {
    expect(parseWeeklySchedule("Κυρ Κλειστά")).toBeNull();
  });
});
