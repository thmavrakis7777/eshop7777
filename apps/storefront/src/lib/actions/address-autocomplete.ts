"use server";

import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";

// Google Places API (New), called server-side only — the API key
// (GOOGLE_PLACES_API_KEY) never reaches the browser, unlike the typical
// client-side Places widget setup. Both actions degrade to an empty/null
// result rather than throwing whenever the key is unset or the call fails,
// so manual address entry is never blocked (CHECKOUT_PREMIUM_SPEC.md §2's
// hard requirement) — a broken/missing integration must look identical to
// "no suggestions right now," never a checkout error.
//
// Request/response shapes verified against Google's own Places API (New)
// documentation (developers.google.com/maps/documentation/places/web-service),
// not assumed — this has NOT been exercised against a real API key/live
// Google endpoint yet (see PROJECT_MEMORY.md), so treat the shapes as
// doc-verified but not live-verified until a real key is configured and
// this is actually clicked through.

const PLACES_BASE = "https://places.googleapis.com/v1/places";

export type AddressSuggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

export async function getAddressSuggestions(input: string, sessionToken: string): Promise<AddressSuggestion[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || input.trim().length < 3) return [];

  // Every call is billable against a real Google Places quota — this is an
  // unauthenticated Server Action, so without a limit a scripted loop could
  // burn through the quota for free. Generous limit: normal typing triggers
  // several calls per address.
  if (!(await checkRateLimit(await rateLimitKey("places-autocomplete"), 40, 60))) return [];

  try {
    const res = await fetch(`${PLACES_BASE}:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input,
        includedRegionCodes: ["gr"],
        sessionToken,
      }),
    });
    if (!res.ok) return [];

    const data: {
      suggestions?: Array<{
        placePrediction?: {
          placeId: string;
          structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
        };
      }>;
    } = await res.json();

    return (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        placeId: p.placeId,
        mainText: p.structuredFormat?.mainText?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      }));
  } catch {
    return [];
  }
}

export type ParsedAddressDetails = {
  street: string;
  number: string;
  city: string;
  postalCode: string;
};

// Address components come back as a flat array of {longText, types[]} —
// Google's own documented type vocabulary ("route", "street_number",
// "locality", "postal_town", "postal_code") is matched by type, not by
// array position, since not every address includes every component.
function parseAddressComponents(
  components: Array<{ longText?: string; types?: string[] }>
): ParsedAddressDetails {
  const byType = (type: string) => components.find((c) => c.types?.includes(type))?.longText ?? "";
  return {
    street: byType("route"),
    number: byType("street_number"),
    // Greek addresses sometimes carry the town under "postal_town" rather
    // than "locality" — fall back rather than leaving the city blank.
    city: byType("locality") || byType("postal_town"),
    postalCode: byType("postal_code"),
  };
}

export async function getPlaceDetails(placeId: string, sessionToken: string): Promise<ParsedAddressDetails | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !placeId) return null;

  if (!(await checkRateLimit(await rateLimitKey("places-details"), 20, 60))) return null;

  try {
    const res = await fetch(
      `${PLACES_BASE}/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "addressComponents",
        },
      }
    );
    if (!res.ok) return null;

    const data: { addressComponents?: Array<{ longText?: string; types?: string[] }> } = await res.json();
    if (!data.addressComponents) return null;

    return parseAddressComponents(data.addressComponents);
  } catch {
    return null;
  }
}
