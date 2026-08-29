import { headers } from "next/headers";
import Link from "next/link";
import { Breadcrumbs, type Crumb } from "@/components/category/Breadcrumbs";
import { renderBody } from "@/components/content/ContentPageView";
import { telHref } from "@/components/layout/PhoneOrders";
import { categoryPathHref } from "@/lib/data/categories";
import { getSiteSettings } from "@/lib/data/site-settings";
import { safeJsonLd } from "@/lib/json-ld";
import { siteUrl } from "@/lib/site-config";
import { publicImageUrl } from "@/lib/storage/urls";
import type { Category, FaqItem } from "@/lib/types";

/**
 * Renders a 'landing' category (see migration 0010) — a real service the
 * store offers in its physical shop rather than a product listing. Sibling
 * to CategoryPLPView, not a variant of it: a product grid and a service page
 * share almost nothing structurally (no sort control, no pagination, no
 * empty-product-count message that would be actively wrong here).
 *
 * Only the intro paragraph, the optional hero image and the FAQ come from
 * the category row (admin-editable, see CategoryManager). The "Τι Κλειδιά
 * Αντιγράφουμε" and "Γιατί MAVRAKIS HOME" sections are curated copy baked
 * into this component — they describe the shop's actual services, not data
 * an owner would reasonably need to rewrite from the dashboard day to day.
 */

function buildLocalBusinessJsonLd(params: {
  pageUrl: string;
  pageTitle: string;
  storeName: string;
  phone: string | null;
  address: string | null;
}) {
  const { pageUrl, pageTitle, storeName, phone, address } = params;
  return {
    "@context": "https://schema.org",
    // Locksmith is schema.org's own LocalBusiness subtype for exactly this
    // service — more precise than a generic LocalBusiness/Organization.
    "@type": "Locksmith",
    name: storeName,
    url: pageUrl,
    ...(phone ? { telephone: `+30${phone.replace(/\D/g, "")}` } : {}),
    ...(address
      ? {
          // The address is stored as one free-text line in Site Settings
          // (no separate street/postcode/city fields exist), so it goes into
          // streetAddress whole rather than guessing a split that could be
          // wrong — better an unsegmented but correct address than an
          // invented one.
          address: { "@type": "PostalAddress", streetAddress: address, addressCountry: "GR" },
        }
      : {}),
    areaServed: "Ηράκλειο, Κρήτη",
    description: pageTitle,
  };
}

