// Shared JSON-LD serialization for every <script type="application/ld+json">
// in the app. Escaping "<" as its unicode form is the standard hardening
// step for JSON embedded in a <script> tag: without it, a value containing
// "</script>" would close the tag early and let whatever follows execute as
// live HTML/JS. Most JSON-LD here is built entirely from our own constants,
// but productJsonLd (proionta/[handle]/page.tsx) merges in an admin-authored
// structuredDataOverride blob, so treat every call site as if it might carry
// untrusted content rather than special-casing the one that does today.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
