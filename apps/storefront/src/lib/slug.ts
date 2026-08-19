/**
 * Greek-aware slugification, safe to import from a Client Component.
 *
 * The server has its own `slugify` in lib/admin/products.ts, built on the
 * search layer's `normalizeSearchText` — which is server-only, so a form that
 * wants to show the slug as the owner types cannot use it. This is the
 * browser-side twin: same transliteration table, same output, no server
 * imports. It lived inline in NewProductForm before the Journal needed the
 * identical thing in two more places; one copy is better than three.
 *
 * Server code should keep calling lib/admin/products.ts's `slugify` — that
 * one is the authority, and every action re-derives the slug there anyway if
 * the form sends an empty one, so a divergence could never produce a slug the
 * database did not agree to.
 */
const GREEK_TO_LATIN: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i",
  κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p", ρ: "r", σ: "s",
  ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

export function slugFromGreek(input: string): string {
  return input
    // Strip accents first (ά → α), so the table below only needs base letters.
    .normalize("NFD")
    // Escaped rather than written literally: a combining-mark range typed as
    // raw characters is invisible in a diff and easy to mangle on re-save.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split("")
    .map((c) => GREEK_TO_LATIN[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
