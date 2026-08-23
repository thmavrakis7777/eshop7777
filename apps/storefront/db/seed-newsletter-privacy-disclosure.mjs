// One-time content update for the Privacy Policy (slug: aporrito) to
// disclose newsletter-signup processing (QA-005). Splices two additions
// into the existing body rather than overwriting it, so any edits the owner
// has already made to unrelated sections in the dashboard are preserved.
// Idempotent: does nothing if the newsletter text is already present, so
// re-running after the owner edits this page again is safe.
import fs from "node:fs";
import postgres from "postgres";

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const local = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const match = local.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (!match) throw new Error("DATABASE_URL is not set (checked env, .env.local)");
  return match;
}

const sql = postgres(databaseUrl(), { ssl: "require", prepare: false });

const [page] = await sql`SELECT id, body FROM shop.content_page WHERE slug = 'aporrito'`;
if (!page) throw new Error("aporrito content page not found");

let body = page.body;
const marker = "Αποστολή ενημερωτικού newsletter";

if (body.includes(marker)) {
  console.log("Already present — no change.");
} else {
  // 1. New bullet in "Ποια Δεδομένα Συλλέγουμε".
  const dataBullet =
    "- **Δεδομένα επικοινωνίας**, όταν μας στέλνετε μήνυμα μέσω φόρμας επικοινωνίας ή email.";
  const dataBulletWithNewsletter =
    dataBullet +
    "\n- **Email εγγραφής στο newsletter**, μόνο εφόσον εγγραφείτε οικειοθελώς μέσω της φόρμας στην αρχική σελίδα.";
  if (!body.includes(dataBullet)) throw new Error("Expected data-bullet anchor text not found — aborting.");
  body = body.replace(dataBullet, dataBulletWithNewsletter);

  // 2. New row in the "Σκοπός & Νομική Βάση Επεξεργασίας" table.
  const tableRow = "| Απάντηση σε αίτημα επικοινωνίας | Έννομο συμφέρον / συγκατάθεση |";
  const tableRowWithNewsletter =
    tableRow + "\n| Αποστολή ενημερωτικού newsletter | Συγκατάθεσή σας (άρ. 6§1α ΓΚΠΔ) |";
  if (!body.includes(tableRow)) throw new Error("Expected table-row anchor text not found — aborting.");
  body = body.replace(tableRow, tableRowWithNewsletter);

  await sql`UPDATE shop.content_page SET body = ${body}, updated_at = now() WHERE id = ${page.id}`;
  console.log("Updated aporrito with newsletter disclosure.");
}

await sql.end();
