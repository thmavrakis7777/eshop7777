"use server";

import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";
import {
  AADE_REGISTRY_ENDPOINT,
  buildAfmLookupEnvelope,
  parseAfmLookupResponse,
  type AadeCompany,
} from "@/lib/aade-registry";

// Business details for a Τιμολόγιο, looked up by ΑΦΜ in ΑΑΔΕ's own registry
// (lib/aade-registry.ts has the contract). Replaced the ΓΕΜΗ Open Data
// lookup this file used to make: ΓΕΜΗ never had a key (it needs their
// approval) and has no ΔΟΥ field at all, while ΑΑΔΕ is free, self-serve
// with the shop's TAXISnet, and returns Επωνυμία, ΔΟΥ and Δραστηριότητα —
// the same source alexandrisstores.gr's checkout autofills from.
//
// Codes: the shop's "ειδικοί κωδικοί" for this one service, created in
// ΑΑΔΕ's Διαχείριση Ειδικών Κωδικών — not its TAXISnet password. Every
// lookup is recorded by ΑΑΔΕ under the shop's ΑΦΜ; that's how the service
// works, and it exists for exactly this (checking the details an invoice
// will carry). See CHECKOUT_PREMIUM_SPEC.md §4.3.
//
// Same hard rule as the address-autocomplete actions: never throw, always
// degrade to `null` — this is an optional autofill convenience, not
// something that can block filling in the invoice fields by hand.

export type CompanyLookupResult = AadeCompany;

// ΑΑΔΕ usually answers in well under a second; past this the customer is
// better off typing, and a hung registry must not leave "Αναζήτηση…" up.
const LOOKUP_TIMEOUT_MS = 5000;

// Greppable outcomes for production logs, same idea as lib/email/send-core.ts.
// Never includes the ΑΦΜ or the name found (a sole trader's ΑΦΜ and name are
// personal data), nor the codes.
function logLookupFailure(detail: Record<string, string | number>): void {
  console.error(`[aade] AADE_LOOKUP_FAILED ${JSON.stringify(detail)}`);
}

export async function lookupCompanyByAfm(afm: string): Promise<CompanyLookupResult | null> {
  // Trimmed: a space or line break picked up when pasting into Vercel makes
  // ΑΑΔΕ reject the codes (…_NOT_AUTHENTICATED) with nothing visibly wrong.
  // Neither code can legitimately start or end with whitespace.
  const username = process.env.AADE_RG_USERNAME?.trim();
  const password = process.env.AADE_RG_PASSWORD?.trim();
  const digits = afm.trim();
  // The checkout only calls this once isValidAFM passes, but this is a
  // public endpoint — re-check the shape before it goes into a request.
  if (!username || !password || !/^\d{9}$/.test(digits)) return null;

  // An unauthenticated Server Action that queries a government registry
  // under the shop's own ΑΦΜ — without a limit, a scripted loop could use
  // it to scrape the registry in the shop's name.
  if (!(await checkRateLimit(await rateLimitKey("aade-lookup"), 20, 300))) return null;

  try {
    const res = await fetch(AADE_REGISTRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/soap+xml;charset=UTF-8" },
      body: buildAfmLookupEnvelope(username, password, digits),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      logLookupFailure({ status: res.status });
      return null;
    }

    const outcome = parseAfmLookupResponse(await res.text());
    if (!outcome.ok) {
      // ΑΑΔΕ's own code (e.g. RG_WS_PUBLIC_TOKEN_USERNAME_NOT_DEFINED when
      // no codes reach it), so it can be looked up in their FAQ: codes
      // wrong or missing in Vercel, an ΑΦΜ that isn't a business, etc.
      logLookupFailure({ errorCode: outcome.errorCode });
      return null;
    }
    return outcome.company;
  } catch (err) {
    logLookupFailure({ error: err instanceof Error ? err.name : "unknown" });
    return null;
  }
}
