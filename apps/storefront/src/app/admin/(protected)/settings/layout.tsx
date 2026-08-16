import Link from "next/link";
import { SettingsNav } from "@/components/admin/SettingsNav";

/**
 * Settings has enough sections to need its own navigation, but not enough to
 * deserve top-level sidebar entries — they would push the things used daily
 * (products, orders) further down for the sake of things touched once.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mb-8 border-b border-border pb-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-xs text-ink-muted">
          <Link href="/admin" className="transition-colors hover:text-ink">
            Πίνακας ελέγχου
          </Link>
          <span aria-hidden> / </span>
          <span>Ρυθμίσεις</span>
        </nav>
        <h1 className="font-display text-2xl text-ink">Ρυθμίσεις</h1>
        <SettingsNav />
      </div>
      {children}
    </>
  );
}