function buildFaqPageJsonLd(faq: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    // Mapped 1:1 from the same array the page renders below — this can
    // never drift into listing a question that isn't actually on the page.
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export async function CategoryLandingView({
  category,
  ancestors,
}: {
  category: Category;
  /**
   * Outermost first. Takes the whole chain rather than just the immediate
   * parent so a landing category keeps working if it is ever nested deeper
   * than the one level it sits at today — same reason the PLP route does.
   */
  ancestors: Category[];
}) {
  const [settings, nonce] = await Promise.all([
    getSiteSettings(),
    headers().then((h) => h.get("x-nonce") ?? undefined),
  ]);

  const storeName = settings?.storeName || "MAVRAKIS HOME";
  const phone = settings?.contactPhone ?? null;
  const address = settings?.contactAddress ?? null;
  const faq = category.faq ?? [];

  const trail = [...ancestors, category];
  const breadcrumbs: Crumb[] = trail.map((c, i) => ({
    label: c.name,
    href: categoryPathHref(trail.slice(0, i), c),
  }));
  const pageUrl = `${siteUrl}${categoryPathHref(ancestors, category)}`;
  const parent = ancestors.at(-1);

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            buildLocalBusinessJsonLd({ pageUrl, pageTitle: category.name, storeName, phone, address })
          ),
        }}
      />
      {faq.length > 0 && (
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: safeJsonLd(buildFaqPageJsonLd(faq)) }}
        />
      )}

      <Breadcrumbs items={breadcrumbs} />

      <div className="container-shell mt-4 max-w-3xl">
        <h1 className="font-display text-3xl text-ink md:text-4xl">{category.name}</h1>

        {/* imagePath is a bucket-relative path, not a URL — resolving it
            through publicImageUrl() is what makes an uploaded (as opposed to
            pasted-external-URL) hero image actually render. */}
        {publicImageUrl(category.imagePath) && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-entered path/URL, not a known-dimension local asset worth next/image's config for a single optional hero.
          <img
            src={publicImageUrl(category.imagePath)!}
            alt={`${category.name} στο ${storeName}`}
            className="mt-6 w-full rounded-lg object-cover"
          />
        )}

        {category.description && (
          <div className="mt-6 flex flex-col gap-4 text-base leading-relaxed text-ink-muted">
            {renderBody(category.description)}
          </div>
        )}
      </div>

      <section className="container-shell mt-16 max-w-3xl">
        <h2 className="font-display text-xl text-ink md:text-2xl">Τι Κλειδιά Αντιγράφουμε</h2>
        <div className="mt-6 flex flex-col gap-6">
          {KEY_SERVICES.map((s) => (
            <div key={s.title}>
              <h3 className="text-base font-medium text-ink">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-shell mt-16 max-w-3xl">
        <h2 className="font-display text-xl text-ink md:text-2xl">
          Γιατί να Επιλέξετε το {storeName} στο Ηράκλειο
        </h2>
        <ul className="mt-6 flex flex-col gap-3">
          {WHY_US.map((point) => (
            <li key={point} className="flex items-start gap-2.5 text-sm text-ink-muted">
              <span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section id="contact" className="container-shell mt-16 max-w-3xl scroll-mt-24">
        <div className="rounded-lg bg-surface p-6 md:p-10">
          <h2 className="font-display text-xl text-ink md:text-2xl">Χρειάζεστε Αντιγραφή Κλειδιού;</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Επισκεφθείτε το κατάστημά μας στο Ηράκλειο ή καλέστε μας για οποιαδήποτε απορία σχετικά με την
            αντιγραφή του κλειδιού σας.
          </p>
          <div className="mt-5 flex flex-col gap-2 text-sm">
            {address && <p className="text-ink">{address}</p>}
            {phone && (
              // -my-1.5 py-1.5 grows the tap target to the WCAG 2.2 24px
              // minimum without adding visible spacing — same trick as the
              // announcement bar's phone link (PhoneOrders.tsx).
              <a
                href={telHref(phone)}
                className="-my-1.5 inline-block w-fit py-1.5 font-medium text-accent hover:underline"
              >
                {phone}
              </a>
            )}
          </div>
        </div>
      </section>

      {faq.length > 0 && (
        <section className="container-shell mt-16 max-w-3xl">
          <h2 className="font-display text-xl text-ink md:text-2xl">Συχνές Ερωτήσεις</h2>
          <div className="mt-6 flex flex-col divide-y divide-border border-t border-border">
            {faq.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer list-none text-sm font-medium text-ink marker:content-none">
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span aria-hidden="true" className="shrink-0 text-ink-muted group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {parent && (
        <div className="container-shell mt-16 max-w-3xl pb-16 text-sm text-ink-muted">
          Δείτε επίσης όλα τα{" "}
          <Link
            href={categoryPathHref(ancestors.slice(0, -1), parent)}
            className="text-ink underline underline-offset-2 hover:text-accent"
          >
            {parent.name.toLowerCase()}
          </Link>
          .
        </div>
      )}
    </>
  );
}

const KEY_SERVICES = [
  {
    title: "Απλά Κλειδιά Σπιτιού & Παραθύρων",
    body: "Η πιο συνηθισμένη περίπτωση: κλειδιά εσωτερικών και εξωτερικών πορτών, παραθύρων και ερμαρίων. Η αντιγραφή γίνεται με σύγχρονα μηχανήματα κοπής, με προσοχή στη λεπτομέρεια ώστε το αντίγραφο να ταιριάζει απόλυτα στην κλειδαριά.",
  },
  {
    title: "Κλειδιά Ασφαλείας & Θωρακισμένης Πόρτας",
    body: "Για κλειδιά ασφαλείας και θωρακισμένων πορτών, η δυνατότητα αντιγραφής εξαρτάται από τον τύπο και τον κατασκευαστή του συστήματος — ορισμένα συστήματα είναι πατενταρισμένα και απαιτούν ειδική εξουσιοδότηση. Φέρτε το κλειδί σας στο κατάστημα και θα σας ενημερώσουμε άμεσα αν είναι εφικτή η αντιγραφή.",
  },
  {
    title: "Ηλεκτρονικά Μπρελόκ & Κάρτες Εισόδου",
    body: "Αντιγράφουμε επίσης ηλεκτρονικά μπρελόκ και κάρτες εισόδου για πολυκατοικίες, κατοικίες και καταλύματα (όπως Airbnb), όπου η συμβατότητα το επιτρέπει. Επειδή υπάρχουν πολλά διαφορετικά συστήματα ελέγχου πρόσβασης, επικοινωνήστε μαζί μας ή περάστε από το κατάστημα για να επιβεβαιώσουμε τη συμβατότητα πριν την αντιγραφή.",
  },
  {
    title: "Κλειδιά Γραμματοκιβωτίων & Λουκέτων",
    body: "Αντιγραφή κλειδιών για γραμματοκιβώτια, λουκέτα και μικρότερες κλειδαριές — μια απλή, γρήγορη λύση όταν χρειάζεστε ένα επιπλέον κλειδί ή αντικαθιστάτε ένα φθαρμένο.",
  },
];

const WHY_US = [
  "Σύγχρονος εξοπλισμός κοπής κλειδιών, για ακρίβεια σε κάθε αντίγραφο.",
  "Άμεση εξυπηρέτηση στο φυσικό μας κατάστημα, χωρίς περιττή αναμονή.",
  "Ανταγωνιστικές τιμές για κάθε τύπο κλειδιού.",
  "Τοπική εξυπηρέτηση στο Ηράκλειο, με γνώση των αναγκών της περιοχής.",
];
