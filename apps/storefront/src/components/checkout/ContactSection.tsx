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
  onFieldChange: (field: keyof ContactAddressFields, value: string, autofilled?: boolean) => void;
  onFieldBlur: (field: keyof ContactAddressFields) => void;
  saving?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={2} title="Στοιχεία παραλήπτη" saving={saving} />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          id="checkout-first-name"
          label="Όνομα"
          autoComplete="given-name"
          value={values.firstName}
          onChange={(v, autofilled) => onFieldChange("firstName", v, autofilled)}
          onBlur={() => onFieldBlur("firstName")}
          error={errors.firstName}
        />
        <FormField
          id="checkout-last-name"
          label="Επώνυμο"
          autoComplete="family-name"
          value={values.lastName}
          onChange={(v, autofilled) => onFieldChange("lastName", v, autofilled)}
          onBlur={() => onFieldBlur("lastName")}
          error={errors.lastName}
        />
      </div>
      <FormField
        id="checkout-phone"
        label="Τηλέφωνο"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        onChange={(v, autofilled) => onFieldChange("phone", v, autofilled)}
        onBlur={() => onFieldBlur("phone")}
        error={errors.phone}
      />
    </section>
  );
}
