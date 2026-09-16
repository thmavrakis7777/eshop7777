import "server-only";
import { after } from "next/server";
import { siteUrl } from "@/lib/site-config";
import {
  claimRestockedNotifications,
  deleteStockNotification,
  releaseStockNotification,
} from "@/lib/db/stock-notifications";
import { sendBackInStockEmail } from "@/lib/email/send";

/**
 * Sends «Ενημέρωσέ με όταν παραληφθεί» emails for every pending request whose
 * variant has stock again. Scans rather than being told which variants
 * changed: the pending table is small and indexed, and a scan also picks up
 * anything a previous failed send released back into the queue.
 *
 * Never throws — it runs after an admin's stock change has already been
 * saved, and nothing here may turn that save into an error.
 */
export async function sendRestockNotifications(): Promise<void> {
  let claimed;
  try {
    claimed = await claimRestockedNotifications();
  } catch (err) {
    console.error("[stock-notify] CLAIM_FAILED", { error: err instanceof Error ? err.message : String(err) });
    return;
  }

  for (const n of claimed) {
    const title = n.variantTitle && n.variantTitle !== "Default" ? `${n.productTitle} – ${n.variantTitle}` : n.productTitle;
    let sent = false;
    try {
      sent = await sendBackInStockEmail(n.email, { title, url: `${siteUrl}/proionta/${n.productSlug}` });
    } catch (err) {
      console.error("[stock-notify] SEND_FAILED", { id: n.id, error: err instanceof Error ? err.message : String(err) });
    }
    // Sent: the address has served its one purpose and is removed. Not sent:
    // back in the queue for the next restock.
    if (sent) await deleteStockNotification(n.id);
    else await releaseStockNotification(n.id);
  }
}

/**
 * Called from every admin action that can put units back on the shelf:
 * variant save and quick stock edits (catalog-actions), bulk stock, the
 * inventory screen's stock edit (taxonomy-actions), and order cancellation or
 * permanent deletion, which return stock (sales-actions). Runs after the
 * response via after(), so a slow email provider never delays the save.
 */
export function scheduleRestockNotifications(): void {
  after(sendRestockNotifications);
}
