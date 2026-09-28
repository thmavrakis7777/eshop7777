import { NextRequest, NextResponse } from "next/server";
import { searchProducts } from "@/lib/data/products";

/**
 * The header search box's live suggestions: GET /api/search?q=…
 *
 * Was a server action (searchProductsPreviewAction) until SPD-10
 * (SEARCH_SUGGEST_SPEC.md). Next dispatches server actions one at a time
 * per visitor, so a suggestion could wait behind an Add to Cart still in
 * flight, and a superseded one couldn't be cancelled. A plain GET has
 * neither problem, and /api/* also skips the proxy (src/proxy.ts matcher).
 *
 * Same searchProducts as the /anazitisi page, so the same ranking,
 * synonyms and boost/hide rules — only the first six results.
 *
 * `no-store`, deliberately: nothing is cached beyond the 60 s search
 * catalogue searchProducts already reads, which every dashboard product
 * save refreshes at once (updateTag(SEARCH_CACHE_TAG)). A CDN cache here
 * would let suggestions show an old price or stock level for up to its TTL
 * after an edit; the owner chose live suggestions over that (spec §6).
 */

const PREVIEW_LIMIT = 6;
// Far longer than any real product name or code; bounds the work a
// hand-built request can ask the fuzzy matcher to do.
const MAX_QUERY_LENGTH = 100;

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const { products } = await searchProducts(query, { limit: PREVIEW_LIMIT });
  return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
}
