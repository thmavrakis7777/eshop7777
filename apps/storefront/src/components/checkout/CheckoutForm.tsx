"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Cart, PaymentProvider, ShippingOption, TaxDocumentType } from "@/lib/types";
import {
  EMPTY_BILLING_ADDRESS,
  EMPTY_CONTACT_ADDRESS,
  EMPTY_INVOICE_FIELDS,
  validateAddressFields,
  type BillingAddressErrors,
  type BillingAddressFields,
  type ContactAddressErrors,
  type ContactAddressFields,
  type InvoiceFormErrors,
  type InvoiceFormFields,
} from "@/components/checkout/checkout-form-state";
import { isValidEmail, isValidPhone, isValidPostalCode, isValidAFM, isRequired } from "@/lib/checkout-validation";
import {
  completeCheckoutAction,
  setShippingMethodAction,
  updateCheckoutDetailsAction,
  updateCheckoutEmailAction,
  updateTaxDocumentAction,
  type TaxDocumentDetails,
} from "@/lib/actions/checkout";
import { lookupCompanyByAfm } from "@/lib/actions/afm-lookup";
import { EmailSection } from "@/components/checkout/EmailSection";
import { ContactSection } from "@/components/checkout/ContactSection";
import { AddressSection } from "@/components/checkout/AddressSection";
import { BillingAddressSection } from "@/components/checkout/BillingAddressSection";
import { ShippingSection } from "@/components/checkout/ShippingSection";
import { TaxDocumentSection } from "@/components/checkout/TaxDocumentSection";
import { PaymentSection } from "@/components/checkout/PaymentSection";
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary";
import { formatPrice } from "@/lib/format";
import { trackInitiateCheckout } from "@/lib/analytics/track";

function validateDetails(d: ContactAddressFields): ContactAddressErrors {
  const errors: ContactAddressErrors = {};
  if (!isRequired(d.firstName)) errors.firstName = "Συμπλήρωσε αυτό το πεδίο.";
  if (!isRequired(d.lastName)) errors.lastName = "Συμπλήρωσε αυτό το πεδίο.";
  if (!isValidPhone(d.phone)) errors.phone = "Το τηλέφωνο δεν είναι έγκυρο.";
  if (!isRequired(d.street)) errors.street = "Συμπλήρωσε αυτό το πεδίο.";
  if (!isRequired(d.number)) errors.number = "Συμπλήρωσε αυτό το πεδίο.";
  if (!isValidPostalCode(d.postalCode)) errors.postalCode = "Ο ταχυδρομικός κώδικας δεν είναι έγκυρος.";
  if (!isRequired(d.city)) errors.city = "Συμπλήρωσε αυτό το πεδίο.";
  return errors;
}

function validateInvoiceFields(f: InvoiceFormFields): InvoiceFormErrors {
  const errors: InvoiceFormErrors = {};
  if (!isRequired(f.companyName)) errors.companyName = "Συμπλήρωσε αυτό το πεδίο.";
  if (!isValidAFM(f.afm)) errors.afm = "Το ΑΦΜ δεν είναι έγκυρο.";
  if (!isRequired(f.doy)) errors.doy = "Συμπλήρωσε αυτό το πεδίο.";
  if (!isRequired(f.activity)) errors.activity = "Συμπλήρωσε αυτό το πεδίο.";
  return errors;
}

