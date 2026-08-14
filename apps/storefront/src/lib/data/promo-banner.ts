// Marketing copy promoting a real discount — not a discount engine. The
// publish/expiry gate now lives in the query (lib/db/content.ts) instead of
// in a Medusa route handler.
export { getPromoBanner } from "@/lib/db/content";
export type { PromoBanner } from "@/lib/db/content";
