import "server-only";
import type { SeoField, SeoGenerationResult } from "@/lib/ai/provider";

/**
 * Deterministic checks on generated content — never trust the model's own
 * judgment alone (explicit requirement). Factual accuracy (no invented
 * material/dimensions/etc) is NOT checked here — there is no reliable way
 * to verify that algorithmically; the real control is the prompt only ever
 * mentioning facts that exist in the DB (gemini-provider.ts's
 * buildUserPrompt), with the admin's own review as the backstop.
 */

const PLACEHOLDER_RE = /\.\.\.|\btodo\b|\[[a-z ]+\]/i;
const GREEK_RE = /\p{Script=Greek}/u;
const HTML_RE = /[<>]/;
const SLUG_RE = /^[a-z0-9-]+$/;

export type ValidationResult = { ok: true } | { ok: false; error: string };

function checkTextField(field: SeoField, value: string, requireGreek: boolean): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, error: `Το πεδίο ${field} επέστρεψε κενό.` };
  if (PLACEHOLDER_RE.test(trimmed)) {
    return { ok: false, error: `Το πεδίο ${field} μοιάζει να περιέχει placeholder κείμενο.` };
  }
  if (HTML_RE.test(trimmed)) {
    return { ok: false, error: `Το πεδίο ${field} περιέχει μη επιτρεπτούς χαρακτήρες (< ή >).` };
  }
  if (requireGreek && !GREEK_RE.test(trimmed)) {
    return { ok: false, error: `Το πεδίο ${field} δεν φαίνεται να είναι στα ελληνικά.` };
  }
  return { ok: true };
}

/** No single significant (4+ letter) word repeated more than ~4x per 100 words. */
function checkKeywordStuffing(text: string): ValidationResult {
  const words = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents so folded repeats still count
    .match(/\p{L}{4,}/gu);
  if (!words || words.length < 8) return { ok: true };

  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);

  const maxAllowed = Math.max(2, Math.ceil((words.length / 100) * 4));
  for (const [word, count] of counts) {
    if (count > maxAllowed) {
      return { ok: false, error: `Πιθανό keyword stuffing: η λέξη «${word}» επαναλαμβάνεται ${count} φορές.` };
    }
  }
  return { ok: true };
}

export function validateField(field: SeoField, value: string): ValidationResult {
  if (field === "slug") {
    const trimmed = value.trim();
    if (!trimmed) return { ok: false, error: "Το slug είναι κενό." };
    if (!SLUG_RE.test(trimmed)) {
      return { ok: false, error: "Το slug επιτρέπει μόνο πεζά λατινικά, αριθμούς και παύλες." };
    }
    return { ok: true };
  }

  // imageAlt and h1 are short, factual labels — Greek-required but not
  // checked for keyword stuffing (a 3-5 word alt text repeating the
  // product name isn't stuffing, it's the point).
  const requireGreek = true;
  const base = checkTextField(field, value, requireGreek);
  if (!base.ok) return base;

  if (field === "description") return checkKeywordStuffing(value);
  return { ok: true };
}

export function validateGeneratedContent(
  result: Partial<SeoGenerationResult>,
  fields: SeoField[]
): ValidationResult {
  for (const field of fields) {
    const value = result[field];
    if (value == null) return { ok: false, error: `Λείπει το πεδίο ${field}.` };
    const check = validateField(field, value);
    if (!check.ok) return check;
  }
  return { ok: true };
}
