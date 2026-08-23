import "server-only";
import { escapeHtml } from "@/lib/email/send-core";
import { siteUrl } from "@/lib/site-config";
import type { OrderEmailData } from "@/lib/db/order-email";

/**
 * HTML builders for the two transactional emails. Split out of send.ts
 * (which owns the Resend transport) purely so that file doesn't turn into an
 * 800-line mix of "how to call an API" and "how to lay out a table" — this
 * is still the one email service, not a second one.
 *
 * Table-based layout throughout, inline styles only, no media queries: the
 * target is Gmail/Outlook/Apple Mail rendering, which strip <style> blocks
 * and modern CSS unpredictably. A max-width:560px single column already
 * reads fine on a narrow phone screen without a responsive breakpoint.
 */

const INK = "#1c1b19";
const MUTED = "#6b6862";
const BORDER = "#e7e5e1";
const SURFACE = "#f6f5f3";

const money = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0">
    <tr><td style="border-radius:8px;background:${INK}">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:600;color:#fff;text-decoration:none">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

function productRow(item: OrderEmailData["items"][number]): string {
  const image = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" width="56" height="56" alt="${escapeHtml(item.title)}" style="display:block;width:56px;height:56px;border-radius:6px;object-fit:cover;background:${SURFACE}">`
    : `<div style="width:56px;height:56px;border-radius:6px;background:${SURFACE}"></div>`;

  return `<tr>
    <td style="padding:12px 0;border-bottom:1px solid ${BORDER}" width="56">${image}</td>
    <td style="padding:12px 0 12px 12px;border-bottom:1px solid ${BORDER};font-size:14px;color:${INK}">
      ${escapeHtml(item.title)}${item.variantTitle ? `<br><span style="font-size:12px;color:${MUTED}">${escapeHtml(item.variantTitle)}</span>` : ""}
      ${item.sku ? `<br><span style="font-size:11px;color:${MUTED}">SKU: ${escapeHtml(item.sku)}</span>` : ""}
      <br><span style="font-size:12px;color:${MUTED}">Ποσότητα: ${item.quantity} × ${money(item.unitPriceCents)}</span>
    </td>
    <td style="padding:12px 0;border-bottom:1px solid ${BORDER};font-size:14px;font-weight:600;color:${INK};text-align:right;white-space:nowrap" valign="top">
      ${money(item.lineTotalCents)}
    </td>
  </tr>`;
}

