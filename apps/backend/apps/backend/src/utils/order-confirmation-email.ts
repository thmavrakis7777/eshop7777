// Plain utility, deliberately NOT under src/subscribers (Medusa's subscriber
// loader scans that directory and expects every file there to export a
// subscriber `config` — a template helper living there risks being picked
// up and failing to load). Table-based, inline-styled HTML: email clients
// (Gmail, Outlook) strip most CSS and don't support flexbox/grid, so this
// intentionally doesn't try to reuse the storefront's Tailwind classes —
// same brand colors (terracotta accent, warm ink), web-safe font stacks
// standing in for Inter/Literata (email clients can't be trusted to load
// either). No product images: PlaceholderTile stands in everywhere else in
// this project because there's no real product photography yet, and an
// <img> pointing at nothing would be worse than no image at all in an
// email — same anti-fabrication standard as everywhere else in this repo.

const ACCENT = "#b5502e"
const INK = "#2b2622"
const INK_MUTED = "#6b6259"
const BORDER = "#e5ddd3"
const SURFACE = "#f7f4ef"

function formatMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("el-GR", { style: "currency", currency: currencyCode.toUpperCase() }).format(amount)
}

// Every value interpolated into the template below is customer- or
// admin-entered free text (name, company name, activity, street, product
// title). Without escaping, an ampersand or an angle bracket in any of
// them corrupts the surrounding markup, and a deliberately crafted value
// injects arbitrary HTML into an email this store sends out.
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export type EmailOrderItem = {
  title: string
  sku: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type EmailAddress = {
  fullName: string
  addressLine1: string
  addressLine2?: string
  city: string
  postalCode: string
}

export type EmailInvoiceDetails = {
  companyName: string
  afm: string
  doy: string
  activity: string
}

export type OrderConfirmationEmailData = {
  displayId: number
  customerName: string
  email: string
  items: EmailOrderItem[]
  subtotal: number
  discountTotal: number
  shippingTotal: number
  taxTotal: number
  total: number
  currencyCode: string
  shippingMethodName: string
  paymentMethodName: string
  shippingAddress: EmailAddress
  billingAddress: EmailAddress
  taxDocumentType: "receipt" | "invoice"
  invoiceDetails?: EmailInvoiceDetails
}

function addressBlock(address: EmailAddress): string {
  return [
    address.fullName,
    address.addressLine2 ? `${address.addressLine1}, ${address.addressLine2}` : address.addressLine1,
    `${address.postalCode} ${address.city}`,
  ]
    .filter(Boolean)
    .map(esc)
    .join("<br>")
}

function itemRow(item: EmailOrderItem, currencyCode: string): string {
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};">
        <span style="font-size:14px;color:${INK};">${esc(item.title)}</span>
        ${item.sku ? `<br><span style="font-size:12px;color:${INK_MUTED};">Κωδικός: ${esc(item.sku)}</span>` : ""}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};text-align:center;font-size:13px;color:${INK_MUTED};white-space:nowrap;">
        ${item.quantity} × ${formatMoney(item.unitPrice, currencyCode)}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid ${BORDER};text-align:right;font-size:14px;color:${INK};white-space:nowrap;">
        ${formatMoney(item.lineTotal, currencyCode)}
      </td>
    </tr>`
}

function totalsRow(label: string, value: string, emphasize = false): string {
  return `
    <tr>
      <td style="padding:4px 0;font-size:${emphasize ? "16px" : "13px"};color:${emphasize ? INK : INK_MUTED};font-weight:${emphasize ? "600" : "400"};">${label}</td>
      <td style="padding:4px 0;text-align:right;font-size:${emphasize ? "16px" : "13px"};color:${INK};font-weight:${emphasize ? "600" : "400"};">${value}</td>
    </tr>`
}

export function buildOrderConfirmationEmail(order: OrderConfirmationEmailData): { subject: string; html: string } {
  const subject = `Η παραγγελία σου #${order.displayId} επιβεβαιώθηκε`

  const documentBlock =
    order.taxDocumentType === "invoice" && order.invoiceDetails
      ? `<p style="margin:0;font-size:13px;color:${INK_MUTED};line-height:1.6;">
           Τιμολόγιο — ${esc(order.invoiceDetails.companyName)}<br>
           ΑΦΜ: ${esc(order.invoiceDetails.afm)} · ΔΟΥ: ${esc(order.invoiceDetails.doy)}<br>
           ${esc(order.invoiceDetails.activity)}
         </p>`
      : `<p style="margin:0;font-size:13px;color:${INK_MUTED};">Απόδειξη</p>`

  const billingBlock =
    order.billingAddress.addressLine1 !== order.shippingAddress.addressLine1 ||
    order.billingAddress.postalCode !== order.shippingAddress.postalCode
      ? `<td style="padding:0 0 0 24px;width:50%;vertical-align:top;">
           <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${INK_MUTED};text-transform:uppercase;letter-spacing:.02em;">Στοιχεία χρέωσης</p>
           <p style="margin:0;font-size:13px;color:${INK_MUTED};line-height:1.6;">${addressBlock(order.billingAddress)}</p>
         </td>`
      : ""

  const html = `<!doctype html>
<html lang="el">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${SURFACE};font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:4px;overflow:hidden;max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:22px;letter-spacing:.08em;color:${INK};">STIA</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${INK};">Η παραγγελία σου ολοκληρώθηκε.</p>
              <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${INK_MUTED};">Παραγγελία #${order.displayId}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 16px;font-size:14px;color:${INK};">Γεια σου${order.customerName ? " " + esc(order.customerName) : ""},</p>
              <p style="margin:0;font-size:13px;color:${INK_MUTED};line-height:1.6;">
                Ευχαριστούμε για την παραγγελία σου. Παρακάτω θα βρεις όλα τα στοιχεία της.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${order.items.map((item) => itemRow(item, order.currencyCode)).join("")}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${totalsRow("Υποσύνολο", formatMoney(order.subtotal, order.currencyCode))}
                ${order.discountTotal > 0 ? totalsRow("Έκπτωση", `−${formatMoney(order.discountTotal, order.currencyCode)}`) : ""}
                ${totalsRow(`Μεταφορικά (${esc(order.shippingMethodName)})`, formatMoney(order.shippingTotal, order.currencyCode))}
                ${order.taxTotal > 0 ? totalsRow("ΦΠΑ", formatMoney(order.taxTotal, order.currencyCode)) : ""}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-top:1px solid ${BORDER};padding-top:8px;">
                ${totalsRow("Σύνολο", formatMoney(order.total, order.currencyCode), true)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:50%;vertical-align:top;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${INK_MUTED};text-transform:uppercase;letter-spacing:.02em;">Παράδοση σε</p>
                    <p style="margin:0;font-size:13px;color:${INK_MUTED};line-height:1.6;">${addressBlock(order.shippingAddress)}</p>
                  </td>
                  ${billingBlock}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${INK_MUTED};text-transform:uppercase;letter-spacing:.02em;">Παραστατικό</p>
              ${documentBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:${INK_MUTED};text-transform:uppercase;letter-spacing:.02em;">Τρόπος πληρωμής</p>
              <p style="margin:0;font-size:13px;color:${INK_MUTED};">${esc(order.paymentMethodName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 32px;font-family:Arial,Helvetica,sans-serif;text-align:center;">
              <p style="margin:0;font-size:12px;color:${INK_MUTED};">
                Χρειάζεσαι βοήθεια; Απάντησε σε αυτό το email ή επικοινώνησε μαζί μας.
              </p>
              <p style="margin:16px 0 0;font-size:11px;color:${ACCENT};letter-spacing:.04em;">STIA</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, html }
}
