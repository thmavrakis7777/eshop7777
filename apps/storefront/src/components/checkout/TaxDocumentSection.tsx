"use client";

import { SectionHeading } from "@/components/checkout/SectionHeading";
import { FormField } from "@/components/checkout/FormField";
import type { InvoiceFormErrors, InvoiceFormFields } from "@/components/checkout/checkout-form-state";
import type { TaxDocumentType } from "@/lib/types";

// Απόδειξη is the default (CHECKOUT_PREMIUM_SPEC.md §4) — Τιμολόγιο reveals
// the invoice fields via the same grid-rows expand pattern as
// BillingAddressSection. ΑΦΜ is checksum-validated on blur; a valid ΑΦΜ
// then triggers an ΑΑΔΕ registry lookup (CheckoutForm.tsx's
// handleInvoiceFieldBlur) that fills Επωνυμία/ΔΟΥ/Δραστηριότητα when found.
// ΑΦΜ comes first for that reason: the customer types it before reaching
// the fields it fills. Έδρα isn't filled — it reuses the billing address,
// a separate section/toggle the customer may already have typed into.
export function TaxDocumentSection({
  type,
  onTypeChange,
  values,
  errors,
  onFieldChange,
  onFieldBlur,
  saving,
  afmLookupLoading,
  registryMatch,
}: {
  type: TaxDocumentType;
  onTypeChange: (type: TaxDocumentType) => void;
  values: InvoiceFormFields;
  errors: InvoiceFormErrors;
  onFieldChange: (field: keyof InvoiceFormFields, value: string) => void;
  onFieldBlur: (field: keyof InvoiceFormFields) => void;
  saving?: boolean;
  afmLookupLoading?: boolean;
  // Set while the ΑΦΜ on screen is the one ΑΑΔΕ's details came from; null
  // once it's edited, so the note never vouches for a different ΑΦΜ.
  registryMatch?: { inactive: boolean } | null;
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
          {afmLookupLoading ? (
            <p role="status" className="text-xs text-ink-muted">
              Αναζήτηση στοιχείων επιχείρησης…
            </p>
          ) : (
            registryMatch && (
              <div role="status" className="flex flex-col gap-1 text-xs">
                <p className="text-ink-muted">
                  Τα στοιχεία συμπληρώθηκαν από το μητρώο ΑΑΔΕ. Έλεγξέ τα και διόρθωσε ό,τι χρειάζεται.
                </p>
                {/* A warning, not a block — the registry can lag behind,
                    and the customer may know better. */}
                {registryMatch.inactive && (
                  <p className="text-danger">
                    Σύμφωνα με το μητρώο ΑΑΔΕ, η επιχείρηση με αυτόν τον ΑΦΜ δεν είναι ενεργή. Έλεγξε ότι τον
                    έγραψες σωστά.
                  </p>
                )}
              </div>
            )
          )}
          <FormField
            id="invoice-company-name"
            label="Επωνυμία"
            autoComplete="organization"
            value={values.companyName}
            onChange={(v) => onFieldChange("companyName", v)}
            onBlur={() => onFieldBlur("companyName")}
            error={errors.companyName}
          />
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
