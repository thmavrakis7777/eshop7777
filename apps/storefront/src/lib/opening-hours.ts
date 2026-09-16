/**
 * Reads the admin's free-text "Ώρες λειτουργίας" (site_setting.business_hours)
 * into a real weekly schedule — used for the footer's day-by-day hours list
 * and for schema.org OpeningHoursSpecification in the Store JSON-LD.
 *
 * Deliberately strict: the field is one free-text input, and stating wrong
 * opening hours (to customers or to search engines) is worse than stating
 * none. So this reads only an unambiguous shape — a day or day range, then one
 * or more HH:MM–HH:MM ranges or «Κλειστά», e.g.
 * "Δευ: 9:00 – 15:00 Τρ: 9:00 – 14:30 & 17:30 – 21:00 … Κυρ: Κλειστά" — and
 * returns null the moment anything isn't understood (a note like "εκτός
 * αργιών", "9-5" without minutes, a closing time before opening, two shifts
 * that overlap). Null means callers fall back: the footer shows the text as
 * typed, the JSON-LD omits openingHoursSpecification.
 */

export type TimeRange = { opens: string; closes: string };

/** `day` is 0 = Monday … 6 = Sunday. Only days the text mentions appear. */
export type DaySchedule = { day: number; ranges: TimeRange[]; closed: boolean };

export type OpeningHoursSpecification = {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: string[];
  opens: string;
  closes: string;
};

const SCHEMA_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Keyed by the first three letters after normalize() (accents stripped,
// lowercase, final ς folded to σ), so Δευ / Δευτέρα / ΔΕΥΤΕΡΑ all resolve.
const DAY_PREFIXES: Record<string, number> = {
  δευ: 0, τρι: 1, τετ: 2, πεμ: 3, παρ: 4, σαβ: 5, κυρ: 6,
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};

// The two-letter abbreviations Greek signage commonly uses («Τρ», «Πα»…) —
// exact matches only, so an unrelated two-letter word can't pass as a day.
const TWO_LETTER_DAYS: Record<string, number> = {
  δε: 0, τρ: 1, τε: 2, πε: 3, πα: 4, σα: 5, κυ: 6,
  mo: 0, tu: 1, we: 2, th: 3, fr: 4, sa: 5, su: 6,
};

// Whole words that stand for several days at once.
const DAY_GROUPS: Record<string, number[]> = {
  καθημερινεσ: [0, 1, 2, 3, 4],
  weekdays: [0, 1, 2, 3, 4],
};

const CLOSED_WORDS = new Set(["κλειστα", "κλειστο", "κλειστοσ", "closed"]);
const RANGE_WORDS = new Set(["εωσ", "μεχρι", "to", "through"]);
const JOIN_WORDS = new Set(["και", "and"]);

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ");
}

function dayIndexes(word: string): number[] | null {
  if (DAY_GROUPS[word]) return DAY_GROUPS[word];
  // Three letters or more: prefix match, so "δευ" and "δευτερα" both count.
  const index = word.length === 2 ? TWO_LETTER_DAYS[word] : word.length >= 3 ? DAY_PREFIXES[word.slice(0, 3)] : undefined;
  return index === undefined ? null : [index];
}

function dayRange(from: number, to: number): number[] {
  const days: number[] = [];
  // Wraps past Sunday, so "Σαβ-Δευ" is Sat, Sun, Mon rather than nonsense.
  for (let d = from; ; d = (d + 1) % 7) {
    days.push(d);
    if (d === to) return days;
  }
}

function toTime(hours: string, minutes: string): string | null {
  const h = Number(hours);
  const m = Number(minutes);
  if (h > 24 || m > 59 || (h === 24 && m !== 0)) return null;
  return `${String(h).padStart(2, "0")}:${minutes}`;
}

type Token =
  | { kind: "days"; days: number[] }
  | { kind: "time"; opens: string; closes: string }
  | { kind: "closed" }
  | { kind: "range" };

