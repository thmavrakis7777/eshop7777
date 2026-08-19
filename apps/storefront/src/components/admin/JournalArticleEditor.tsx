"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUploadField } from "@/components/admin/ImageUploadField";
import { ProductPicker } from "@/components/admin/ProductPicker";
import { Card, SectionTitle, buttonStyles } from "@/components/admin/ui/primitives";
import {
  deleteJournalArticleAction,
  saveJournalArticleAction,
} from "@/lib/admin/journal-actions";
import { shopDateString } from "@/lib/dates";
import type { AdminJournalArticle, AdminJournalCategory } from "@/lib/admin/journal";

/**
 * The whole article, on one screen.
 *
 * Deliberately one long form rather than tabs: the owner's job here is to
 * write, and hiding the SEO fields behind a tab is how they end up never
 * being filled in. The order is the order the work happens in — write, then
 * illustrate, then decide when it goes live, then attach products, then SEO.
 *
 * No rich-text editor: see the long note in components/content/RichBody.tsx
 * for why (strict CSP, no dependency, no HTML to sanitise). The formatting
 * cheat-sheet under the body field is the whole learning curve.
 */

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

function Labeled({
  id,
  label,
  hint,
  children,
}: {
  id?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function JournalArticleEditor({
  article,
  categories,
  today,
}: {
  article: AdminJournalArticle;
  categories: AdminJournalCategory[];
  /**
   * Today's date in the shop's timezone, resolved on the server. Passed in
   * rather than read from `Date.now()` here: reading the clock during render
   * is impure (React would be free to re-render and get a different answer),
   * and this only ever drives one advisory line of copy.
   */
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [status, setStatus] = useState(article.status);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // shopDateString pins the timezone to Europe/Athens, so this is deterministic
  // on the server and in the browser alike — no hydration mismatch, and no
  // mount-time effect needed to reach the right zone.
  const [publishedDate, setPublishedDate] = useState(
    article.publishedAt ? shopDateString(article.publishedAt) : ""
  );

  // Plain string comparison is correct for ISO dates and, unlike Date.now(),
  // is pure.
  const scheduled = status === "published" && publishedDate > today;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await saveJournalArticleAction(article.id, data);
          setMsg(
            result.ok
              ? { ok: true, text: result.message ?? "Αποθηκεύτηκε." }
              : { ok: false, text: result.error }
          );
          if (result.ok) router.refresh();
        });
      }}
      className="flex flex-col gap-6"
    >
      {msg && (
        <div
          role="status"
          className={`rounded-md border px-4 py-2.5 text-sm ${
            msg.ok
              ? "border-success/30 bg-success/5 text-success"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      <Card>
        <SectionTitle hint="Ό,τι διαβάζει ο επισκέπτης">Περιεχόμενο</SectionTitle>
        <div className="flex flex-col gap-4">
          <Labeled id="j-title" label="Τίτλος (H1)">
            <input id="j-title" name="title" defaultValue={article.title} required className={field} />
          </Labeled>

          <Labeled
            id="j-slug"
            label="Slug (URL)"
            hint={`Η διεύθυνση του άρθρου: /journal/${article.slug}. Άλλαξέ το μόνο πριν δημοσιευτεί — μετά, μια αλλαγή σπάει τους υπάρχοντες συνδέσμους.`}
          >
            <input id="j-slug" name="slug" defaultValue={article.slug} className={field} />
          </Labeled>

          <Labeled
            id="j-excerpt"
            label="Εισαγωγή / Περίληψη"
            hint="2–3 προτάσεις. Εμφανίζεται στις κάρτες του Journal και χρησιμοποιείται ως meta description αν δεν συμπληρώσεις άλλη."
          >
            <textarea id="j-excerpt" name="excerpt" rows={3} defaultValue={article.excerpt ?? ""} className={field} />
          </Labeled>

          <Labeled id="j-body" label="Κείμενο άρθρου">
            <textarea
              id="j-body"
              name="body"
              rows={22}
              defaultValue={article.body ?? ""}
              placeholder="Γράψε εδώ το άρθρο. Οι κενές γραμμές δημιουργούν παραγράφους."
              className={`${field} font-mono text-[13px] leading-relaxed`}
            />
          </Labeled>

          <details className="rounded-md border border-border bg-surface/50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Πώς μορφοποιείται το κείμενο
            </summary>
            <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink-muted">
              <li><code className="text-ink">## Τίτλος ενότητας</code> — μεγάλη επικεφαλίδα (H2)</li>
              <li><code className="text-ink">### Υπότιτλος</code> — μικρότερη επικεφαλίδα (H3)</li>
              <li><code className="text-ink">- στοιχείο</code> — λίστα με κουκκίδες</li>
              <li><code className="text-ink">1. στοιχείο</code> — αριθμημένη λίστα</li>
              <li><code className="text-ink">&gt; παράθεμα</code> — τονισμένη φράση</li>
              <li><code className="text-ink">**έντονα**</code> — έντονα γράμματα</li>
              <li><code className="text-ink">[κείμενο](/kouzina)</code> — σύνδεσμος σε κατηγορία, προϊόν ή άλλο άρθρο</li>
              <li><code className="text-ink">[εικόνα: journal/abc.jpg | περιγραφή]</code> — εικόνα μέσα στο κείμενο</li>
            </ul>
            <p className="mt-3 text-xs text-ink-muted">
              Οι εσωτερικοί σύνδεσμοι είναι ο πιο εύκολος τρόπος να βοηθήσεις και τον αναγνώστη και το
              Google: σύνδεσε φυσικά προς κατηγορίες (<code>/kouzina</code>), προϊόντα
              (<code>/proionta/…</code>) και άλλα άρθρα (<code>/journal/…</code>).
            </p>
            <p className="mt-2 text-xs text-ink-muted">
              Για εικόνα μέσα στο κείμενο: ανέβασέ την στο πεδίο «Κύρια εικόνα» παρακάτω, αντίγραψε τη
              διαδρομή που εμφανίζεται και βάλ&apos; την στο <code>[εικόνα: … ]</code>.
            </p>
          </details>

          <Labeled
            id="j-author"
            label="Συντάκτης (προαιρετικό)"
            hint="Αν μείνει κενό, το άρθρο αποδίδεται στο κατάστημα."
          >
            <input id="j-author" name="author" defaultValue={article.author ?? ""} className={field} />
          </Labeled>
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      <Card>
        <SectionTitle hint="Η εικόνα στην κορυφή και στις κάρτες">Κύρια εικόνα</SectionTitle>
        <div className="flex flex-col gap-4">
          <Labeled id="j-hero" label="Εικόνα">
            <ImageUploadField
              id="j-hero"
              name="heroImagePath"
              defaultValue={article.heroImagePath}
              folder="journal"
            />
          </Labeled>
          <Labeled
            id="j-alt"
            label="Εναλλακτικό κείμενο (alt)"
            hint="Περιέγραψε τι δείχνει η εικόνα. Το διαβάζουν οι μηχανές αναζήτησης και οι αναγνώστες οθόνης."
          >
            <input
              id="j-alt"
              name="heroImageAlt"
              defaultValue={article.heroImageAlt ?? ""}
              className={field}
            />
          </Labeled>
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      <Card>
        <SectionTitle hint="Πότε και πού εμφανίζεται">Δημοσίευση</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled id="j-status" label="Κατάσταση">
            <select
              id="j-status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className={field}
            >
              <option value="draft">Πρόχειρο — δεν φαίνεται πουθενά</option>
              <option value="published">Δημοσιευμένο</option>
            </select>
          </Labeled>

          <Labeled
            id="j-published"
            label="Ημερομηνία δημοσίευσης"
            hint="Άφησέ την κενή για «τώρα». Βάλε μελλοντική ημερομηνία για προγραμματισμένη δημοσίευση — το άρθρο εμφανίζεται μόνο του εκείνο το πρωί."
          >
            <input
              id="j-published"
              name="publishedDate"
              type="date"
              value={publishedDate}
              onChange={(e) => setPublishedDate(e.target.value)}
              className={field}
            />
          </Labeled>

          <Labeled id="j-category" label="Κατηγορία">
            <select
              id="j-category"
              name="categoryId"
              defaultValue={article.categoryId ?? ""}
              className={field}
            >
              <option value="">— Χωρίς κατηγορία —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Labeled>

          <div className="flex items-end">
            <label className="flex items-center gap-2.5 pb-2 text-sm text-ink">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={article.isFeatured}
                className="h-4 w-4 accent-ink"
              />
              Κύριο άρθρο στη σελίδα Journal
            </label>
          </div>
        </div>

        {status === "published" && (
          <p className="mt-4 rounded-md bg-surface px-3 py-2 text-xs text-ink-muted">
            {scheduled
              ? "Προγραμματισμένο: το άρθρο θα εμφανιστεί αυτόματα μόλις φτάσει η ημερομηνία."
              : "Το άρθρο είναι ορατό στο κατάστημα και περιλαμβάνεται στο sitemap."}
          </p>
        )}
        {categories.length === 0 && (
          <p className="mt-4 text-xs text-ink-muted">
            Δεν έχεις κατηγορίες ακόμα —{" "}
            <Link href="/admin/journal/categories" className="underline">
              δημιούργησε την πρώτη
            </Link>
            .
          </p>
        )}
      </Card>

      {/* ------------------------------------------------------------------ */}
      <Card>
        <SectionTitle hint="Προαιρετικά — εμφανίζονται στο τέλος του άρθρου">
          Σχετικά προϊόντα
        </SectionTitle>
        <ProductPicker name="relatedProductSlugs" defaultSlugs={article.relatedProductSlugs} />
      </Card>

      {/* ------------------------------------------------------------------ */}
      <Card>
        <SectionTitle hint="Αν μείνουν κενά, χρησιμοποιείται ο τίτλος και η εισαγωγή">SEO</SectionTitle>
        <div className="flex flex-col gap-4">
          <Labeled id="j-seo-title" label="SEO τίτλος" hint="Ιδανικά έως 60 χαρακτήρες.">
            <input id="j-seo-title" name="seoTitle" defaultValue={article.seo.seoTitle ?? ""} className={field} />
          </Labeled>
          <Labeled
            id="j-seo-desc"
            label="Meta description"
            hint="Ιδανικά 120–160 χαρακτήρες. Αυτό διαβάζει ο χρήστης στα αποτελέσματα του Google."
          >
            <textarea
              id="j-seo-desc"
              name="metaDescription"
              rows={2}
              defaultValue={article.seo.metaDescription ?? ""}
              className={field}
            />
          </Labeled>
          <Labeled
            id="j-canonical"
            label="Canonical URL"
            hint="Άφησέ το κενό εκτός αν το ίδιο περιεχόμενο υπάρχει και σε άλλη διεύθυνση."
          >
            <input
              id="j-canonical"
              name="canonicalUrl"
              defaultValue={article.seo.canonicalUrl ?? ""}
              placeholder={`/journal/${article.slug}`}
              className={field}
            />
          </Labeled>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled id="j-og-title" label="Τίτλος για social">
              <input id="j-og-title" name="ogTitle" defaultValue={article.seo.ogTitle ?? ""} className={field} />
            </Labeled>
            <Labeled id="j-og-desc" label="Περιγραφή για social">
              <input
                id="j-og-desc"
                name="ogDescription"
                defaultValue={article.seo.ogDescription ?? ""}
                className={field}
              />
            </Labeled>
          </div>
          <Labeled
            id="j-social"
            label="Εικόνα για social (προαιρετικά)"
            hint="Αν μείνει κενή, χρησιμοποιείται η κύρια εικόνα."
          >
            <ImageUploadField
              id="j-social"
              name="socialImagePath"
              defaultValue={article.seo.socialImagePath}
              folder="journal"
            />
          </Labeled>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled id="j-keywords" label="Λέξεις-κλειδιά (προαιρετικά)">
              <input id="j-keywords" name="keywords" defaultValue={article.seo.keywords ?? ""} className={field} />
            </Labeled>
            <Labeled id="j-robots" label="Ευρετηρίαση">
              <select id="j-robots" name="robots" defaultValue={article.seo.robots} className={field}>
                <option value="index">Να εμφανίζεται στο Google</option>
                <option value="noindex">Να ΜΗΝ εμφανίζεται στο Google</option>
              </select>
            </Labeled>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------------ */}
      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t border-border bg-bg px-5 py-4 md:-mx-8 md:px-8">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? "Αποθήκευση…" : "Αποθήκευση"}
        </button>
        {article.status === "published" && (
          <a
            href={`/journal/${article.slug}`}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles.secondary}
          >
            Προβολή στο κατάστημα →
          </a>
        )}
        <Link href="/admin/journal" className={buttonStyles.ghost}>
          Πίσω στη λίστα
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-ink-muted">Οριστική διαγραφή;</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteJournalArticleAction(article.id, article.slug);
                    if (result.ok) router.push("/admin/journal");
                    else setMsg({ ok: false, text: result.error });
                  })
                }
                className={buttonStyles.danger}
              >
                Ναι, διάγραψε
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={buttonStyles.ghost}>
                Άκυρο
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={buttonStyles.ghost}>
              Διαγραφή άρθρου
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