export function CheckoutForm({
  initialCart,
  paymentProviders,
  initialShippingOptions,
}: {
  initialCart: Cart;
  paymentProviders: PaymentProvider[];
  // Resolved server-side (checkout/page.tsx) when the cart already has a
  // saved address — a refresh or a return visit to checkout should not make
  // the shipping section forget an address that's already on the cart.
  initialShippingOptions: ShippingOption[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);

  // Fires once per checkout page load, off the cart as it was when checkout
  // was entered — not on `cart` state, which changes on every address/
  // shipping save and would otherwise re-fire InitiateCheckout repeatedly
  // for what's still the same checkout attempt.
  useEffect(() => {
    trackInitiateCheckout({
      id: initialCart.id,
      itemIds: initialCart.items.map((i) => i.variantId),
      totalAmount: initialCart.total.amount,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCart.id]);

  const [email, setEmail] = useState(initialCart.email ?? "");
  const [emailError, setEmailError] = useState<string>();
  const [emailSaving, setEmailSaving] = useState(false);

  const [details, setDetails] = useState<ContactAddressFields>(EMPTY_CONTACT_ADDRESS);
  const [touchedFields, setTouchedFields] = useState<Set<keyof ContactAddressFields>>(new Set());
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsServerError, setDetailsServerError] = useState<string>();
  const lastSavedDetails = useRef<string | null>(null);

  // Unchecked by default (CHECKOUT_PREMIUM_SPEC.md §3) — same "always starts
  // empty regardless of what's already saved on the cart" pattern the
  // contact/address fields already use, not a new gap.
  const [billingDiffers, setBillingDiffers] = useState(false);
  const [billingFields, setBillingFields] = useState<BillingAddressFields>(EMPTY_BILLING_ADDRESS);
  const [billingTouched, setBillingTouched] = useState<Set<keyof BillingAddressFields>>(new Set());

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>(initialShippingOptions);
  const [shippingStatus, setShippingStatus] = useState<"pending-address" | "loading" | "ready" | "empty" | "error">(
    !initialCart.shippingAddress ? "pending-address" : initialShippingOptions.length > 0 ? "ready" : "empty"
  );
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(initialCart.shippingMethodId ?? null);
  const [shippingSaving, setShippingSaving] = useState(false);

  // Tax document metadata round-trips cleanly through cart.metadata (unlike
  // address_1, splitting it back apart is exact), so this seeds from the
  // real cart rather than always starting empty.
  const [taxDocumentType, setTaxDocumentType] = useState<TaxDocumentType>(initialCart.taxDocumentType);
  const [invoiceFields, setInvoiceFields] = useState<InvoiceFormFields>(
    initialCart.invoiceDetails
      ? {
          companyName: initialCart.invoiceDetails.companyName,
          afm: initialCart.invoiceDetails.afm,
          doy: initialCart.invoiceDetails.doy,
          activity: initialCart.invoiceDetails.activity,
        }
      : EMPTY_INVOICE_FIELDS
  );
  const [invoiceTouched, setInvoiceTouched] = useState<Set<keyof InvoiceFormFields>>(new Set());
  const [taxSaving, setTaxSaving] = useState(false);
  const [afmLookupLoading, setAfmLookupLoading] = useState(false);

  const [submitError, setSubmitError] = useState<string>();
  // Deliberately its own transition, separate from the background saves
  // below (email/details/shipping each track their own `*Saving` boolean
  // instead) — sharing one `isPending` across all of them made the submit
  // button flash "Επεξεργασία…" while the address was just autosaving in
  // the background, which reads as "your order is being processed" when
  // nothing of the sort is happening yet. Found live while testing.
  const [isSubmitting, startSubmitTransition] = useTransition();

  async function handleEmailBlur() {
    setEmailError(undefined);
    if (!email) return;
    if (!isValidEmail(email)) {
      setEmailError("Το email δεν είναι έγκυρο.");
      return;
    }
    if (email === cart.email) return;
    setEmailSaving(true);
    const result = await updateCheckoutEmailAction(email);
    if (result.ok) setCart(result.cart);
    else setEmailError(result.error);
    setEmailSaving(false);
  }

  function handleDetailsFieldChange(field: keyof ContactAddressFields, value: string) {
    setDetails((prev) => ({ ...prev, [field]: value }));
  }

  // Single combined save for three visual sections (contact, address,
  // billing toggle) — they resolve to two Medusa fields (shipping_address/
  // billing_address) written together in one request, so one save function
  // is the actual shape of the data, not an artificial merge.
  // `billingDiffersOverride` lets the billing checkbox force an immediate
  // re-save with its new value before React has committed the state update
  // (reading `billingDiffers` from the closure here would still see the old
  // value in the same tick it changed).
  async function attemptDetailsSave(billingDiffersOverride?: boolean) {
    const effectiveBillingDiffers = billingDiffersOverride ?? billingDiffers;

    const errors = validateDetails(details);
    if (Object.keys(errors).length > 0) return;

    // Billing only participates in the save once it's actually complete —
    // a customer who checks "different billing address" but hasn't finished
    // typing it yet must not have their (already valid) shipping address
    // save blocked, or shipping options would never appear with no
    // explanation. Until billing is complete, it's sent as a mirror of
    // shipping (the same value the "unchecked" state already sends) rather
    // than blocking on it — real bug found during this session's own audit,
    // never actually exercised by earlier testing (which always filled
    // both addresses together before the first save).
    const billingComplete = effectiveBillingDiffers && Object.keys(validateAddressFields(billingFields)).length === 0;

    const signature = JSON.stringify({
      details,
      billing: billingComplete ? billingFields : null,
    });
    if (signature === lastSavedDetails.current) return;

    setDetailsSaving(true);
    setDetailsServerError(undefined);
    setShippingStatus("loading");
    const result = await updateCheckoutDetailsAction({
      ...details,
      billingDiffers: billingComplete,
      billing: billingComplete ? billingFields : undefined,
    });
    if (result.ok) {
      lastSavedDetails.current = signature;
      setCart(result.cart);
      setShippingOptions(result.shippingOptions);
      setShippingStatus(result.shippingOptions.length > 0 ? "ready" : "empty");
      // Address changed since a shipping method was chosen — the old
      // choice may no longer be valid, so it isn't carried forward
      // silently; the customer picks again from the refreshed list.
      setSelectedShippingId(null);
    } else {
      // Distinct from "pending-address": the address itself was complete
      // and valid (it passed validateDetails above) — the save to the
      // server failed for some other reason (e.g. a transient database
      // connection issue). Telling the customer to "fill in your address"
      // when they already did is what a real go-live bug report traced
      // back to here.
      setDetailsServerError(result.error);
      setShippingStatus("error");
    }
    setDetailsSaving(false);
  }

  // Fires on every field's blur, but only the field that was actually
  // blurred gets marked "touched" — validating the whole section silently
  // decides whether to auto-save, while error *display* stays scoped to
  // fields the customer has actually reached, so a form that's only
  // half-filled-in doesn't show a wall of "required" errors up front.
  async function handleDetailsBlur(field: keyof ContactAddressFields) {
    setTouchedFields((prev) => new Set(prev).add(field));
    await attemptDetailsSave();
  }

  const visibleDetailsErrors: ContactAddressErrors = Object.fromEntries(
    Object.entries(validateDetails(details)).filter(([field]) => touchedFields.has(field as keyof ContactAddressFields))
  );

  function handleBillingToggle(checked: boolean) {
    setBillingDiffers(checked);
    // Unchecking should immediately re-mirror billing_address to
    // shipping_address on the cart rather than leaving the last
    // custom-entered billing address stale on the server.
    if (!checked) void attemptDetailsSave(false);
  }

  function handleBillingFieldChange(field: keyof BillingAddressFields, value: string) {
    setBillingFields((prev) => ({ ...prev, [field]: value }));
  }

  async function handleBillingBlur(field: keyof BillingAddressFields) {
    setBillingTouched((prev) => new Set(prev).add(field));
    await attemptDetailsSave();
  }

  const visibleBillingErrors: BillingAddressErrors = Object.fromEntries(
    Object.entries(validateAddressFields(billingFields)).filter(([field]) =>
      billingTouched.has(field as keyof BillingAddressFields)
    )
  );

  async function handleSelectShipping(option: ShippingOption) {
    setSelectedShippingId(option.id);
    setShippingSaving(true);
    const result = await setShippingMethodAction(option.id);
    if (result.ok) setCart(result.cart);
    else setSelectedShippingId(null);
    setShippingSaving(false);
  }

  async function saveTaxDocument(payload: TaxDocumentDetails) {
    setTaxSaving(true);
    const result = await updateTaxDocumentAction(payload);
    if (result.ok) setCart(result.cart);
    setTaxSaving(false);
  }

  function handleTaxTypeChange(type: TaxDocumentType) {
    setTaxDocumentType(type);
    // Switching to Απόδειξη always has something valid to save immediately;
    // switching to Τιμολόγιο has empty fields at first — nothing to save
    // until the customer actually fills them in and blurs.
    if (type === "receipt") void saveTaxDocument({ type: "receipt" });
  }

  function handleInvoiceFieldChange(field: keyof InvoiceFormFields, value: string) {
    setInvoiceFields((prev) => ({ ...prev, [field]: value }));
  }

  // ΓΕΜΗ lookup fires the moment ΑΦΜ passes its checksum — independent of
  // whether the rest of the form validates yet, since the whole point is
  // autofilling Επωνυμία/Δραστηριότητα *before* the customer types them.
  // `currentFields` (not the `invoiceFields` closure) is what gets
  // validated/saved below, so a successful lookup can save immediately in
  // the same blur instead of waiting for a second one — reading
  // `invoiceFields` again here would still see the pre-lookup values,
  // since `setInvoiceFields` doesn't update the closure synchronously.
  async function handleInvoiceFieldBlur(field: keyof InvoiceFormFields) {
    setInvoiceTouched((prev) => new Set(prev).add(field));

    let currentFields = invoiceFields;
    if (field === "afm" && isValidAFM(invoiceFields.afm)) {
      setAfmLookupLoading(true);
      const result = await lookupCompanyByAfm(invoiceFields.afm);
      setAfmLookupLoading(false);
      if (result) {
        // Functional update, not a snapshot object — the lookup can take a
        // moment, and if the customer typed into Επωνυμία while it was in
        // flight, applying a plain object captured before the await would
        // silently overwrite what they just typed. Merging against `prev`
        // (the state at the moment this actually commits) avoids that real
        // race condition, found during this session's own audit.
        setInvoiceFields((prev) => {
          const merged = {
            ...prev,
            companyName: prev.companyName || result.companyName,
            activity: prev.activity || result.activity || prev.activity,
          };
          currentFields = merged;
          return merged;
        });
      }
    }

    const errors = validateInvoiceFields(currentFields);
    if (Object.keys(errors).length > 0) return;
    await saveTaxDocument({ type: "invoice", ...currentFields });
  }

  const visibleInvoiceErrors: InvoiceFormErrors = Object.fromEntries(
    Object.entries(validateInvoiceFields(invoiceFields)).filter(([field]) =>
      invoiceTouched.has(field as keyof InvoiceFormFields)
    )
  );

  function handleSubmit() {
    setSubmitError(undefined);
    startSubmitTransition(async () => {
      const result = await completeCheckoutAction();
      if (result.ok) {
        router.push(`/checkout/epibebaiosi?order=${result.orderId}`);
      } else {
        setSubmitError(result.error);
      }
    });
  }

  const taxDocumentReady =
    taxDocumentType === "receipt" || Object.keys(validateInvoiceFields(invoiceFields)).length === 0;
  const canSubmit =
    Boolean(cart.email) && Boolean(cart.shippingAddress) && cart.hasShippingMethod && taxDocumentReady && !isSubmitting;

  return (
    <>
      {/* pb-28 makes room at the bottom for the mobile fixed submit bar so
          it never overlaps the payment section when scrolled all the way
          down; irrelevant on lg+, where that bar doesn't render. */}
      <div className="grid grid-cols-1 gap-10 pb-28 lg:grid-cols-[1fr_380px] lg:pb-0">
        {/* DOM order stays [form, summary] — matching the desktop reading
            order (left = form, right = summary) — and CSS `order` alone
            moves the summary to the top on mobile, per
            CHECKOUT_UX_SPEC.md §5 ("how much am I paying" answered before
            any data entry starts). Reordering the DOM itself instead of
            using `order` here would flip the desktop columns too — found
            live while testing this exact mistake. */}
        <div className="flex flex-col gap-8">
          <EmailSection value={email} onChange={setEmail} onBlur={handleEmailBlur} error={emailError} saving={emailSaving} />
          <ContactSection
            values={details}
            errors={visibleDetailsErrors}
            onFieldChange={handleDetailsFieldChange}
            onFieldBlur={handleDetailsBlur}
            saving={detailsSaving}
          />
          <AddressSection
            values={details}
            errors={visibleDetailsErrors}
            onFieldChange={handleDetailsFieldChange}
            onFieldBlur={handleDetailsBlur}
            saving={detailsSaving}
          />
          <BillingAddressSection
            checked={billingDiffers}
            onToggle={handleBillingToggle}
            values={billingFields}
            errors={visibleBillingErrors}
            onFieldChange={handleBillingFieldChange}
            onFieldBlur={handleBillingBlur}
            saving={detailsSaving}
          />
          {detailsServerError && (
            <p role="alert" className="text-sm text-danger">
              {detailsServerError}
            </p>
          )}
          <ShippingSection
            status={shippingStatus}
            options={shippingOptions}
            selectedId={selectedShippingId}
            onSelect={handleSelectShipping}
            onRetry={() => void attemptDetailsSave()}
            saving={shippingSaving}
          />
          <TaxDocumentSection
            type={taxDocumentType}
            onTypeChange={handleTaxTypeChange}
            values={invoiceFields}
            errors={visibleInvoiceErrors}
            onFieldChange={handleInvoiceFieldChange}
            onFieldBlur={handleInvoiceFieldBlur}
            saving={taxSaving}
            afmLookupLoading={afmLookupLoading}
          />
          <PaymentSection providers={paymentProviders} />

          <div className="hidden flex-col gap-3 border-t border-border pt-6 lg:flex">
            <SubmitButton canSubmit={canSubmit} isPending={isSubmitting} total={cart.total} onSubmit={handleSubmit} error={submitError} />
          </div>
        </div>

        <div className="order-first lg:order-none">
          <CheckoutOrderSummary cart={cart} />
        </div>
      </div>

      {/* Mobile only: sticky to the bottom of the viewport, always
          reachable without scrolling back down — CHECKOUT_UX_SPEC.md §5. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 lg:hidden">
        <SubmitButton canSubmit={canSubmit} isPending={isSubmitting} total={cart.total} onSubmit={handleSubmit} error={submitError} />
      </div>
    </>
  );
}

function SubmitButton({
  canSubmit,
  isPending,
  total,
  onSubmit,
  error,
}: {
  canSubmit: boolean;
  isPending: boolean;
  total: Cart["total"];
  onSubmit: () => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Distance-selling law (ν. 2251/1994 art. 3ια, transposing Directive
          2011/83/EU art. 8§2) requires the final order button/step to make
          the payment obligation explicit — a bare "Συνέχεια"/"Continue"
          does not satisfy that. The button already carries the exact total;
          this line makes the obligation itself unambiguous, always visible
          (not just on error/disabled), regardless of the total shown. */}
      <p className="text-center text-xs text-ink-muted">
        Πατώντας «Ολοκλήρωση Παραγγελίας» αναλαμβάνεις την υποχρέωση πληρωμής του συνολικού ποσού. Ισχύουν οι{" "}
        <a href="/oroi-xrisis" className="underline underline-offset-2 hover:text-ink" target="_blank" rel="noopener noreferrer">
          Όροι Χρήσης
        </a>{" "}
        και το δικαίωμα{" "}
        <a href="/epistrofes" className="underline underline-offset-2 hover:text-ink" target="_blank" rel="noopener noreferrer">
          Υπαναχώρησης
        </a>
        .
      </p>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full rounded-sm bg-ink px-6 py-4 text-center text-sm font-medium tracking-wide text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Επεξεργασία…" : `ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ · ${formatPrice(total)}`}
      </button>
      {!canSubmit && !isPending && (
        <p className="text-center text-xs text-ink-muted">Συμπλήρωσε τα στοιχεία παραπάνω για να ολοκληρώσεις την παραγγελία.</p>
      )}
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