function tokenize(input: string): Token[] | null {
  const text = normalize(input);
  const tokens: Token[] = [];
  const pattern = /\s+|[,;:&/|.\n]|(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})|[-–—]|[a-zα-ω]+/gy;
  let position = 0;
  while (position < text.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(text);
    if (!match || match[0].length === 0) return null;
    position = pattern.lastIndex;
    const [raw, h1, m1, h2, m2] = match;
    if (h1 !== undefined) {
      const opens = toTime(h1, m1);
      const closes = toTime(h2, m2);
      // Overnight ranges ("22:00-02:00") would need splitting across two days;
      // no Heraklion shop hours need that, so reject rather than mis-state.
      if (!opens || !closes || closes <= opens) return null;
      tokens.push({ kind: "time", opens, closes });
    } else if (/^[-–—]$/.test(raw)) {
      tokens.push({ kind: "range" });
    } else if (/^[a-zα-ω]+$/.test(raw)) {
      if (CLOSED_WORDS.has(raw)) tokens.push({ kind: "closed" });
      else if (RANGE_WORDS.has(raw)) tokens.push({ kind: "range" });
      else if (JOIN_WORDS.has(raw)) continue;
      else {
        const days = dayIndexes(raw);
        if (!days) return null;
        tokens.push({ kind: "days", days });
      }
    }
    // Anything else matched is a separator (space, comma, colon…): skip it.
  }
  return tokens;
}

export function parseWeeklySchedule(input: string | null | undefined): DaySchedule[] | null {
  if (!input?.trim()) return null;
  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return null;

  const week = new Map<number, DaySchedule>();
  const entry = (day: number) => {
    let e = week.get(day);
    if (!e) week.set(day, (e = { day, ranges: [], closed: false }));
    return e;
  };
  let days: number[] | null = null;
  // False while a group has named days but no hours or «Κλειστά» yet.
  let groupSettled = true;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === "days") {
      const next = tokens[i + 1];
      const after = tokens[i + 2];
      let named = token.days;
      if (next?.kind === "range") {
        if (after?.kind !== "days" || token.days.length !== 1 || after.days.length !== 1) return null;
        named = dayRange(token.days[0], after.days[0]);
        i += 2;
      }
      // A day right after another day with nothing between extends the list
      // ("Δευ, Τετ, Παρ 10:00-13:00"); after hours or «Κλειστά» it starts a
      // new group.
      days = !groupSettled && days ? [...days, ...named] : named;
      groupSettled = false;
    } else if (token.kind === "time") {
      if (!days) return null;
      for (const d of days) {
        const e = entry(d);
        if (e.closed) return null; // both open and closed on the same day
        if (!e.ranges.some((r) => r.opens === token.opens && r.closes === token.closes)) {
          e.ranges.push({ opens: token.opens, closes: token.closes });
        }
      }
      groupSettled = true;
    } else if (token.kind === "closed") {
      // «Κλειστά» must directly follow the days it closes.
      if (!days || groupSettled) return null;
      for (const d of days) {
        const e = entry(d);
        if (e.ranges.length > 0) return null;
        e.closed = true;
      }
      groupSettled = true;
    } else {
      // A range connector that isn't between two single days.
      return null;
    }
  }
  // Days named at the end with no hours ("…, Σάββατο") are ambiguous.
  if (!groupSettled) return null;

  const schedule = [...week.values()].sort((a, b) => a.day - b.day);
  for (const d of schedule) {
    d.ranges.sort((a, b) => a.opens.localeCompare(b.opens));
    // Overlapping shifts ("09:00-15:00 & 14:00-21:00") are a typo, not hours.
    for (let i = 1; i < d.ranges.length; i++) {
      if (d.ranges[i].opens < d.ranges[i - 1].closes) return null;
    }
  }
  return schedule.some((d) => d.ranges.length > 0) ? schedule : null;
}

export function parseOpeningHours(input: string | null | undefined): OpeningHoursSpecification[] | null {
  const schedule = parseWeeklySchedule(input);
  if (!schedule) return null;

  // One specification per distinct time range, listing every day it applies
  // to — the compact form schema.org and Google both read.
  const byRange = new Map<string, number[]>();
  for (const { day, ranges } of schedule) {
    for (const r of ranges) {
      const key = `${r.opens}-${r.closes}`;
      byRange.set(key, [...(byRange.get(key) ?? []), day]);
    }
  }
  return [...byRange.entries()]
    .map(([key, days]) => {
      const [opens, closes] = key.split("-");
      return { days, spec: { "@type": "OpeningHoursSpecification" as const, dayOfWeek: days.map((d) => SCHEMA_DAY_NAMES[d]), opens, closes } };
    })
    .sort((a, b) => a.days[0] - b.days[0] || a.spec.opens.localeCompare(b.spec.opens))
    .map((entry) => entry.spec);
}
