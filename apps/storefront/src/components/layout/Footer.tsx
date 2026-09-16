import Link from "next/link";
import {
  FacebookIcon,
  InstagramIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  TikTokIcon,
  WhatsAppIcon,
} from "@/components/ui/Icons";
import { StoreLogo } from "./StoreLogo";
import { CookieSettingsLink } from "./CookieSettingsLink";
import { FooterNewsletterForm } from "./FooterNewsletterForm";
import type { SiteSettings } from "@/lib/data/site-settings";
import type { NavCategory } from "@/lib/types";
import { googleMapsSearchUrl } from "@/lib/maps";
import { formatWhatsappPhone, isValidWhatsappPhone, normalizeWhatsappPhone } from "@/lib/whatsapp";

const DEFAULT_TAGLINE =
  "Προϊόντα για κουζίνα, μπάνιο, αποθήκευση και κήπο — σχεδιασμένα να διαρκούν, φτιαγμένα για την καθημερινότητά σου.";

const helpLinks = [
  { label: "Παρακολούθηση Παραγγελίας", href: "/paraggelia" },
  { label: "Συχνές Ερωτήσεις", href: "/faq" },
  { label: "Επικοινωνία", href: "/epikoinonia" },
];

// Journal lives here and ONLY here in the site chrome. The header's job is
// shopping (categories, offers, new arrivals) and adding an editorial section
// to it would dilute that; the footer is a real, crawlable internal link on
// every page, which is what the section needs to be discovered and indexed.
const companyLinks = [
  { label: "Σχετικά με εμάς", href: "/sxetika" },
  { label: "Journal", href: "/journal" },
  { label: "Οδηγοί Αγορών", href: "/odigoi-agoron" },
  { label: "Καριέρα", href: "/karieres" },
];

// Display order for the ΝΟΜΙΚΑ column — filtered against `legalPages`
// (actually-published slugs) below, so an unpublished page never appears as
// a dead link. Αποστολές and Επιστροφές live here rather than in "Βοήθεια":
// they're compliance-relevant pages (shipping cost transparency, statutory
// withdrawal rights), not just help articles.
const LEGAL_LINK_ORDER = [
  { slug: "oroi-xrisis", label: "Όροι Χρήσης" },
  { slug: "aporrito", label: "Πολιτική Απορρήτου" },
  { slug: "cookies", label: "Πολιτική Cookies" },
  { slug: "epistrofes", label: "Επιστροφές & Υπαναχώρηση" },
  { slug: "apostoles", label: "Αποστολές" },
  { slug: "pliromes", label: "Πληρωμές" },
  { slug: "eggyisi", label: "Εγγυήσεις" },
];

const heading = "text-sm font-medium text-ink";
const contactLink = "inline-flex min-w-0 items-start gap-2.5 text-ink-muted transition-colors hover:text-ink";
const contactIcon = "mt-0.5 h-4 w-4 shrink-0";

/**
 * Two rows. Top: who we are (brand, social, newsletter) | how to reach us.
 * Bottom: the four link columns. Everything the top row shows comes from Settings
 * (Content → Header & Footer), and each block hides itself when its settings
 * are empty, so an unconfigured store never renders an empty heading.
 */
