// Same shell/brand pattern as order-confirmation-email.ts — table-based,
// inline-styled HTML (email clients strip CSS/flexbox), same brand colors.
// Deliberately NOT under src/subscribers, same reason as that file.

const ACCENT = "#b5502e"
const INK = "#2b2622"
const INK_MUTED = "#6b6259"
const SURFACE = "#f7f4ef"

// The reset link itself carries the token as a query param — nothing here
// is free text except the destination URL, which is built from siteUrl +
// a fixed path + the token, never customer input, so no HTML-escaping is
// needed the way order-confirmation-email.ts needs it for names/addresses.
export type ResetPasswordEmailData = {
  resetUrl: string
}

export function buildResetPasswordEmail({ resetUrl }: ResetPasswordEmailData): { subject: string; html: string } {
  const subject = "Επαναφορά κωδικού πρόσβασης"

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
              <p style="margin:0;font-size:22px;letter-spacing:.08em;color:${INK};">STIA</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 16px;font-size:14px;color:${INK};">Ζητήθηκε επαναφορά του κωδικού πρόσβασής σου.</p>
              <p style="margin:0 0 24px;font-size:13px;color:${INK_MUTED};line-height:1.6;">
                Πάτησε το παρακάτω κουμπί για να ορίσεις νέο κωδικό. Ο σύνδεσμος ισχύει για 15 λεπτά.
                Αν δεν ζήτησες εσύ επαναφορά κωδικού, αγνόησε αυτό το email — ο κωδικός σου παραμένει ο ίδιος.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:4px;background:${ACCENT};">
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Ορισμός νέου κωδικού
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:${INK_MUTED};line-height:1.6;">
                Αν το κουμπί δεν λειτουργεί, αντίγραψε αυτόν τον σύνδεσμο στον browser σου:<br>
                <span style="word-break:break-all;">${resetUrl}</span>
              </p>
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
