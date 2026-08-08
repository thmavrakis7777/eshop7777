"use client";

import { SectionHeading } from "@/components/checkout/SectionHeading";
import { FormField } from "@/components/checkout/FormField";
import type { ContactAddressErrors, ContactAddressFields } from "@/components/checkout/checkout-form-state";

export function ContactSection({
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
      <SectionHeading number={2} title="Στοιχεία παραλήπτη" />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          id="checkout-first-name"
          label="Όνομα"
          autoComplete="given-name"
          value={values.firstName}
          onChange={(v) => onFieldChange("firstName", v)}
          onBlur={() => onFieldBlur("firstName")}
          error={errors.firstName}
          disabled={saving}
        />
        <FormField
          id="checkout-last-name"
          label="Επώνυμο"
          autoComplete="family-name"
          value={values.lastName}
          onChange={(v) => onFieldChange("lastName", v)}
          onBlur={() => onFieldBlur("lastName")}
          error={errors.lastName}
          disabled={saving}
        />
      </div>
      <FormField
        id="checkout-phone"
        label="Τηλέφωνο"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        onChange={(v) => onFieldChange("phone", v)}
        onBlur={() => onFieldBlur("phone")}
        error={errors.phone}
        disabled={saving}
      />
    </section>
  );
}