export function Footer({
  categories,
  settings,
  storeName,
  logoUrl,
  legalPages,
}: {
  categories: NavCategory[];
  settings: SiteSettings | null;
  storeName: string;
  logoUrl: string | null;
  // Only slugs actually is_published=true — see getPublishedLegalPages().
  legalPages: { slug: string; title: string }[];
}) {
  const publishedSlugs = new Set(legalPages.map((p) => p.slug));
  const legalLinks = LEGAL_LINK_ORDER.filter((l) => publishedSlugs.has(l.slug)).map((l) => ({
    label: l.label,
    href: `/${l.slug}`,
  }));
  const socialLinks = [
    { href: settings?.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings?.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings?.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
  ].filter((s): s is { href: string; label: string; Icon: typeof FacebookIcon } => Boolean(s.href));

  // Same validity rule as the stock-inquiry WhatsApp button, so the footer
  // never links a number that button would refuse.
  const whatsapp =
    settings?.whatsappPhone && isValidWhatsappPhone(settings.whatsappPhone) ? settings.whatsappPhone : null;
  const mapsUrl = googleMapsSearchUrl(settings?.contactAddress);
  const hasContact = settings?.contactPhone || whatsapp || settings?.contactEmail || settings?.contactAddress;

  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-shell py-12">
        {/* md: brand spans the row, contact goes on the next one.
            lg: side by side on a 12-column track. */}
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="md:col-span-2 lg:col-span-5">
            <StoreLogo storeName={storeName} logoUrl={logoUrl} href={null} className="font-display text-xl text-ink" />
            <p className="mt-3 max-w-sm whitespace-pre-line text-sm text-ink-muted">
              {settings?.footerTagline || DEFAULT_TAGLINE}
            </p>

            {socialLinks.length > 0 && (
              <div className="mt-5">
                <h3 className={heading}>Ακολουθήστε μας</h3>
                <div className="mt-2.5 flex items-center gap-2">
                  {socialLinks.map(({ href, label, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-ink-muted transition-colors hover:border-ink/40 hover:text-ink"
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className={heading}>Newsletter</h3>
              <p className="mt-1 text-xs text-ink-muted">Εγγράψου για νέα προϊόντα και προσφορές.</p>
              <FooterNewsletterForm />
              <p className="mt-2 max-w-xs text-[11px] text-ink-muted">
                Με την εγγραφή αποδέχεσαι την{" "}
                <Link href="/aporrito" className="underline hover:text-ink">
                  Πολιτική Απορρήτου
                </Link>
                .
              </p>
            </div>
          </div>

          {hasContact && (
            <div className="lg:col-span-3">
              <h3 className={heading}>Επικοινωνία</h3>
              <ul className="mt-3 flex flex-col gap-3 text-sm">
                {settings?.contactPhone && (
                  <li>
                    <a href={`tel:${settings.contactPhone}`} className={contactLink}>
                      <PhoneIcon className={contactIcon} />
                      <span className="tabular-nums">{settings.contactPhone}</span>
                    </a>
                  </li>
                )}
                {whatsapp && (
                  <li>
                    <a
                      href={`https://wa.me/${normalizeWhatsappPhone(whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={contactLink}
                    >
                      <WhatsAppIcon className={contactIcon} />
                      <span>
                        WhatsApp <span className="tabular-nums">{formatWhatsappPhone(whatsapp)}</span>
                      </span>
                    </a>
                  </li>
                )}
                {settings?.contactEmail && (
                  <li>
                    <a href={`mailto:${settings.contactEmail}`} className={contactLink}>
                      <MailIcon className={contactIcon} />
                      <span className="break-all">{settings.contactEmail}</span>
                    </a>
                  </li>
                )}
                {settings?.contactAddress && (
                  <li className="flex items-start gap-2.5 text-ink-muted">
                    <MapPinIcon className={contactIcon} />
                    <span>
                      <span className="whitespace-pre-line">{settings.contactAddress}</span>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block text-xs underline underline-offset-2 transition-colors hover:text-ink"
                        >
                          Οδηγίες στον χάρτη
                        </a>
                      )}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Two independent mobile stacks (md:contents flattens each wrapper
            back into the 4-column grid at md+ — md:order restores the
            K/B/E/N reading order once that happens). Below md, grid-cols-2
            alone would row-pair Κατηγορίες with Βοήθεια: since row height is
            set by the taller cell, Κατηγορίες' 7 links forced a tall row that
            left a large dead gap under Βοήθεια's 3 links before Νομικά.
            Stacking Κατηγορίες+Εταιρεία and Βοήθεια+Νομικά in their own
            flex-col makes each column's height depend only on its own two
            lists, closing that gap. */}
        <div className="mt-10 grid grid-cols-2 gap-8 border-t border-border pt-10 md:grid-cols-4">
          <div className="flex flex-col gap-8 md:contents">
            <FooterColumn
              className="md:order-1"
              title="Κατηγορίες"
              links={categories.map((c) => ({ label: c.name, href: `/${c.handle}` }))}
            />
            <FooterColumn className="md:order-3" title="Εταιρεία" links={companyLinks} />
          </div>
          <div className="flex flex-col gap-8 md:contents">
            <FooterColumn className="md:order-2" title="Βοήθεια" links={helpLinks} />
            <FooterColumn className="md:order-4" title="Νομικά" links={legalLinks} />
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-shell flex flex-col gap-4 py-6 text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>© {new Date().getFullYear()} {storeName}. Με επιφύλαξη παντός δικαιώματος.</span>
            <CookieSettingsLink />
          </span>
          {/* Only methods checkout can actually process — the one configured
              Medusa provider is pp_system_default ("Αντικαταβολή"). Listing
              Visa/Mastercard/Viva Wallet here advertised card payments the
              store cannot take. */}
          <div className="flex items-center gap-3" aria-label="Αποδεκτοί τρόποι πληρωμής">
            {["Αντικαταβολή"].map((p) => (
              <span key={p} className="rounded-sm border border-border bg-bg px-2 py-1">
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  className,
}: {
  title: string;
  links: { label: string; href: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className={heading}>{title}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-ink-muted hover:text-ink transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
