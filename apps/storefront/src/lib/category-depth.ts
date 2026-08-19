/**
 * Deepest allowed category nesting, zero-indexed: main (0) → sub (1) →
 * sub-sub (2).
 *
 * Its own module because both sides need it and they cannot share one: the
 * server enforces it in lib/admin/taxonomy.ts (which is `server-only`), and
 * the admin form uses it to stop offering a parent the server would reject.
 * One constant, so the form and the rule can never disagree.
 *
 * The schema has no such limit — the storefront's three URL segments do. A
 * fourth level would be creatable and then unreachable.
 */
export const MAX_CATEGORY_DEPTH = 2;
