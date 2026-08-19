import Link from "next/link";
import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/ui/Icons";
import { StoreLogo } from "./StoreLogo";
import type { SiteSettings } from "@/lib/data/site-settings";
import type { NavCategory } from "@/lib/types";

const DEFAULT_TAGLINE =
  "Προϊόντα για κουζίνα, μπάνιο, αποθήκευση και κήπο — σχεδιασμένα να διαρκούν, φτιαγμένα για την καθημερινότητά σου.";

const helpLinks = [
  { label: "Παρακολούθηση Παραγγελίας", href: "/paraggelia" },
  { label: "Αποστολές & Παράδοση", href: "/apostoles" },
  { label: "Επιστροφές & Αλλαγές", href: "/epistrofes" },
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

const legalLinks = [
  { label: "Όροι Χρήσης", href: "/oroi-xrisis" },
  { label: "Πολιτική Απορρήτου", href: "/aporrito" },
  { label: "Πολιτική Cookies", href: "/cookies" },
];

export function Footer({
  categories,
  settings,
  storeName,
  logoUrl,
}: {
  categories: NavCategory[];
  settings: SiteSettings | null;
  storeName: string;
  logoUrl: string | null;
}) {
  const hasContact = settings?.contactPhone || settings?.contactEmail || settings?.contactAddress;
  const socialLinks = [
    { href: settings?.facebookUrl, label: "Facebook", Icon: FacebookIcon },
    { href: settings?.instagramUrl, label: "Instagram", Icon: InstagramIcon },
    { href: settings?.tiktokUrl, label: "TikTok", Icon: TikTokIcon },
  ].filter((s): s is { href: string; label: string; Icon: typeof FacebookIcon } => Boolean(s.href));

  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-shell grid grid-cols-2 gap-8 py-12 md:grid-cols-4 lg:grid-cols-6">
        <div className="col-span-2">
          <StoreLogo storeName={storeName} logoUrl={logoUrl} href={null} className="font-display text-xl text-ink" />
          <p className="mt-3 max-w-xs whitespace-pre-line text-sm text-ink-muted">
            {settings?.footerTagline || DEFAULT_TAGLINE}
          </p>

          {hasContact && (
            <ul className="mt-4 flex flex-col gap-1 text-sm text-ink-muted">
              {settings?.contactPhone && (
                <li>
                  <a href={`tel:${settings.contactPhone}`} className="hover:text-ink transition-colors">
                    {settings.contactPhone}
                  </a>
                </li>
              )}
              {settings?.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="hover:text-ink transition-colors">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings?.contactAddress && <li className="whitespace-pre-line">{settings.contactAddress}</li>}
            </ul>
          )}

          {settings?.businessHours && (
            <p className="mt-3 whitespace-pre-line text-sm text-ink-muted">{settings.businessHours}</p>
          )}

          {socialLinks.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              {socialLinks.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          )}
        </div>

        <FooterColumn title="Κατηγορίες" links={categories.map((c) => ({ label: c.name, href: `/${c.handle}` }))} />
        <FooterColumn title="Βοήθεια" links={helpLinks} />
        <FooterColumn title="Εταιρεία" links={companyLinks} />
        <FooterColumn title="Νομικά" links={legalLinks} />
      </div>

      <div className="border-t border-border">
        <div className="container-shell flex flex-col gap-4 py-6 text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} {storeName}. Με επιφύλαξη παντός δικαιώματος.</span>
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

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink">{title}</h3>
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
