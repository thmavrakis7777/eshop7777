"use server";

import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";

// ΓΕΜΗ Open Data API (opendata-api.businessportal.gr) — looks up a company's
// registered details by ΑΦΜ. Request/response shapes verified live against
// the real Swagger 2.0 spec served at
// https://opendata-api.businessportal.gr/api-docs this session (Swagger UI's
// own "api-docs-key" only authorizes viewing the docs, not real calls — an
// actual, approved GEMI_API_KEY is required, see CHECKOUT_PREMIUM_SPEC.md
// §4.3 for why this needs a registration/approval step, unlike Google's
// instant self-serve key).
//
// Same hard rule as the address-autocomplete actions: never throw, always
// degrade to `null` — this is an optional autofill convenience, not
// something that can block filling in the invoice fields by hand.

const GEMI_BASE = "https://opendata-api.businessportal.gr/api/opendata/v1";

export type CompanyLookupResult = {
  companyName: string;
  activity?: string;
};

type GemiCompany = {
  coNameEl?: string;
  activities?: Array<{ activity?: { descr?: string } }>;
};

type GemiSearchResponse = {
  searchResults?: GemiCompany[];
};

export async function lookupCompanyByAfm(afm: string): Promise<CompanyLookupResult | null> {
  const apiKey = process.env.GEMI_API_KEY;
  // ΓΕΜΗ requires the ΑΦΜ zero-padded to exactly 9 digits (documented in
  // the API's own parameter description) — checksum validation already
  // guarantees this input is a 9-digit string, but pad defensively anyway.
  const paddedAfm = afm.trim().padStart(9, "0");
  if (!apiKey || paddedAfm.length !== 9) return null;

  // Every call is billable/quota'd against a real ΓΕΜΗ account — this is an
  // unauthenticated Server Action, so without a limit a scripted loop could
  // burn through the quota for free.
  if (!(await checkRateLimit(await rateLimitKey("gemi-lookup"), 20, 300))) return null;

  try {
    const res = await fetch(`${GEMI_BASE}/companies?afm=${paddedAfm}`, {
      headers: { api_key: apiKey },
    });
    if (!res.ok) return null;

    const data: GemiSearchResponse = await res.json();
    const company = data.searchResults?.[0];
    if (!company?.coNameEl) return null;

    return {
      companyName: company.coNameEl,
      activity: company.activities?.[0]?.activity?.descr,
    };
  } catch {
    return null;
  }
}
