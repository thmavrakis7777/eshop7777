// The SEO + GEO button's own deterministic checks
// (apps/storefront/src/lib/ai/validate-seo-content.ts), plus the length
// limits its prompt asks for, run on a hand-written draft.
//
// Usage: node check.mjs draft.json
// draft.json: { "h1", "seoTitle", "metaDescription", "description", "slug", "imageAlt" }
import { readFileSync } from "node:fs";

const draft = JSON.parse(readFileSync(process.argv[2], "utf8"));
const FIELDS = ["h1", "seoTitle", "metaDescription", "description", "slug", "imageAlt"];
const LIMITS = { seoTitle: 60, metaDescription: 155 };
const problems = [];

for (const field of FIELDS) {
  const value = (draft[field] ?? "").trim();
  const limit = LIMITS[field] ? `/${LIMITS[field]}` : "";
  console.log(`${field.padEnd(16)} ${String(value.length).padStart(3)}${limit} chars`);
  if (!value) problems.push(`${field}: empty`);
  if (LIMITS[field] && value.length > LIMITS[field]) problems.push(`${field}: over ${LIMITS[field]} chars`);
  if (field === "slug") {
    if (!/^[a-z0-9-]+$/.test(value)) problems.push("slug: only a-z, 0-9 and hyphens allowed");
    continue;
  }
  if (/\.\.\.|\btodo\b|\[[a-z ]+\]/i.test(value)) problems.push(`${field}: looks like placeholder text`);
  if (/[<>]/.test(value)) problems.push(`${field}: contains < or >`);
  if (!/\p{Script=Greek}/u.test(value)) problems.push(`${field}: not Greek`);
}

if (!draft.seoTitle?.includes("MAVRAKIS HOME")) problems.push("seoTitle: missing «| MAVRAKIS HOME»");

// Keyword stuffing: no 4+ letter word more than max(2, 4 per 100 words) times.
const words = (draft.description ?? "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .match(/\p{L}{4,}/gu) ?? [];
if (words.length >= 8) {
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const maxAllowed = Math.max(2, Math.ceil((words.length / 100) * 4));
  for (const [word, count] of counts) {
    if (count > maxAllowed) problems.push(`description: «${word}» ×${count} (max ${maxAllowed})`);
  }
}

const sentences = (draft.description ?? "").split(/[.!;]\s/).filter((s) => s.trim()).length;
console.log(`description      ${sentences} sentences, ${(draft.description ?? "").split(/\s+/).length} words`);

if (problems.length) {
  console.log("\nFAIL\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log("\nOK — passes the button's checks");
