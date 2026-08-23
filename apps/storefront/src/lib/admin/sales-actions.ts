"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, auditLog } from "@/lib/admin/auth";
import {
  OrderError,
  markShipmentEmailSent,
  saveAdminNote,
  saveShipmentInfo,
  updateFulfillmentStatus,
  updateOrderStatus,
  updatePaymentStatus,
  type FulfillmentStatus,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/admin/orders";
import { getOrderForEmail } from "@/lib/db/order-email";
import { sendShipmentNotificationEmail } from "@/lib/email/send";
import { setCustomerActive, withdrawMarketingConsent } from "@/lib/admin/customers";
import { DiscountError, deleteDiscount, saveDiscount } from "@/lib/admin/discounts";
import type { ActionResult } from "@/lib/admin/catalog-actions";

async function admin() {
  return requireAdmin();
}

function mapError(err: unknown): string {
  if (err instanceof OrderError) {
    switch (err.code) {
      case "invalid_transition": return "Μια ακυρωμένη παραγγελία δεν αλλάζει κατάσταση.";
      case "not_found": return "Η παραγγελία δεν βρέθηκε.";
      case "already_cancelled": return "Η παραγγελία είναι ήδη ακυρωμένη.";
    }
  }
  if (err instanceof DiscountError) {
    switch (err.code) {
      case "duplicate_code": return "Υπάρχει ήδη κωδικός έκπτωσης με αυτό το όνομα.";
      case "not_found": return "Δεν βρέθηκε.";
      case "in_use": return "Ο κωδικός έχει χρησιμοποιηθεί.";
    }
  }
  if (err instanceof Error && err.message === "Not authenticated") {
    return "Η συνεδρία σου έληξε. Συνδέσου ξανά.";
  }
  return "Κάτι πήγε στραβά. Δοκίμασε ξανά.";
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  note?: string
): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await updateOrderStatus(orderId, status, user.id, note);
    await auditLog(user.id, "order.status", "order", orderId, { status });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  // Cancelling restores stock, so inventory views must reflect it too.
  if (status === "cancelled") {
    revalidatePath("/admin/inventory");
    revalidatePath("/", "layout");
  }
  return { ok: true, message: "Η κατάσταση ενημερώθηκε." };
}

export async function setPaymentStatusAction(orderId: string, status: PaymentStatus): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await updatePaymentStatus(orderId, status, user.id);
    await auditLog(user.id, "order.payment", "order", orderId, { status });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true, message: "Η κατάσταση πληρωμής ενημερώθηκε." };
}

export async function setFulfillmentStatusAction(
  orderId: string,
  status: FulfillmentStatus
): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await updateFulfillmentStatus(orderId, status, user.id);
    await auditLog(user.id, "order.fulfillment", "order", orderId, { status });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true, message: "Η κατάσταση εκτέλεσης ενημερώθηκε." };
}

/**
 * Saves courier/tracking, then — only on the FIRST save that leaves both
 * fields non-empty (saveShipmentInfo's shouldNotify) — sends the shipment
 * email automatically and records it. This is the entire "enter courier +
 * tracking code, save, customer gets emailed" workflow; there is no
 * separate "send email" button for the normal path.
 */
export async function saveShipmentInfoAction(
  orderId: string,
  courierName: string,
  trackingCode: string,
  trackingUrl: string
): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const input = {
    courierName: courierName.trim() || null,
    trackingCode: trackingCode.trim() || null,
    trackingUrl: trackingUrl.trim() || null,
  };

  let shouldNotify = false;
  try {
    ({ shouldNotify } = await saveShipmentInfo(orderId, input, user.id));
    await auditLog(user.id, "order.shipment_info", "order", orderId, {
      courierName: input.courierName,
      trackingCode: input.trackingCode,
    });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");

  if (!shouldNotify) {
    return { ok: true, message: "Τα στοιχεία αποστολής αποθηκεύτηκαν." };
  }

  // The save above already succeeded and committed — nothing past this
  // point may throw back to the admin, or a transient failure here would
  // wrongly read as "the save failed" when it didn't.
  try {
    const orderData = await getOrderForEmail(orderId);
    if (!orderData) return { ok: true, message: "Τα στοιχεία αποστολής αποθηκεύτηκαν." };

    const sent = await sendShipmentNotificationEmail(orderData);
    if (sent) {
      await markShipmentEmailSent(orderId, user.id, false);
      revalidatePath(`/admin/orders/${orderId}`);
      return { ok: true, message: "Τα στοιχεία αποστολής αποθηκεύτηκαν. Το email αποστολής στάλθηκε αυτόματα." };
    }
  } catch (err) {
    console.error("[admin] SHIPMENT_EMAIL_TRIGGER_FAILED", { orderId, error: String(err) });
  }
  return {
    ok: true,
    message: "Τα στοιχεία αποστολής αποθηκεύτηκαν, αλλά το email αποστολής απέτυχε — δοκίμασε «Επαναποστολή email».",
  };
}

/**
 * The only normal way to send a second shipment email for the same order —
 * always sends, regardless of whether one was already sent automatically.
 */
