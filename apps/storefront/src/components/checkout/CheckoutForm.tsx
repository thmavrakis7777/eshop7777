"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Cart, CustomerAddress, PaymentProvider, ShippingOption, TaxDocumentType } from "@/lib/types";
import {
  EMPTY_BILLING_ADDRESS,
  EMPTY_INVOICE_FIELDS,
  applyRegistryFill,
  validateAddressFields,
  type BillingAddressErrors,
  type BillingAddressFields,
  type ContactAddressErrors,
  type ContactAddressFields,
  type InvoiceFormErrors,
  type InvoiceFormFields,
  type RegistryFillFields,
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
import { getCartAction, removeLineItemAction } from "@/lib/actions/cart";
import { useCartUI } from "@/components/cart/CartUIProvider";
import { displayedCart } from "@/lib/cart-snapshot";
import { lookupCompanyByAfm } from "@/lib/actions/afm-lookup";
import { isLineItemOverstocked } from "@/lib/stock";
import { highestOversizedFeeCents } from "@/lib/shipping";
import type { StockInquiryContact } from "@/lib/whatsapp";
import { EmailSection } from "@/components/checkout/EmailSection";
import { ContactSection } from "@/components/checkout/ContactSection";
import { AddressSection } from "@/components/checkout/AddressSection";
import { BillingAddressSection } from "@/components/checkout/BillingAddressSection";
import { ShippingSection } from "@/components/checkout/ShippingSection";
import { TaxDocumentSection } from "@/components/checkout/TaxDocumentSection";
import { PaymentSection } from "@/components/checkout/PaymentSection";
import { CheckoutOrderSummary } from "@/components/checkout/CheckoutOrderSummary";
import { EmptyCartState } from "@/components/cart/EmptyCartState";
import { formatPrice } from "@/lib/format";
import { trackInitiateCheckout } from "@/lib/analytics/track";
import { splitStreetAndNumber } from "@/lib/address-format";
import { detailsFromSavedAddress, findSavedAddress, type CheckoutPrefill } from "@/lib/checkout-prefill";
import { NEW_ADDRESS, SavedAddressPicker } from "@/components/checkout/SavedAddressPicker";

// How long after the browser's last autofilled field the form saves it. One
// autofill fires a change per field in quick succession, so this waits for
// the burst to finish and saves once, rather than once per field.
const AUTOFILL_SAVE_DELAY_MS = 250;

const SIGN_IN_HREF = `/logariasmos/eisodos?redirectTo=${encodeURIComponent("/checkout")}`;

// An autofilled "address-line1" arrives as one string ("Ικάρου 25") — split
// the number into Αριθμός when that's still empty (A4). Autofill only: while
// someone is typing, a street genuinely ending in a number ("Πλατεία 1866")
// must stay exactly as typed.
function withAutofilledStreet<T extends { street: string; number: string }>(prev: T, value: string): T {
  const next = { ...prev, street: value };
  if (prev.number.trim()) return next;
  const split = splitStreetAndNumber(value);
  return split.number ? { ...next, street: split.street, number: split.number } : next;
}

function validateDetails(d: ContactAddressFields): ContactAddressErrors {
  const errors: ContactAddressErrors = {};
  if (!isRequired(d.firstName)) errors.firstName = "Παρακαλώ συμπληρώστε το πεδίο";
  if (!isRequired(d.lastName)) errors.lastName = "Παρακαλώ συμπληρώστε το πεδίο";
  if (!isRequired(d.phone)) errors.phone = "Παρακαλώ συμπληρώστε το πεδίο";
  else if (!isValidPhone(d.phone)) errors.phone = "Το τηλέφωνο δεν είναι έγκυρο.";
  if (!isRequired(d.street)) errors.street = "Παρακαλώ συμπληρώστε το πεδίο";
  if (!isRequired(d.number)) errors.number = "Παρακαλώ συμπληρώστε το πεδίο";
  if (!isRequired(d.postalCode)) errors.postalCode = "Παρακαλώ συμπληρώστε το πεδίο";
  else if (!isValidPostalCode(d.postalCode)) errors.postalCode = "Ο ταχυδρομικός κώδικας δεν είναι έγκυρος.";
  if (!isRequired(d.city)) errors.city = "Παρακαλώ συμπληρώστε το πεδίο";
  return errors;
}

function validateInvoiceFields(f: InvoiceFormFields): InvoiceFormErrors {
  const errors: InvoiceFormErrors = {};
  if (!isRequired(f.companyName)) errors.companyName = "Παρακαλώ συμπληρώστε το πεδίο";
  if (!isRequired(f.afm)) errors.afm = "Παρακαλώ συμπληρώστε το πεδίο";
  else if (!isValidAFM(f.afm)) errors.afm = "Το ΑΦΜ δεν είναι έγκυρο.";
  if (!isRequired(f.doy)) errors.doy = "Παρακαλώ συμπληρώστε το πεδίο";
  if (!isRequired(f.activity)) errors.activity = "Παρακαλώ συμπληρώστε το πεδίο";
  return errors;
}

export function CheckoutForm({
  initialCart,
  paymentProviders,
  initialShippingOptions,
  stockInquiry,
  prefill,
  savedAddresses,
  signedIn,
  googleSignInHref,
}: {
  initialCart: Cart;
  paymentProviders: PaymentProvider[];
  // Resolved server-side (checkout/page.tsx) when the cart already has a
  // saved address — a refresh or a return visit to checkout should not make
  // the shipping section forget an address that's already on the cart.
  initialShippingOptions: ShippingOption[];
  stockInquiry: StockInquiryContact;
  // The form's starting values — the cart's own address, else the signed-in
  // customer's saved one (lib/checkout-prefill.ts, built in checkout/page.tsx).
  prefill: CheckoutPrefill;
  // The signed-in customer's address book, for the picker and to tell
  // whether the address is already saved. Empty for a guest.
  savedAddresses: CustomerAddress[];
  signedIn: boolean;
  // "Συνέχεια με Google", back to checkout afterwards; undefined when Google
  // sign-in isn't configured (lib/auth/google.ts).
  googleSignInHref?: string;
}) {
  const router = useRouter();
  // The shared client cart, not a local copy. It used to be
  // useState(initialCart): set once, so when the shopper changed a quantity
  // in the cart drawer (which opens on this page too) the order summary kept
  // the old lines and totals even though the page re-rendered with new
  // props. Every result below goes through receiveCart instead, and so does
  // an edit made in the drawer. See CART_STATE_SPEC.md §2–3 and
  // displayedCart() for how this page's own snapshot joins in.
  const { cart: sharedCart, receiveCart, cartEditPending } = useCartUI();
  const cart = displayedCart(sharedCart, initialCart);
  useEffect(() => {
    receiveCart(initialCart);
    // Background read on arrival: this page can be restored by Back/Forward
    // with an old cart, or the cart can have changed in another tab.
    getCartAction().then(receiveCart);
  }, [initialCart, receiveCart]);

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

  const [email, setEmail] = useState(prefill.email);
  const [emailError, setEmailError] = useState<string>();
  const [emailSaving, setEmailSaving] = useState(false);

  // Starts from `prefill` instead of always empty: it used to be empty even
  // after a refresh, with the cart still holding the address the shipping
  // section was already priced on.
  const [details, setDetails] = useState<ContactAddressFields>(prefill.details);
  const [touchedFields, setTouchedFields] = useState<Set<keyof ContactAddressFields>>(new Set());
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsServerError, setDetailsServerError] = useState<string>();
  // Filled from the cart = already saved, in the exact shape attemptDetailsSave
  // signs (below), so leaving a field untouched doesn't re-save the same thing.
  const lastSavedDetails = useRef<string | null>(
    prefill.detailsNeedSave ? null : JSON.stringify({ details: prefill.details, billing: prefill.billing })
  );
  const latestDetailsSave = useRef(0);

  // Unchecked by default (CHECKOUT_PREMIUM_SPEC.md §3) — ticked only when the
  // cart already holds a billing address that genuinely differs, so a
  // refresh doesn't quietly fold it back into the shipping one on the next
  // save.
  const [billingDiffers, setBillingDiffers] = useState(prefill.billing !== null);
  const [billingFields, setBillingFields] = useState<BillingAddressFields>(prefill.billing ?? EMPTY_BILLING_ADDRESS);
  const [billingTouched, setBillingTouched] = useState<Set<keyof BillingAddressFields>>(new Set());

  // Bumped by an autofilled change; the effects below save a moment later.
  const [detailsAutofillTick, setDetailsAutofillTick] = useState(0);
  const [emailAutofillTick, setEmailAutofillTick] = useState(0);

  // §2.3/§2.4 — which saved address the form shows, and "keep this address
  // for next time" (ticked by default, owner's decision D2).
  const [savedAddressId, setSavedAddressId] = useState(prefill.savedAddressId ?? NEW_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);

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
  // What the last successful ΑΑΔΕ lookup filled in, and for which ΑΦΜ — so
  // the next lookup knows which field values are still the registry's and
  // which the customer typed (applyRegistryFill), and leaving the same ΑΦΜ
  // again doesn't query ΑΑΔΕ twice. A ref: only event handlers read it.
  const registryFill = useRef<{ afm: string; fields: RegistryFillFields } | null>(null);
  // The same, for display: the "συμπληρώθηκαν από το μητρώο ΑΑΔΕ" note.
  const [registryMatch, setRegistryMatch] = useState<{ afm: string; inactive: boolean } | null>(null);
  const latestAfmLookup = useRef(0);
  // The invoice fields as they are right now, for lookUpAfm: after its
  // await, `invoiceFields` would still be the render the lookup started in,
  // missing anything typed meanwhile. Every change goes through
  // updateInvoiceFields, which writes both, so this is never behind.
  const latestInvoiceFields = useRef(invoiceFields);

  const [pendingLineId, setPendingLineId] = useState<string | null>(null);

  // Defaults to the first configured provider — with today's real data
  // that's almost always the only one, so this preserves the previous
  // no-choice-needed behavior exactly while supporting a real second option.
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(paymentProviders[0]?.id ?? null);

  // Set the first time "Ολοκλήρωση Παραγγελίας" is clicked while required
  // fields are still missing/invalid — from then on, every section's error
  // filter (below) reveals its errors regardless of per-field touched state,
  // instead of only the fields the customer has actually blurred. Reusing
  // the exact same validate* functions and touched-filter shape the blur
  // flow already uses, just OR'd with this flag, rather than a second
  // validation system.
  const [submitAttempted, setSubmitAttempted] = useState(false);

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
    if (result.ok) receiveCart(result.cart);
    else setEmailError(result.error);
    setEmailSaving(false);
  }

  // An autofilled field is marked touched too, so a value the browser got
  // wrong (an old number, a foreign ΤΚ) shows its error straight away instead
  // of silently holding up the save.
  function handleDetailsFieldChange(field: keyof ContactAddressFields, value: string, autofilled = false) {
    setDetails((prev) => (autofilled && field === "street" ? withAutofilledStreet(prev, value) : { ...prev, [field]: value }));
    if (autofilled) {
      setTouchedFields((prev) => new Set(prev).add(field));
      setDetailsAutofillTick((n) => n + 1);
    }
  }

  function handleEmailChange(value: string, autofilled: boolean) {
    setEmail(value);
    if (autofilled) setEmailAutofillTick((n) => n + 1);
  }

  // Autofill never leaves the fields it fills, so the save-on-blur below
  // never ran for them: the address looked complete but was never on the
  // cart, shipping kept asking for it, and the order button did nothing
  // (CHECKOUT_PREFILL_GOOGLE_SPEC.md A1). An autofilled change saves on its
  // own instead, once the burst of fields settles. Each tick re-runs the
  // effect from the render that has the newest values, and the cleanup
  // drops the previous timer, so only the last one saves.
  useEffect(() => {
    if (detailsAutofillTick === 0) return;
    const timer = setTimeout(() => void attemptDetailsSave(), AUTOFILL_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailsAutofillTick]);

  useEffect(() => {
    if (emailAutofillTick === 0) return;
    const timer = setTimeout(() => void handleEmailBlur(), AUTOFILL_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailAutofillTick]);

  // Values filled from the account (not the cart) are saved straight away,
  // exactly as if the customer had typed them and moved on — so the
  // shipping options are already there, and for a Heraklion address the one
  // delivery option is already picked (§2.2). In order, email first, so the
  // two saves can't hand back carts that each miss the other's change. The
  // ref keeps React's development double-run of effects from saving twice.
  const prefillSaveStarted = useRef(false);
  useEffect(() => {
    if (prefillSaveStarted.current) return;
    prefillSaveStarted.current = true;
    void (async () => {
      if (prefill.emailNeedsSave) await handleEmailBlur();
      if (prefill.detailsNeedSave) await attemptDetailsSave();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picking another saved address replaces the recipient and address
  // together (they belong to that address) and saves it right away.
  // "Νέα διεύθυνση" empties the address but keeps the customer's own name and
  // phone, and hides the old address's shipping options — the cart still
  // holds that address until the new one is complete, and canSubmit refuses
  // an order while the fields on screen aren't valid.
  function handleSavedAddressSelect(id: string) {
    setSavedAddressId(id);
    setTouchedFields(new Set());
    const address = savedAddresses.find((a) => a.id === id);
    if (!address) {
      setDetails((prev) => ({ ...prev, street: "", number: "", area: "", postalCode: "", city: "" }));
      setShippingStatus("pending-address");
      setSelectedShippingId(null);
      return;
    }
    const next = detailsFromSavedAddress(address, prefill.profile);
    setDetails(next);
    void attemptDetailsSave(undefined, next);
  }

  // Single combined save for three visual sections (contact, address,
  // billing toggle) — they resolve to two Medusa fields (shipping_address/
  // billing_address) written together in one request, so one save function
  // is the actual shape of the data, not an artificial merge.
  // `billingDiffersOverride` lets the billing checkbox force an immediate
  // re-save with its new value before React has committed the state update
  // (reading `billingDiffers` from the closure here would still see the old
  // value in the same tick it changed). `detailsOverride` is the same thing
  // for the saved-address picker, which sets every field at once and saves
  // in the same tick.
  async function attemptDetailsSave(billingDiffersOverride?: boolean, detailsOverride?: ContactAddressFields) {
    const effectiveBillingDiffers = billingDiffersOverride ?? billingDiffers;
    const fields = detailsOverride ?? details;

    const errors = validateDetails(fields);
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
      details: fields,
      billing: billingComplete ? billingFields : null,
    });
    if (signature === lastSavedDetails.current) return;

    const saveId = ++latestDetailsSave.current;
    setDetailsSaving(true);
    setDetailsServerError(undefined);
    setShippingStatus("loading");
    const result = await updateCheckoutDetailsAction({
      ...fields,
      billingDiffers: billingComplete,
      billing: billingComplete ? billingFields : undefined,
    });
    // A newer save started while this one was in flight (two quick edits, or
    // an autofill save overlapping a blur save): only the newest answer may
    // touch the form. An older one applied first used to flash the previous
    // address's shipping options — a Heraklion one for an address already
    // changed to Athens, even auto-selected — and clear `detailsSaving`
    // while the newest save was still on its way. Found live while testing.
    if (saveId !== latestDetailsSave.current) return;
    if (result.ok) {
      lastSavedDetails.current = signature;
      receiveCart(result.cart);
      setShippingOptions(result.shippingOptions);
      setShippingStatus(result.shippingOptions.length > 0 ? "ready" : "empty");
      // Address changed since a shipping method was chosen — the old
      // choice may no longer be valid, so it isn't carried forward
      // silently; the customer picks again from the refreshed list.
      //
      // Exception: when the refreshed list has exactly one non-pickup
      // delivery option (the normal outcome the moment an address resolves
      // to Heraklion — getShippingOptionsForCart hides every nationwide
      // method in that case), there is nothing to actually pick between, so
      // auto-selecting it avoids an unnecessary extra click and matches the
      // "Heraklion address → shipping recalculates automatically" behavior.
      // A non-Heraklion address still offers several courier options, so
      // this never fires for the general case.
      const deliveryOptions = result.shippingOptions.filter((o) => !o.isPickup);
      if (deliveryOptions.length === 1) {
        void handleSelectShipping(deliveryOptions[0]);
      } else {
        setSelectedShippingId(null);
      }
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

  // emailError (set on blur, and the only place a server-side failure like
  // "already in use" surfaces) always wins when present. Below sm the
  // customer can reach Place Order without ever blurring email at all — this
  // is what still catches "missing" or "invalid" once submitAttempted flips.
  const visibleEmailError =
    emailError ??
    (submitAttempted
      ? !isRequired(email)
        ? "Παρακαλώ συμπληρώστε το πεδίο"
        : !isValidEmail(email)
          ? "Το email δεν είναι έγκυρο."
          : undefined
      : undefined);

  const visibleDetailsErrors: ContactAddressErrors = Object.fromEntries(
    Object.entries(validateDetails(details)).filter(
      ([field]) => submitAttempted || touchedFields.has(field as keyof ContactAddressFields)
    )
  );

  function handleBillingToggle(checked: boolean) {
    setBillingDiffers(checked);
    // Unchecking should immediately re-mirror billing_address to
    // shipping_address on the cart rather than leaving the last
    // custom-entered billing address stale on the server.
    if (!checked) void attemptDetailsSave(false);
  }

  // Same autofill handling as handleDetailsFieldChange.
  function handleBillingFieldChange(field: keyof BillingAddressFields, value: string, autofilled = false) {
    setBillingFields((prev) =>
      autofilled && field === "street" ? withAutofilledStreet(prev, value) : { ...prev, [field]: value }
    );
    if (autofilled) {
      setBillingTouched((prev) => new Set(prev).add(field));
      setDetailsAutofillTick((n) => n + 1);
    }
  }

  async function handleBillingBlur(field: keyof BillingAddressFields) {
    setBillingTouched((prev) => new Set(prev).add(field));
    await attemptDetailsSave();
  }

  // Only reveal-all when the billing section is actually the one in effect
  // — otherwise submitAttempted would flag its (irrelevant, still-empty)
  // fields the moment the customer checks the box later, despite them never
  // being required in the first place while unchecked.
  const visibleBillingErrors: BillingAddressErrors = Object.fromEntries(
    Object.entries(validateAddressFields(billingFields)).filter(
      ([field]) =>
        (submitAttempted && billingDiffers) || billingTouched.has(field as keyof BillingAddressFields)
    )
  );

  async function handleSelectShipping(option: ShippingOption) {
    setSelectedShippingId(option.id);
    setShippingSaving(true);
    const result = await setShippingMethodAction(option.id);
    if (result.ok) receiveCart(result.cart);
    else setSelectedShippingId(null);
    setShippingSaving(false);
  }

  // Reuses the same removeLineItemAction the cart page/drawer already call —
  // no separate checkout-side removal logic. Totals/shipping recompute for
  // free because every mutation here replaces the whole `cart` state with
  // the server-authoritative result (same pattern as handleSelectShipping
  // etc. above); if the removed item was the only one, cart.items.length
  // drops to 0 and the component below renders the empty-cart state instead
  // of a checkout form with nothing to check out.
  async function handleRemoveItem(lineItemId: string) {
    setPendingLineId(lineItemId);
    const result = await removeLineItemAction(lineItemId);
    if (result.ok) receiveCart(result.cart);
    setPendingLineId(null);
  }

  async function saveTaxDocument(payload: TaxDocumentDetails) {
    setTaxSaving(true);
    const result = await updateTaxDocumentAction(payload);
    if (result.ok) receiveCart(result.cart);
    setTaxSaving(false);
  }

  function handleTaxTypeChange(type: TaxDocumentType) {
    setTaxDocumentType(type);
    // Switching to Απόδειξη always has something valid to save immediately;
    // switching to Τιμολόγιο has empty fields at first — nothing to save
    // until the customer actually fills them in and blurs.
    if (type === "receipt") {
      // Drops an ΑΦΜ lookup still in flight, so its result can't save a
      // Τιμολόγιο over the Απόδειξη just chosen.
      latestAfmLookup.current++;
      setAfmLookupLoading(false);
      void saveTaxDocument({ type: "receipt" });
    }
  }

  function updateInvoiceFields(next: InvoiceFormFields) {
    latestInvoiceFields.current = next;
    setInvoiceFields(next);
  }

  function handleInvoiceFieldChange(field: keyof InvoiceFormFields, value: string) {
    updateInvoiceFields({ ...latestInvoiceFields.current, [field]: value });
  }

  async function saveInvoiceIfValid(fields: InvoiceFormFields) {
    if (Object.keys(validateInvoiceFields(fields)).length > 0) return;
    await saveTaxDocument({ type: "invoice", ...fields });
  }

  // The ΑΑΔΕ lookup fires the moment a new ΑΦΜ passes its checksum —
  // independent of whether the rest of the form validates yet, since the
  // whole point is filling Επωνυμία/ΔΟΥ/Δραστηριότητα *before* the customer
  // types them. That blur's save is left to the lookup, so it saves the
  // filled-in values once instead of the empty ones first.
  async function handleInvoiceFieldBlur(field: keyof InvoiceFormFields) {
    setInvoiceTouched((prev) => new Set(prev).add(field));

    const afm = invoiceFields.afm.trim();
    if (field === "afm" && isValidAFM(afm) && afm !== registryFill.current?.afm) {
      await lookUpAfm(afm);
      return;
    }
    await saveInvoiceIfValid(invoiceFields);
  }

  async function lookUpAfm(afm: string) {
    const lookupId = ++latestAfmLookup.current;
    setAfmLookupLoading(true);
    const result = await lookupCompanyByAfm(afm);
    // Another ΑΦΜ was looked up, or Απόδειξη chosen, while this one was in
    // flight — this result is stale and changes nothing.
    if (lookupId !== latestAfmLookup.current) return;
    setAfmLookupLoading(false);

    const previousFill = registryFill.current?.fields ?? null;
    const next: RegistryFillFields | null = result
      ? { companyName: result.companyName, doy: result.doy, activity: result.activity ?? "" }
      : null;
    registryFill.current = next ? { afm, fields: next } : null;
    setRegistryMatch(result ? { afm, inactive: result.inactive } : null);
    // Merged into the fields as they are now (latestInvoiceFields), not the
    // `invoiceFields` this blur started with — the lookup takes a moment,
    // and whatever the customer typed meanwhile must survive it. The same
    // merged object is what gets saved. The ΓΕΜΗ version captured it inside
    // a setInvoiceFields updater instead, which React runs later rather
    // than on the spot, so that save went out with the pre-lookup fields
    // (the stale-closure race TASKS.md recorded).
    const merged = applyRegistryFill(latestInvoiceFields.current, previousFill, next);
    updateInvoiceFields(merged);
    await saveInvoiceIfValid(merged);
  }

  // Same reasoning as visibleBillingErrors above: only reveal-all while
  // Τιμολόγιο is actually selected.
  const visibleInvoiceErrors: InvoiceFormErrors = Object.fromEntries(
    Object.entries(validateInvoiceFields(invoiceFields)).filter(
      ([field]) =>
        (submitAttempted && taxDocumentType === "invoice") || invoiceTouched.has(field as keyof InvoiceFormFields)
    )
  );

  // DOM order of every required text field, section by section, so the
  // first entry found invalid here is also the first one the customer would
  // see scrolling down the page — used only to decide where to scroll/focus
  // on a blocked submit, not a second source of truth for validity.
  function findFirstInvalidFieldId(): string | null {
    if (!isRequired(email) || !isValidEmail(email)) return "checkout-email";

    const detailsErrors = validateDetails(details);
    const detailsIds: [keyof ContactAddressFields, string][] = [
      ["firstName", "checkout-first-name"],
      ["lastName", "checkout-last-name"],
      ["phone", "checkout-phone"],
      ["street", "checkout-street"],
      ["number", "checkout-number"],
      ["postalCode", "checkout-postal-code"],
      ["city", "checkout-city"],
    ];
    for (const [field, id] of detailsIds) {
      if (detailsErrors[field]) return id;
    }

    if (billingDiffers) {
      const billingErrors = validateAddressFields(billingFields);
      const billingIds: ["street" | "number" | "postalCode" | "city", string][] = [
        ["street", "billing-street"],
        ["number", "billing-number"],
        ["postalCode", "billing-postal-code"],
        ["city", "billing-city"],
      ];
      for (const [field, id] of billingIds) {
        if (billingErrors[field]) return id;
      }
    }

    if (taxDocumentType === "invoice") {
      const invoiceErrors = validateInvoiceFields(invoiceFields);
      const invoiceIds: [keyof InvoiceFormFields, string][] = [
        ["companyName", "invoice-company-name"],
        ["afm", "invoice-afm"],
        ["doy", "invoice-doy"],
        ["activity", "invoice-activity"],
      ];
      for (const [field, id] of invoiceIds) {
        if (invoiceErrors[field]) return id;
      }
    }

    return null;
  }

  // Every field on screen is valid, yet the order can't go through: part of
  // it never reached the cart (a browser whose autofill isAutofillChange
  // doesn't recognise, or a click that landed mid-save), or the shipping
  // choice is still open. This used to do nothing at all — no error, no
  // scroll — so it saves whatever is missing now and points at the shipping
  // step, the one thing left that isn't a text field. It never places the
  // order by itself: the customer presses the button again.
  async function saveMissingAndShowShipping() {
    if (isValidEmail(email) && email !== cart.email && !emailSaving) await handleEmailBlur();
    if (!detailsSaving) await attemptDetailsSave();
    if (!cart.hasShippingMethod) {
      document.getElementById("checkout-shipping")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function handleSubmit() {
    if (!canSubmit) {
      setSubmitAttempted(true);
      const firstInvalidId = findFirstInvalidFieldId();
      if (firstInvalidId) {
        const el = document.getElementById(firstInvalidId);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus();
      } else if (!hasOverstockedItem && !isSubmitting) {
        void saveMissingAndShowShipping();
      }
      return;
    }
    if (!selectedPaymentId) return;
    setSubmitError(undefined);
    startSubmitTransition(async () => {
      const result = await completeCheckoutAction(selectedPaymentId, { saveAddress: showSaveAddress && saveAddress });
      if (result.ok) {
        router.push(`/checkout/epibebaiosi?order=${result.orderId}`);
      } else {
        setSubmitError(result.error);
      }
    });
  }

  const taxDocumentReady =
    taxDocumentType === "receipt" || Object.keys(validateInvoiceFields(invoiceFields)).length === 0;
  // Blocks order completion while a stale line (stock reduced after it was
  // added to the cart) still exceeds what's actually in stock — see
  // CheckoutOrderSummary's per-line StockInquiryNotice for the customer-
  // facing explanation and WhatsApp/Call actions. completeOrder's own
  // transaction (lib/db/checkout.ts) is still the final, atomic guard for
  // the rare race where stock changes in the seconds after this check.
  const hasOverstockedItem = cart.items.some(isLineItemOverstocked);
  const canSubmit =
    cart.items.length > 0 &&
    Boolean(cart.email) &&
    Boolean(cart.shippingAddress) &&
    // What's on screen, not only what's on the cart: the cart keeps its last
    // saved address while a field is emptied or "Νέα διεύθυνση" is picked,
    // and the order must never go to an address the form no longer shows.
    // For the same reason, not while an email/address save is in flight.
    Object.keys(validateDetails(details)).length === 0 &&
    !detailsSaving &&
    !emailSaving &&
    cart.hasShippingMethod &&
    taxDocumentReady &&
    Boolean(selectedPaymentId) &&
    !hasOverstockedItem &&
    // A cart edit from the drawer is still on its way: the total on the
    // button is the browser's prediction until the server answers (SPD-09).
    !cartEditPending &&
    !isSubmitting;

  // §2.4 — offered to a signed-in customer whose address isn't in their
  // address book yet (the server skips a duplicate anyway).
  const showSaveAddress = signedIn && !findSavedAddress(details, savedAddresses);

  // Removing the last item mid-checkout must not leave an unusable form
  // with nothing to pay for — hand the shopper back to a clear, familiar
  // empty state instead (same one the cart page/drawer already use).
  if (cart.items.length === 0) {
    return <EmptyCartState />;
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
      {/* DOM order stays [form, summary] — matching the desktop reading
          order (left = form, right = summary) — and CSS `order` alone
          moves the summary to the top on mobile, per
          CHECKOUT_UX_SPEC.md §5 ("how much am I paying" answered before
          any data entry starts). Reordering the DOM itself instead of
          using `order` here would flip the desktop columns too — found
          live while testing this exact mistake. */}
      <div className="flex flex-col gap-8">
          <EmailSection
            value={email}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            error={visibleEmailError}
            saving={emailSaving}
            signInHref={signedIn ? undefined : SIGN_IN_HREF}
            googleHref={signedIn ? undefined : googleSignInHref}
          />
          {savedAddresses.length >= 2 && (
            <SavedAddressPicker addresses={savedAddresses} selectedId={savedAddressId} onSelect={handleSavedAddressSelect} />
          )}
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
          {/* The save-address checkbox sits with the billing one — same
              markup, same spacing — as the two options under the address. */}
          <div className="flex flex-col gap-3">
            {showSaveAddress && (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-accent"
                />
                <span className="text-ink">Αποθήκευση διεύθυνσης στον λογαριασμό μου</span>
              </label>
            )}
            <BillingAddressSection
              checked={billingDiffers}
              onToggle={handleBillingToggle}
              values={billingFields}
              errors={visibleBillingErrors}
              onFieldChange={handleBillingFieldChange}
              onFieldBlur={handleBillingBlur}
              saving={detailsSaving}
            />
          </div>
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
            // Same subtotal computeTotals compares free_over_cents against
            // server-side (after discount, never the pre-discount total) —
            // reusing cart.subtotal/discountTotal already in state, not a
            // second calculation of what "the subtotal" means.
            subtotalAfterDiscountEur={cart.subtotal.amount - cart.discountTotal.amount}
            hasOversizedItems={cart.items.some((item) => item.hasExtraShipping)}
            // The actual amount an oversized cart would be charged — the
            // same highestOversizedFeeCents rule computeTotals itself uses
            // (lib/db/cart.ts), so a per-option row never shows a courier's
            // flat label price when the real charge is higher. See
            // ShippingSection's ShippingOptionPrice.
            oversizedFeeEur={highestOversizedFeeCents(cart.items.map((item) => item.shippingCostCents)) / 100}
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
            registryMatch={registryMatch?.afm === invoiceFields.afm.trim() ? registryMatch : null}
          />
        <PaymentSection providers={paymentProviders} selectedId={selectedPaymentId} onSelect={setSelectedPaymentId} />

        {/* Normal document flow on every breakpoint — not sticky/fixed. On
            mobile this used to be a `fixed inset-x-0 bottom-0` bar, always
            visible over the form from the moment checkout opened — exactly
            what put it in front of the customer before they'd filled
            anything in. Putting it here, last in the form column, means
            it's only encountered after scrolling past every section — the
            same place desktop has always shown it. */}
        <div className="flex flex-col gap-3 border-t border-border pt-6">
          <SubmitButton canSubmit={canSubmit} isPending={isSubmitting} total={cart.total} onSubmit={handleSubmit} error={submitError} />
        </div>
      </div>

      <div className="order-first lg:order-none">
        <CheckoutOrderSummary
          cart={cart}
          onRemove={handleRemoveItem}
          pendingLineId={pendingLineId}
          stockInquiry={stockInquiry}
        />
      </div>
    </div>
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
      {/* Only truly `disabled` while a submission is already in flight — a
          native `disabled` button never dispatches `click` at all, which
          would make it impossible to reveal inline field errors by clicking
          this while required fields are still missing. `aria-disabled` +
          the same dimmed styling communicates the not-ready state instead,
          without blocking the click that's supposed to surface why. */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isPending}
        aria-disabled={!canSubmit}
        className={`w-full rounded-sm bg-ink px-6 py-4 text-center text-sm font-medium tracking-wide text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 ${
          !canSubmit && !isPending ? "cursor-not-allowed opacity-50" : ""
        }`}
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
