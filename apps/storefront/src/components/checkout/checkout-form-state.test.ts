import { describe, expect, it } from "vitest";
import { applyRegistryFill, type InvoiceFormFields } from "@/components/checkout/checkout-form-state";

const fieldsFor = (afm: string, rest: Partial<InvoiceFormFields> = {}): InvoiceFormFields => ({
  companyName: "",
  doy: "",
  activity: "",
  afm,
  ...rest,
});

const COMPANY_A = { companyName: "Α ΕΠΕ", doy: "Α' ΗΡΑΚΛΕΙΟΥ", activity: "ΛΙΑΝΙΚΟ ΕΜΠΟΡΙΟ" };
const COMPANY_B = { companyName: "Β ΟΕ", doy: "ΧΑΝΙΩΝ", activity: "ΧΟΝΔΡΙΚΟ ΕΜΠΟΡΙΟ" };

describe("applyRegistryFill", () => {
  it("fills empty fields on a first lookup", () => {
    expect(applyRegistryFill(fieldsFor("1"), null, COMPANY_A)).toEqual({ afm: "1", ...COMPANY_A });
  });

  it("swaps the previous ΑΦΜ's details for the corrected one's", () => {
    // The case the old "fill only empty fields" rule got wrong: a mistyped
    // ΑΦΜ filled company A, and correcting it left A's details in place.
    const afterA = fieldsFor("2", COMPANY_A);
    expect(applyRegistryFill(afterA, COMPANY_A, COMPANY_B)).toEqual({ afm: "2", ...COMPANY_B });
  });

  it("never overwrites what the customer typed or edited", () => {
    const edited = fieldsFor("2", { ...COMPANY_A, companyName: "Α ΕΠΕ (κατάστημα)" });
    expect(applyRegistryFill(edited, COMPANY_A, COMPANY_B)).toEqual({
      afm: "2",
      companyName: "Α ΕΠΕ (κατάστημα)",
      doy: COMPANY_B.doy,
      activity: COMPANY_B.activity,
    });

    const typedBeforeLookup = fieldsFor("1", { doy: "ΔΟΥ ΠΟΥ ΕΓΡΑΨΑ" });
    expect(applyRegistryFill(typedBeforeLookup, null, COMPANY_A).doy).toBe("ΔΟΥ ΠΟΥ ΕΓΡΑΨΑ");
  });

  it("clears the previous ΑΦΜ's details when the new one finds nothing", () => {
    const afterA = fieldsFor("2", { ...COMPANY_A, activity: "ΓΡΑΜΜΕΝΟ" });
    expect(applyRegistryFill(afterA, COMPANY_A, null)).toEqual({
      afm: "2",
      companyName: "",
      doy: "",
      activity: "ΓΡΑΜΜΕΝΟ",
    });
  });
});
