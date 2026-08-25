import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getMetaFeedRows } from "@/lib/db/meta-feed";

/**
 * Public, Meta-compatible product catalog feed (CSV) for Meta Commerce
 * Manager's "Data feed" scheduled-fetch import. This is what feeds Facebook/
 * Instagram/Meta Ads catalog features — see MIGRATION_PLAN.md /
 * PROJECT_MEMORY.md for the fuller "what's implemented vs what needs Meta
 * Commerce Manager configuration" writeup.
 *
 * URL: /api/meta/product-feed?token=<META_FEED_TOKEN>
 *
 * Gated by a shared-secret query token rather than left fully open — the
 * data itself is the same public catalog already visible on the storefront,
 * but a token is a trivial, zero-maintenance way to keep it from being
 * casually bulk-scraped by anyone who stumbles on the URL. Meta's own feed
 * scheduler supports a URL with query parameters, so this needs no special
 * accommodation on their end — paste the full URL, token included, into
 * Commerce Manager once.
 *
 * Performance: the actual catalog query is wrapped in `unstable_cache`
 * (lib/db/meta-feed.ts, 5-minute window, same cache tag product saves/
 * deletes already invalidate for search) — this route does not run a fresh
 * database query on every request.
 */

const CSV_HEADER = [
  "id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "item_group_id",
  "product_type",
] as const;

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.META_FEED_TOKEN;
  const provided = request.nextUrl.searchParams.get("token");

  // Misconfiguration (no token set) must fail closed, not fail open into an
  // unauthenticated public feed.
  if (!expected) {
    return NextResponse.json({ error: "Feed not configured." }, { status: 503 });
  }
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided ?? "");
  const authorized =
    providedBuf.length === expectedBuf.length && crypto.timingSafeEqual(providedBuf, expectedBuf);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rows = await getMetaFeedRows();

  const lines = [
    CSV_HEADER.join(","),
    ...rows.map((r) =>
      [
        r.id,
        r.title,
        r.description,
        r.availability,
        r.condition,
        eur(r.priceCents),
        r.salePriceCents != null ? eur(r.salePriceCents) : "",
        r.link,
        r.imageLink ?? "",
        r.additionalImageLinks.join(","),
        r.brand,
        r.itemGroupId ?? "",
        r.productType ?? "",
      ]
        .map((v) => csvField(String(v)))
        .join(",")
    ),
  ];

  return new NextResponse(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Meta re-fetches on its own schedule; this just stops a browser or
      // intermediate proxy from serving a stale copy past the feed's own
      // 5-minute cache window.
      "Cache-Control": "public, max-age=300",
    },
  });
}
