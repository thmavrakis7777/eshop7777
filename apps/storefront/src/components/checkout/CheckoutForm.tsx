"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Cart, PaymentProvider, ShippingOption } from "@/lib/types";
import {
  EMPTY_CONTACT_ADDRESS,
  type ContactAddressErrors,
  type ContactAddressFields,
} from "@/components/checkout/checkout-form-state";
import { isValidEmail, isValidPhone, isValidPostalCode, isRequired } from "@/lib/checkout-validation";
import {
  completeCheckoutAction,
  setShippingMethodAction,
  updateCheckoutDetailsAction,
  updateCheckoutEmailAction,
} from "@/lib/actions/checkout";
import { EmailSection } from "@/components/checkout/EmailSection";
import { ContactSection } from "@/components/checkout/ContactSection";
import { AddressSection } from "@/components/checkout/AddressSection";
import { ShippingSection } from "@/components/checkout/ShippingSection";
import { PaymentSection } from "@/components/checkout/PaymentSection";
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary";
import { formatPrice } from "@/lib/format";

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

export function CheckoutForm({
  initialCart,
  paymentProviders,
}: {
  initialCart: Cart;
  paymentProviders: PaymentProvider[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);

  const [email, setEmail] = useState(initialCart.email ?? "");
  const [emailError, setEmailError] = useState<string>();
  const [emailSaving, setEmailSaving] = useState(false);

  const [details, setDetails] = useState<ContactAddressFields>(EMPTY_CONTACT_ADDRESS);
  const [touchedFields, setTouchedFields] = useState<Set<keyof ContactAddressFields>>(new Set());
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsServerError, setDetailsServerError] = useState<string>();
  const lastSavedDetails = useRef<string | null>(null);

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingStatus, setShippingStatus] = useState<"pending-address" | "loading" | "ready" | "empty">(
    "pending-address"
  );
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [shippingSaving, setShippingSaving] = useState(false);

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

  // Fires on every field's blur, but only the field that was actually
  // blurred gets marked "touched" — validating the whole section silently
  // decides whether to auto-save, while error *display* stays scoped to
  // fields the customer has actually reached, so a form that's only
  // half-filled-in doesn't show a wall of "required" errors up front.
  async function handleDetailsBlur(field: keyof ContactAddressFields) {
    setTouchedFields((prev) => new Set(prev).add(field));

    const errors = validateDetails(details);
    if (Object.keys(errors).length > 0) return;

    const signature = JSON.stringify(details);
    if (signature === lastSavedDetails.current) return;

    setDetailsSaving(true);
    setDetailsServerError(undefined);
    setShippingStatus("loading");
    const result = await updateCheckoutDetailsAction(details);
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
      setDetailsServerError(result.error);
      setShippingStatus("pending-address");
    }
    setDetailsSaving(false);
  }

  const visibleDetailsErrors: ContactAddressErrors = Object.fromEntries(
    Object.entries(validateDetails(details)).filter(([field]) => touchedFields.has(field as keyof ContactAddressFields))
  );

  async function handleSelectShipping(option: ShippingOption) {
    setSelectedShippingId(option.id);
    setShippingSaving(true);
    const result = await setShippingMethodAction(option.id);
    if (result.ok) setCart(result.cart);
    else setSelectedShippingId(null);
    setShippingSaving(false);
  }

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

  const canSubmit = Boolean(cart.email) && Boolean(cart.shippingAddress) && cart.hasShippingMethod && !isSubmitting;

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
            saving={shippingSaving}
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