export async function resendShipmentEmailAction(orderId: string): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  let orderData;
  let sent;
  try {
    orderData = await getOrderForEmail(orderId);
    if (!orderData?.courierName?.trim() || !orderData.trackingCode?.trim()) {
      return { ok: false, error: "Συμπλήρωσε εταιρεία μεταφοράς και κωδικό αποστολής πριν την αποστολή." };
    }
    sent = await sendShipmentNotificationEmail(orderData);
  } catch (err) {
    console.error("[admin] SHIPMENT_EMAIL_RESEND_FAILED", { orderId, error: String(err) });
    return { ok: false, error: "Η αποστολή του email απέτυχε. Δοκίμασε ξανά." };
  }
  if (!sent) return { ok: false, error: "Η αποστολή του email απέτυχε. Δοκίμασε ξανά." };

  await markShipmentEmailSent(orderId, user.id, true);
  await auditLog(user.id, "order.shipment_email.resend", "order", orderId);
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Το email αποστολής στάλθηκε ξανά." };
}

export async function saveOrderNoteAction(orderId: string, note: string): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await saveAdminNote(orderId, note.trim() || null);
    await auditLog(user.id, "order.note", "order", orderId);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, message: "Η σημείωση αποθηκεύτηκε." };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function setCustomerActiveAction(customerId: string, isActive: boolean): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await setCustomerActive(customerId, isActive);
    await auditLog(user.id, isActive ? "customer.activate" : "customer.deactivate", "customer", customerId);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${customerId}`);
  return {
    ok: true,
    message: isActive ? "Ο λογαριασμός ενεργοποιήθηκε." : "Ο λογαριασμός απενεργοποιήθηκε και οι συνεδρίες τερματίστηκαν.",
  };
}

/**
 * Withdraw only — there is no action to grant consent on a customer's
 * behalf, because that is exactly what consent rules exist to prevent.
 */
export async function withdrawConsentAction(customerId: string): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    await withdrawMarketingConsent(customerId);
    await auditLog(user.id, "customer.consent.withdraw", "customer", customerId);
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
  return { ok: true, message: "Η συγκατάθεση marketing αποσύρθηκε." };
}

// ---------------------------------------------------------------------------
// Discounts
// ---------------------------------------------------------------------------

const discountSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Ο κωδικός πρέπει να έχει τουλάχιστον 2 χαρακτήρες.")
    .regex(/^[A-Za-z0-9_-]+$/, "Ο κωδικός επιτρέπει μόνο γράμματα, αριθμούς, - και _."),
  type: z.enum(["percentage", "fixed"]),
});

const toCents = (v: FormDataEntryValue | null): number => {
  const raw = String(v ?? "").replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const optionalDate = (v: FormDataEntryValue | null): string | null => {
  const s = String(v ?? "").trim();
  return s ? new Date(s).toISOString() : null;
};

export async function saveDiscountAction(formData: FormData): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }

  const parsed = discountSchema.safeParse({
    code: formData.get("code"),
    type: formData.get("type"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  // A percentage is 0-100; a fixed amount is money and arrives in euros.
  const rawValue = String(formData.get("value") ?? "").replace(",", ".");
  const value =
    parsed.data.type === "percentage" ? Math.round(Number(rawValue)) : toCents(formData.get("value"));

  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: "Η αξία της έκπτωσης πρέπει να είναι μεγαλύτερη από μηδέν." };
  }
  if (parsed.data.type === "percentage" && value > 100) {
    return { ok: false, error: "Το ποσοστό έκπτωσης δεν μπορεί να ξεπερνά το 100%." };
  }

  const startsAt = optionalDate(formData.get("startsAt"));
  const endsAt = optionalDate(formData.get("endsAt"));
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return { ok: false, error: "Η ημερομηνία λήξης πρέπει να είναι μετά την έναρξη." };
  }

  const maxRaw = String(formData.get("maxRedemptions") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim() || undefined;

  try {
    const savedId = await saveDiscount({
      id,
      code: parsed.data.code,
      description: String(formData.get("description") ?? "").trim() || null,
      type: parsed.data.type,
      value,
      minSubtotalCents: toCents(formData.get("minSubtotal")),
      startsAt,
      endsAt,
      maxRedemptions: maxRaw ? Math.max(1, Number(maxRaw) || 1) : null,
      isActive: formData.get("isActive") === "on",
    });
    await auditLog(user.id, id ? "discount.update" : "discount.create", "discount", savedId, {
      code: parsed.data.code,
    });
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }

  revalidatePath("/admin/discounts");
  return { ok: true, message: id ? "Ο κωδικός ενημερώθηκε." : "Ο κωδικός δημιουργήθηκε." };
}

export async function deleteDiscountAction(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await admin();
  } catch {
    return { ok: false, error: "Η συνεδρία σου έληξε. Συνδέσου ξανά." };
  }
  try {
    const outcome = await deleteDiscount(id);
    await auditLog(user.id, `discount.${outcome}`, "discount", id);
    revalidatePath("/admin/discounts");
    return {
      ok: true,
      message:
        outcome === "deleted"
          ? "Ο κωδικός διαγράφηκε."
          : "Ο κωδικός απενεργοποιήθηκε — έχει χρησιμοποιηθεί σε παραγγελίες, οπότε διατηρείται στο ιστορικό.",
    };
  } catch (err) {
    return { ok: false, error: mapError(err) };
  }
}
