"use client";

import { SectionHeading } from "@/components/checkout/SectionHeading";
import { FormField } from "@/components/checkout/FormField";
import type { ContactAddressErrors, ContactAddressFields } from "@/components/checkout/checkout-form-state";

// Οδός/Αριθμός shown as two fields (matches how Greek addresses are
// conventionally written and how couriers expect them) even though Medusa
// only has one `address_1` string — the two get combined when saving
// (lib/actions/checkout.ts). Χώρα is locked to Ελλάδα, not a dropdown of
// the region's 8 countries — those are a leftover from Medusa's demo seed,
// not a real serviceable market list (CHECKOUT_UX_SPEC.md §6).
export function AddressSection({
  values,
  errors,
  onFieldChange,
  onFieldBlur,
  saving,
}: {
  values: ContactAddressFields;
  errors: ContactAddressErrors;
  onFieldChange: (field: keyof ContactAddressFields, value: string) => void;
  onFieldBlur: (field: keyof ContactAddressFields) => void;
  saving?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={3} title="Διεύθυνση παράδοσης" saving={saving} />
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <FormField
          id="checkout-street"
          label="Οδός"
          autoComplete="address-line1"
          value={values.street}
          onChange={(v) => onFieldChange("street", v)}
          onBlur={() => onFieldBlur("street")}
          error={errors.street}
        />
        <FormField
          id="checkout-number"
          label="Αριθμός"
          value={values.number}
          onChange={(v) => onFieldChange("number", v)}
          onBlur={() => onFieldBlur("number")}
          error={errors.number}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          id="checkout-postal-code"
          label="ΤΚ"
          inputMode="numeric"
          autoComplete="postal-code"
          value={values.postalCode}
          onChange={(v) => onFieldChange("postalCode", v)}
          onBlur={() => onFieldBlur("postalCode")}
          error={errors.postalCode}
        />
        <FormField
          id="checkout-city"
          label="Πόλη"
          autoComplete="address-level2"
          value={values.city}
          onChange={(v) => onFieldChange("city", v)}
          onBlur={() => onFieldBlur("city")}
          error={errors.city}
        />
      </div>
      <FormField
        id="checkout-area"
        label="Περιοχή (προαιρετικό)"
        value={values.area}
        onChange={(v) => onFieldChange("area", v)}
        onBlur={() => onFieldBlur("area")}
      />
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">Χώρα</span>
        <span className="text-ink">Ελλάδα</span>
      </div>
    </section>
  );
}
