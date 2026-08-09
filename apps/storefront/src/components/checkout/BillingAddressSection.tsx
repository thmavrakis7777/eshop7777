"use client";

import { FormField } from "@/components/checkout/FormField";
import type { BillingAddressErrors, BillingAddressFields } from "@/components/checkout/checkout-form-state";

// No SectionHeading/number here on purpose — this is a continuation of
// section 3 ("Διεύθυνση παράδοσης"), not a new numbered step
// (CHECKOUT_PREMIUM_SPEC.md §3). Unchecked by default; the field group
// expands/collapses via a grid-rows transition (~200ms, matching this
// project's existing motion convention) rather than a hard show/hide, and
// entered values are kept in React state even while hidden so toggling
// back on doesn't lose anything.
export function BillingAddressSection({
  checked,
  onToggle,
  values,
  errors,
  onFieldChange,
  onFieldBlur,
  saving,
}: {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  values: BillingAddressFields;
  errors: BillingAddressErrors;
  onFieldChange: (field: keyof BillingAddressFields, value: string) => void;
  onFieldBlur: (field: keyof BillingAddressFields) => void;
  saving?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span className="text-ink">Τα στοιχεία τιμολόγησης είναι διαφορετικά από τη διεύθυνση αποστολής</span>
      </label>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          checked ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        {/* `inert` (not just visually collapsed) — a 0-height grid row with
            overflow-hidden still lets Tab reach the fields inside it in
            most browsers, a real focus-order bug for anyone tabbing
            through the form without looking, not just a visual nit. */}
        <div className="flex flex-col gap-3 overflow-hidden" inert={!checked}>
          {saving && (
            <span role="status" className="text-xs text-ink-muted">
              Αποθήκευση…
            </span>
          )}
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <FormField
              id="billing-street"
              label="Οδός"
              autoComplete="billing address-line1"
              value={values.street}
              onChange={(v) => onFieldChange("street", v)}
              onBlur={() => onFieldBlur("street")}
              error={errors.street}
            />
            <FormField
              id="billing-number"
              label="Αριθμός"
              value={values.number}
              onChange={(v) => onFieldChange("number", v)}
              onBlur={() => onFieldBlur("number")}
              error={errors.number}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="billing-postal-code"
              label="ΤΚ"
              inputMode="numeric"
              autoComplete="billing postal-code"
              value={values.postalCode}
              onChange={(v) => onFieldChange("postalCode", v)}
              onBlur={() => onFieldBlur("postalCode")}
              error={errors.postalCode}
            />
            <FormField
              id="billing-city"
              label="Πόλη"
              autoComplete="billing address-level2"
              value={values.city}
              onChange={(v) => onFieldChange("city", v)}
              onBlur={() => onFieldBlur("city")}
              error={errors.city}
            />
          </div>
          <FormField
            id="billing-area"
            label="Περιοχή (προαιρετικό)"
            value={values.area}
            onChange={(v) => onFieldChange("area", v)}
            onBlur={() => onFieldBlur("area")}
          />
        </div>
      </div>
    </div>
  );
}
