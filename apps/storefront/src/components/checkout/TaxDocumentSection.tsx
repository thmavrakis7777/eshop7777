"use client";

import { SectionHeading } from "@/components/checkout/SectionHeading";
import { FormField } from "@/components/checkout/FormField";
import type { InvoiceFormErrors, InvoiceFormFields } from "@/components/checkout/checkout-form-state";
import type { TaxDocumentType } from "@/lib/types";

// Απόδειξη is the default (CHECKOUT_PREMIUM_SPEC.md §4) — Τιμολόγιο reveals
// the invoice fields via the same grid-rows expand pattern as
// BillingAddressSection. ΑΦΜ is checksum-validated on blur only in this
// phase; a live ΓΕΜΗ lookup that autofills Επωνυμία/Έδρα is a later phase
// (§4.3) — these fields are honest manual entry until then.
export function TaxDocumentSection({
  type,
  onTypeChange,
  values,
  errors,
  onFieldChange,
  onFieldBlur,
  saving,
}: {
  type: TaxDocumentType;
  onTypeChange: (type: TaxDocumentType) => void;
  values: InvoiceFormFields;
  errors: InvoiceFormErrors;
  onFieldChange: (field: keyof InvoiceFormFields, value: string) => void;
  onFieldBlur: (field: keyof InvoiceFormFields) => void;
  saving?: boolean;
}) {
  const isInvoice = type === "invoice";

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={5} title="Παραστατικό" saving={saving} />
      <div className="flex flex-col gap-2">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3.5 text-sm ${
            !isInvoice ? "border-ink" : "border-border"
          }`}
        >
          <input
            type="radio"
            name="tax-document-type"
            checked={!isInvoice}
            onChange={() => onTypeChange("receipt")}
            className="h-4 w-4 accent-accent"
          />
          <span className="font-medium text-ink">Απόδειξη</span>
        </label>
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3.5 text-sm ${
            isInvoice ? "border-ink" : "border-border"
          }`}
        >
          <input
            type="radio"
            name="tax-document-type"
            checked={isInvoice}
            onChange={() => onTypeChange("invoice")}
            className="h-4 w-4 accent-accent"
          />
          <span className="font-medium text-ink">Τιμολόγιο</span>
        </label>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isInvoice ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        {/* `inert` — same reasoning as BillingAddressSection: a collapsed
            grid row alone doesn't stop Tab from reaching hidden fields. */}
        <div className="flex flex-col gap-3 overflow-hidden" inert={!isInvoice}>
          <FormField
            id="invoice-company-name"
            label="Επωνυμία"
            autoComplete="organization"
            value={values.companyName}
            onChange={(v) => onFieldChange("companyName", v)}
            onBlur={() => onFieldBlur("companyName")}
            error={errors.companyName}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="invoice-afm"
              label="ΑΦΜ"
              inputMode="numeric"
              value={values.afm}
              onChange={(v) => onFieldChange("afm", v)}
              onBlur={() => onFieldBlur("afm")}
              error={errors.afm}
            />
            <FormField
              id="invoice-doy"
              label="ΔΟΥ"
              value={values.doy}
              onChange={(v) => onFieldChange("doy", v)}
              onBlur={() => onFieldBlur("doy")}
              error={errors.doy}
            />
          </div>
          <FormField
            id="invoice-activity"
            label="Δραστηριότητα"
            value={values.activity}
            onChange={(v) => onFieldChange("activity", v)}
            onBlur={() => onFieldBlur("activity")}
            error={errors.activity}
          />
          <p className="text-xs text-ink-muted">
            Ως έδρα χρησιμοποιείται η διεύθυνση χρέωσης (ή η διεύθυνση παράδοσης, αν δεν έχεις ορίσει διαφορετική).
          </p>
        </div>
      </div>
    </section>
  );
}
