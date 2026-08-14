// Hero slides and editorial/promo blocks. Returns [] both when nothing is
// published and when the read fails — either way the caller renders its own
// default content.
export { getHomepageBlocks } from "@/lib/db/content";
export type { HomepageBlock } from "@/lib/db/content";
