import { describe, expect, it } from "vitest";
import { buildAfmLookupEnvelope, parseAfmLookupResponse } from "@/lib/aade-registry";

// Captured verbatim from the live service (2026-10-02) for a request sent
// without codes — the shape every error comes back in: HTTP 200, error_rec
// filled, every other field a self-closing xsi:nil element.
const LIVE_ERROR_REPLY = `<?xml version='1.0' encoding='UTF-8'?><env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><env:Header/><env:Body><srvc:rgWsPublic2AfmMethodResponse xmlns="http://rgwspublic2/RgWsPublic2" xmlns:srvc="http://rgwspublic2/RgWsPublic2Service"><srvc:result><rg_ws_public2_result_rtType><call_seq_id>986346797</call_seq_id><error_rec><error_code>RG_WS_PUBLIC_TOKEN_USERNAME_NOT_DEFINED</error_code><error_descr>Δεν ορίσθηκε ο χρήστης που καλεί την υπηρεσία.</error_descr></error_rec><afm_called_by_rec><token_username xsi:nil="true"/><token_afm xsi:nil="true"/><token_afm_fullname xsi:nil="true"/><afm_called_by xsi:nil="true"/><afm_called_by_fullname xsi:nil="true"/><as_on_date>2026-10-02</as_on_date></afm_called_by_rec><basic_rec><afm xsi:nil="true"/><doy xsi:nil="true"/><doy_descr xsi:nil="true"/><i_ni_flag_descr xsi:nil="true"/><deactivation_flag xsi:nil="true"/><deactivation_flag_descr xsi:nil="true"/><firm_flag_descr xsi:nil="true"/><onomasia xsi:nil="true"/><commer_title xsi:nil="true"/><legal_status_descr xsi:nil="true"/><postal_address xsi:nil="true"/><postal_address_no xsi:nil="true"/><postal_zip_code xsi:nil="true"/><postal_area_description xsi:nil="true"/><regist_date xsi:nil="true"/><stop_date xsi:nil="true"/><normal_vat_system_flag xsi:nil="true"/></basic_rec></rg_ws_public2_result_rtType></srvc:result></srvc:rgWsPublic2AfmMethodResponse></env:Body></env:Envelope>`;

// A success reply in the same envelope, with the fields named exactly as
// ΑΑΔΕ's schema (?xsd=1) defines them. Made-up business, not a real ΑΦΜ.
function successReply({
  basic = "",
  activities = "",
}: {
  basic?: string;
  activities?: string;
}): string {
  return `<env:Envelope xmlns:env="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><env:Body><srvc:rgWsPublic2AfmMethodResponse xmlns="http://rgwspublic2/RgWsPublic2" xmlns:srvc="http://rgwspublic2/RgWsPublic2Service"><srvc:result><rg_ws_public2_result_rtType><call_seq_id>1</call_seq_id><error_rec><error_code xsi:nil="true"/><error_descr xsi:nil="true"/></error_rec><afm_called_by_rec><afm_called_by xsi:nil="true"/></afm_called_by_rec><basic_rec><afm>000000000</afm><doy>1111</doy><doy_descr>Α' ΗΡΑΚΛΕΙΟΥ</doy_descr>${basic}</basic_rec><firm_act_tab>${activities}</firm_act_tab></rg_ws_public2_result_rtType></srvc:result></srvc:rgWsPublic2AfmMethodResponse></env:Body></env:Envelope>`;
}

const activityItem = (kind: string, descr: string) =>
  `<item><firm_act_code>1</firm_act_code><firm_act_descr>${descr}</firm_act_descr><firm_act_kind>${kind}</firm_act_kind><firm_act_kind_descr>-</firm_act_kind_descr></item>`;

