import Link from "next/link";
import type { NavCategory } from "@/lib/types";

const helpLinks = [
  { label: "Παρακολούθηση Παραγγελίας", href: "/paraggelia" },
  { label: "Αποστολές & Παράδοση", href: "/apostoles" },
  { label: "Επιστροφές & Αλλαγές", href: "/epistrofes" },
  { label: "Συχνές Ερωτήσεις", href: "/faq" },
  { label: "Επικοινωνία", href: "/epikoinonia" },
];

const companyLinks = [
  { label: "Σχετικά με εμάς", href: "/sxetika" },
  { label: "Οδηγοί Αγορών", href: "/odigoi-agoron" },
  { label: "Δώρα Γάμου", href: "/dora-gamou" },
  { label: "Καριέρα", href: "/karieres" },
];

const legalLinks = [
  { label: "Όροι Χρήσης", href: "/oroi-xrisis" },
  { label: "Πολιτική Απορρήτου", href: "/aporrito" },
  { label: "Πολιτική Cookies", href: "/cookies" },
];

export function Footer({ categories }: { categories: NavCategory[] }) {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="container-shell grid grid-cols-2 gap-8 py-12 md:grid-cols-4 lg:grid-cols-6">
        <div className="col-span-2">
          <span className="font-display text-xl text-ink">STIA</span>
          <p className="mt-3 max-w-xs text-sm text-ink-muted">
            Προϊόντα για κουζίνα, μπάνιο, αποθήκευση και κήπο — σχεδιασμένα να διαρκούν, φτιαγμένα για την
            καθημερινότητά σου.
          </p>
        </div>

        <FooterColumn title="Κατηγορίες" links={categories.map((c) => ({ label: c.name, href: `/${c.handle}` }))} />
        <FooterColumn title="Βοήθεια" links={helpLinks} />
        <FooterColumn title="Εταιρεία" links={companyLinks} />
        <FooterColumn title="Νομικά" links={legalLinks} />
      </div>

      <div className="border-t border-border">
        <div className="container-shell flex flex-col gap-4 py-6 text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} STIA. Με επιφύλαξη παντός δικαιώματος.</span>
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
