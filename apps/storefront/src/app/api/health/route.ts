import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";

/**
 * Minimal liveness/readiness check for deployment automation — confirms the
 * app can actually reach its one real dependency (Postgres), not just that
 * the homepage renders. Reuses the same `sql` client every Server
 * Component/Action already uses; this never opens a second connection.
 *
 * `SELECT 1` is a real round trip to the database (proves the connection
 * string, network path, and pooler are all working) without touching a
 * single table — the cheapest possible connectivity check.
 *
 * No route segment config needed to keep this out of the static build: an
 * API Route Handler with no cached data source is dynamic by default.
 */
export async function GET() {
  try {
    await sql`SELECT 1`;
    return NextResponse.json(
      { status: "ok" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // Never leak the connection string, query, or stack trace — this
    // endpoint is reachable by anyone who requests it.
    return NextResponse.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
