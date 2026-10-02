// ΑΑΔΕ "Αναζήτηση Βασικών Στοιχείων Μητρώου Επιχειρήσεων" (RgWsPublic2) —
// the official tax registry lookup by ΑΦΜ. Pure request-building and
// reply-reading only, so it can be unit-tested without the network or the
// shop's codes; the call itself lives in lib/actions/afm-lookup.ts.
//
// Contract read from ΑΑΔΕ's own live service definition (2026-10-02):
// https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2?WSDL and its ?xsd=1.
// SOAP 1.2, document/literal, WS-Security UsernameToken carrying the shop's
// "ειδικοί κωδικοί" (not its TAXISnet login). Errors do NOT come back as a
// SOAP fault or an HTTP error: the reply is a normal HTTP 200 with
// `error_rec/error_code` filled in (seen live — a request without codes
// returned RG_WS_PUBLIC_TOKEN_USERNAME_NOT_DEFINED that way), and every
// field the registry has no value for is a self-closing `xsi:nil` element.

export const AADE_REGISTRY_ENDPOINT = "https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2";

export type AadeCompany = {
  // `onomasia` — the legal name an invoice must carry. For a sole trader
  // that's "ΕΠΩΝΥΜΟ ΟΝΟΜΑ ΠΑΤΡΩΝΥΜΟ"; the διακριτικός τίτλος
  // (`commer_title`) is a trading name and doesn't belong on an invoice.
  companyName: string;
  doy: string;
  // The activity ΑΑΔΕ marks as κύρια; undefined if none is registered.
  activity?: string;
  // The registry says this ΑΦΜ has stopped trading or been deactivated.
  inactive: boolean;
};

export type AadeLookupOutcome = { ok: true; company: AadeCompany } | { ok: false; errorCode: string };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// `afm_called_by` stays empty: it's only for an accountant looking someone
// up on behalf of a third ΑΦΜ. `as_on_date` is left out, which means today.
export function buildAfmLookupEnvelope(username: string, password: string, afm: string): string {
  return (
    `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope"` +
    ` xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"` +
    ` xmlns:srvc="http://rgwspublic2/RgWsPublic2Service" xmlns:rg="http://rgwspublic2/RgWsPublic2">` +
    `<env:Header><wsse:Security><wsse:UsernameToken>` +
    `<wsse:Username>${escapeXml(username)}</wsse:Username>` +
    `<wsse:Password>${escapeXml(password)}</wsse:Password>` +
    `</wsse:UsernameToken></wsse:Security></env:Header>` +
    `<env:Body><srvc:rgWsPublic2AfmMethod><srvc:INPUT_REC>` +
    `<rg:afm_called_by/><rg:afm_called_for>${escapeXml(afm)}</rg:afm_called_for>` +
    `</srvc:INPUT_REC></srvc:rgWsPublic2AfmMethod></env:Body></env:Envelope>`
  );
}

// Text content of every `<name>…</name>` in `xml`, prefix or not (the reply
// uses a default namespace today, but a prefixed one is equally valid XML).
// The `(?<!/)` keeps a self-closing nil element from matching and swallowing
// everything up to the next element of the same name.
function elements(xml: string, name: string): string[] {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?(?<!/)>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, "g");
  return Array.from(xml.matchAll(pattern), (m) => m[1]);
}

function text(xml: string, name: string): string {
  // Registry values arrive in upper case with the odd doubled space
  // ("ΕΠΩΝΥΜΟ  ΟΝΟΜΑ") — collapsed, otherwise left exactly as registered.
  return decodeXml(elements(xml, name)[0] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAfmLookupResponse(xml: string): AadeLookupOutcome {
  const errorCode = text(elements(xml, "error_rec")[0] ?? "", "error_code");
  if (errorCode) return { ok: false, errorCode };

  const basic = elements(xml, "basic_rec")[0];
  const companyName = basic ? text(basic, "onomasia") : "";
  // No error and no name is not a lookup we can use — e.g. a reply cut off
  // mid-way, or a shape this parser doesn't recognise.
  if (!basic || !companyName) return { ok: false, errorCode: "UNREADABLE_RESPONSE" };

  const activities = elements(elements(xml, "firm_act_tab")[0] ?? "", "item").map((item) => ({
    kind: text(item, "firm_act_kind"),
    descr: text(item, "firm_act_descr"),
  }));
  // firm_act_kind "1" is the κύρια activity; an invoice names that one.
  // Falls back to the first listed if none is marked κύρια.
  const activity = (activities.find((a) => a.kind === "1") ?? activities[0])?.descr || undefined;

  // deactivation_flag "1" is ΕΝΕΡΓΟΣ ΑΦΜ; any other value is read as
  // deactivated rather than relying on the exact code ΑΑΔΕ uses for that.
  // A stop_date means the business has ceased trading (διακοπή) even while
  // the ΑΦΜ itself stays active.
  const deactivationFlag = text(basic, "deactivation_flag");

  return {
    ok: true,
    company: {
      companyName,
      doy: text(basic, "doy_descr"),
      activity,
      inactive: (deactivationFlag !== "" && deactivationFlag !== "1") || text(basic, "stop_date") !== "",
    },
  };
}