describe("parseAfmLookupResponse", () => {
  it("returns ΑΑΔΕ's own error code from the live error reply", () => {
    expect(parseAfmLookupResponse(LIVE_ERROR_REPLY)).toEqual({
      ok: false,
      errorCode: "RG_WS_PUBLIC_TOKEN_USERNAME_NOT_DEFINED",
    });
  });

  it("reads name, ΔΟΥ and the κύρια activity, not just the first listed", () => {
    const xml = successReply({
      basic: `<deactivation_flag>1</deactivation_flag><onomasia>ΠΑΠΑΔΟΠΟΥΛΟΣ  ΓΕΩΡΓΙΟΣ ΙΩΑΝΝΗΣ</onomasia><stop_date xsi:nil="true"/>`,
      activities: activityItem("2", "ΔΕΥΤΕΡΕΥΟΥΣΑ") + activityItem("1", "ΛΙΑΝΙΚΟ ΕΜΠΟΡΙΟ ΕΙΔΩΝ ΣΠΙΤΙΟΥ"),
    });
    expect(parseAfmLookupResponse(xml)).toEqual({
      ok: true,
      company: {
        // The doubled space the registry sometimes has is collapsed.
        companyName: "ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ ΙΩΑΝΝΗΣ",
        doy: "Α' ΗΡΑΚΛΕΙΟΥ",
        activity: "ΛΙΑΝΙΚΟ ΕΜΠΟΡΙΟ ΕΙΔΩΝ ΣΠΙΤΙΟΥ",
        inactive: false,
      },
    });
  });

  it("falls back to the first activity, and to none, without failing", () => {
    const one = successReply({ basic: "<onomasia>Α ΕΠΕ</onomasia>", activities: activityItem("2", "ΠΡΩΤΗ") });
    expect(parseAfmLookupResponse(one)).toMatchObject({ ok: true, company: { activity: "ΠΡΩΤΗ" } });

    const none = successReply({ basic: "<onomasia>Α ΕΠΕ</onomasia>" });
    expect(parseAfmLookupResponse(none)).toMatchObject({ ok: true, company: { activity: undefined } });
  });

  it("decodes XML entities in names", () => {
    const xml = successReply({ basic: "<onomasia>Α &amp; Β Ο.Ε.</onomasia>" });
    expect(parseAfmLookupResponse(xml)).toMatchObject({ ok: true, company: { companyName: "Α & Β Ο.Ε." } });
  });

  it("flags a deactivated ΑΦΜ or a business that has stopped trading", () => {
    const deactivated = successReply({ basic: "<deactivation_flag>2</deactivation_flag><onomasia>Α ΕΠΕ</onomasia>" });
    expect(parseAfmLookupResponse(deactivated)).toMatchObject({ ok: true, company: { inactive: true } });

    const stopped = successReply({
      basic: "<deactivation_flag>1</deactivation_flag><onomasia>Α ΕΠΕ</onomasia><stop_date>2024-12-31</stop_date>",
    });
    expect(parseAfmLookupResponse(stopped)).toMatchObject({ ok: true, company: { inactive: true } });
  });

  it("treats a reply with no error and no name as unusable, not as a company", () => {
    expect(parseAfmLookupResponse(successReply({ basic: `<onomasia xsi:nil="true"/>` }))).toEqual({
      ok: false,
      errorCode: "UNREADABLE_RESPONSE",
    });
    expect(parseAfmLookupResponse("<html>502 Bad Gateway</html>")).toEqual({
      ok: false,
      errorCode: "UNREADABLE_RESPONSE",
    });
  });

  it("reads prefixed elements as well as default-namespace ones", () => {
    const xml = `<a:basic_rec><a:onomasia>Α ΕΠΕ</a:onomasia><a:doy_descr>ΧΑΝΙΩΝ</a:doy_descr></a:basic_rec>`;
    expect(parseAfmLookupResponse(xml)).toMatchObject({ ok: true, company: { companyName: "Α ΕΠΕ", doy: "ΧΑΝΙΩΝ" } });
  });
});

describe("buildAfmLookupEnvelope", () => {
  it("escapes the codes so a symbol in the password can't break the request", () => {
    const xml = buildAfmLookupEnvelope("USER1", `p<&>"'1`, "123456789");
    expect(xml).toContain("<wsse:Password>p&lt;&amp;&gt;&quot;&apos;1</wsse:Password>");
    expect(xml).toContain("<rg:afm_called_for>123456789</rg:afm_called_for>");
  });
});