function summaryBlock(order: OrderEmailData): string {
  const netCents = order.totalCents - order.vatCents;
  const rows: string[] = [
    row("Υποσύνολο", money(order.subtotalCents)),
  ];
  if (order.discountCents > 0) {
    rows.push(row(order.discountCode ? `Έκπτωση (${order.discountCode})` : "Έκπτωση", `−${money(order.discountCents)}`));
  }
  // shipping_cents already reflects any heavy/oversized-item surcharge worked
  // out at checkout (lib/db/cart.ts computeTotals) — it is stored as one
  // number, not a base-cost-plus-surcharge pair, so one line is the honest
  // representation, not a fabricated split.
  rows.push(row(`Μεταφορικά${order.shippingMethodName ? ` (${escapeHtml(order.shippingMethodName)})` : ""}`, money(order.shippingCents)));

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;font-size:13px">
    ${rows.join("")}
    <tr><td colspan="2" style="padding-top:10px;border-top:1px solid ${BORDER}"></td></tr>
    <tr>
      <td style="padding:6px 0 0;font-size:16px;font-weight:700;color:${INK}">Σύνολο</td>
      <td style="padding:6px 0 0;font-size:16px;font-weight:700;color:${INK};text-align:right">${money(order.totalCents)}</td>
    </tr>
    <tr>
      <td colspan="2" style="padding-top:4px;font-size:11px;color:${MUTED}">
        Καθαρή αξία ${money(netCents)} · ΦΠΑ ${order.vatRate}% ${money(order.vatCents)}
      </td>
    </tr>
  </table>`;

  function row(label: string, value: string): string {
    return `<tr>
      <td style="padding:3px 0;color:${MUTED}">${label}</td>
      <td style="padding:3px 0;text-align:right;color:${INK}">${value}</td>
    </tr>`;
  }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = { cod: "Αντικαταβολή" };
function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

function addressBlock(address: OrderEmailData["shippingAddress"]): string {
  if (!address) return "";
  const name = [address.firstName, address.lastName].filter(Boolean).join(" ");
  return `<p style="margin:0;font-size:13px;line-height:1.6;color:${INK}">
    ${name ? `${escapeHtml(name)}<br>` : ""}
    ${escapeHtml(address.addressLine1)}${address.addressLine2 ? `, ${escapeHtml(address.addressLine2)}` : ""}<br>
    ${escapeHtml(address.postalCode)} ${escapeHtml(address.city)}
    ${address.phone ? `<br><span style="color:${MUTED}">${escapeHtml(address.phone)}</span>` : ""}
  </p>`;
}

function footer(storeName: string, contact: { phone: string | null; email: string | null; address: string | null }): string {
  const legalLinks = [
    ["Όροι Χρήσης", "/oroi-xrisis"],
    ["Πολιτική Απορρήτου", "/aporrito"],
    ["Πολιτική Cookies", "/cookies"],
  ]
    .map(([label, href]) => `<a href="${siteUrl}${href}" style="color:${MUTED};text-decoration:underline">${label}</a>`)
    .join(" · ");

  return `<tr><td style="padding:28px 32px 0">
    <div style="border-top:1px solid ${BORDER};padding-top:20px;font-size:12px;line-height:1.8;color:${MUTED}">
      <strong style="color:${INK}">${escapeHtml(storeName)}</strong><br>
      ${contact.address ? `${escapeHtml(contact.address)}<br>` : ""}
      ${[contact.phone, contact.email].filter((v): v is string => Boolean(v)).map(escapeHtml).join(" · ")}
      <div style="margin-top:10px">${legalLinks}</div>
    </div>
  </td></tr>`;
}

function shell(opts: { previewText: string; bodyHtml: string; storeName: string; contact: { phone: string | null; email: string | null; address: string | null } }): string {
  return `<!doctype html>
<html lang="el">
<body style="margin:0;padding:0;background:${SURFACE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
        <tr><td style="padding:32px 32px 8px;text-align:center">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:0.04em;color:${INK}">${escapeHtml(opts.storeName.toUpperCase())}</div>
        </tr></td>
        <tr><td style="padding:8px 32px 32px">${opts.bodyHtml}</td></tr>
        ${footer(opts.storeName, opts.contact)}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function orderConfirmationHtml(
  order: OrderEmailData,
  ctx: { storeName: string; contact: { phone: string | null; email: string | null; address: string | null }; orderUrl: string }
): string {
  const itemRows = order.items.map(productRow).join("");
  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:${INK}">Ευχαριστούμε για την παραγγελία σου!</h1>
    <p style="margin:0 0 20px;font-size:14px;color:${MUTED}">Παραγγελία <strong style="color:${INK}">#${order.orderNumber}</strong> · ${escapeHtml(order.createdAtFormatted)}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows}</table>
    ${summaryBlock(order)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px">
      <tr>
        <td width="50%" valign="top" style="padding-right:10px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:${MUTED};text-transform:uppercase;margin-bottom:6px">Τρόπος πληρωμής</div>
          <p style="margin:0;font-size:13px;color:${INK}">${escapeHtml(paymentMethodLabel(order.paymentMethod))}</p>
        </td>
        <td width="50%" valign="top" style="padding-left:10px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:${MUTED};text-transform:uppercase;margin-bottom:6px">Παράδοση σε</div>
          ${addressBlock(order.shippingAddress)}
        </td>
      </tr>
    </table>

    ${ctaButton("Δείτε την παραγγελία σας", ctx.orderUrl)}

    <p style="margin:16px 0 0;font-size:13px;line-height:1.7;color:${MUTED}">
      Σας ευχαριστούμε θερμά που επιλέξατε το ${escapeHtml(ctx.storeName)}. Ετοιμάζουμε την παραγγελία σας
      και θα σας ενημερώσουμε μόλις αποσταλεί.
    </p>`;

  return shell({
    previewText: `Η παραγγελία σου #${order.orderNumber} καταχωρήθηκε επιτυχώς.`,
    bodyHtml: body,
    storeName: ctx.storeName,
    contact: ctx.contact,
  });
}

export function orderConfirmationText(order: OrderEmailData, ctx: { storeName: string; orderUrl: string }): string {
  const lines = order.items.map((i) => `${i.title} × ${i.quantity} — ${money(i.lineTotalCents)}`);
  const netCents = order.totalCents - order.vatCents;
  return [
    `Ευχαριστούμε για την παραγγελία σου!`,
    ``,
    `Παραγγελία #${order.orderNumber} · ${order.createdAtFormatted}`,
    ``,
    ...lines,
    ``,
    `Υποσύνολο: ${money(order.subtotalCents)}`,
    order.discountCents > 0 ? `Έκπτωση: −${money(order.discountCents)}` : null,
    `Μεταφορικά: ${money(order.shippingCents)}`,
    `Σύνολο: ${money(order.totalCents)} (Καθαρή αξία ${money(netCents)}, ΦΠΑ ${order.vatRate}% ${money(order.vatCents)})`,
    ``,
    `Τρόπος πληρωμής: ${paymentMethodLabel(order.paymentMethod)}`,
    ``,
    `Δείτε την παραγγελία σας: ${ctx.orderUrl}`,
    ``,
    `Σας ευχαριστούμε θερμά που επιλέξατε το ${ctx.storeName}. Ετοιμάζουμε την παραγγελία σας και θα σας ενημερώσουμε μόλις αποσταλεί.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function shipmentNotificationHtml(
  order: OrderEmailData,
  ctx: { storeName: string; contact: { phone: string | null; email: string | null; address: string | null }; orderUrl: string }
): string {
  const trackingSection = order.trackingUrl
    ? ctaButton("Παρακολούθηση αποστολής", order.trackingUrl)
    : `<p style="margin:16px 0 0;font-size:13px;color:${MUTED}">Κωδικός αποστολής: <strong style="color:${INK};font-family:monospace">${escapeHtml(order.trackingCode ?? "")}</strong></p>`;

  const body = `
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:${INK}">Η παραγγελία σου απεστάλη!</h1>
    <p style="margin:0 0 20px;font-size:14px;color:${MUTED}">Παραγγελία <strong style="color:${INK}">#${order.orderNumber}</strong></p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};border-radius:10px">
      <tr><td style="padding:18px 20px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:${MUTED};text-transform:uppercase;margin-bottom:8px">Στοιχεία αποστολής</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px">
          <tr><td style="padding:2px 0;color:${MUTED}">Εταιρεία μεταφοράς</td><td style="padding:2px 0;text-align:right;color:${INK};font-weight:600">${escapeHtml(order.courierName ?? "")}</td></tr>
          <tr><td style="padding:2px 0;color:${MUTED}">Κωδικός αποστολής</td><td style="padding:2px 0;text-align:right;color:${INK};font-family:monospace">${escapeHtml(order.trackingCode ?? "")}</td></tr>
        </table>
      </td></tr>
    </table>

    ${trackingSection}

    <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:${MUTED}">
      Η παραγγελία σου βρίσκεται καθ' οδόν προς εσένα. Αν χρειαστείς βοήθεια με την παραλαβή, επικοινώνησε μαζί μας.
    </p>`;

  return shell({
    previewText: `Η παραγγελία σου #${order.orderNumber} απεστάλη.`,
    bodyHtml: body,
    storeName: ctx.storeName,
    contact: ctx.contact,
  });
}

export function shipmentNotificationText(order: OrderEmailData, ctx: { storeName: string; orderUrl: string }): string {
  return [
    `Η παραγγελία σου απεστάλη!`,
    ``,
    `Παραγγελία #${order.orderNumber}`,
    ``,
    `Εταιρεία μεταφοράς: ${order.courierName ?? ""}`,
    `Κωδικός αποστολής: ${order.trackingCode ?? ""}`,
    order.trackingUrl ? `Παρακολούθηση: ${order.trackingUrl}` : null,
    ``,
    `Δείτε την παραγγελία σας: ${ctx.orderUrl}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
