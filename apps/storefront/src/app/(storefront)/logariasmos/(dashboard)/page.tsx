import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomer, getCustomerLoyaltyCoupons } from "@/lib/data/customer";
import { ProfileForm } from "@/components/account/ProfileForm";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Ο λογαριασμός μου",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos" },
};

const QUICK_LINKS = [
  { href: "/logariasmos/parangelies", label: "Παραγγελίες", description: "Ιστορικό και κατάσταση παραγγελιών" },
  { href: "/logariasmos/diefthinseis", label: "Διευθύνσεις", description: "Αποθηκευμένες διευθύνσεις παράδοσης" },
  { href: "/lista-epithymion", label: "Λίστα επιθυμιών", description: "Τα προϊόντα που έχεις αποθηκεύσει" },
];

export default async function AccountOverviewPage() {
  // The (dashboard) layout already redirects when there's no session — this
  // second check is only to satisfy the type (Customer, not Customer | null)
  // for ProfileForm below; in practice it never fires after the layout guard.
  const customer = await getCustomer();
  if (!customer) redirect("/logariasmos/eisodos?redirectTo=/logariasmos");
  const coupons = await getCustomerLoyaltyCoupons();

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="mb-6 font-display text-2xl text-ink">Επισκόπηση</h1>
        <ProfileForm customer={customer} />
      </div>

      {coupons.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-ink">Τα κουπόνια μου</h2>
          <ul className="flex flex-col gap-2">
            {coupons.map((c) => {
              const status = !c.isActive ? "Ανενεργό" : c.isRedeemed ? "Χρησιμοποιήθηκε" : "Διαθέσιμο";
              return (
                <li
                  key={c.code}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <code className="rounded-sm bg-surface-strong px-2 py-0.5 font-mono font-medium text-ink">
                      {c.code}
                    </code>
                    <span className="text-ink-muted">−{formatPrice({ amount: c.valueCents / 100, currencyCode: "EUR" })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-ink-muted">
                    {c.endsAt && <span>Έως {new Intl.DateTimeFormat("el-GR", { dateStyle: "medium" }).format(new Date(c.endsAt))}</span>}
                    <span
                      className={`rounded-sm px-2 py-0.5 font-medium ${
                        status === "Διαθέσιμο" ? "bg-accent/10 text-accent" : "bg-surface-strong text-ink-muted"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col gap-1 rounded-sm border border-border p-4 transition-colors hover:border-ink"
          >
            <span className="text-sm font-medium text-ink">{link.label}</span>
            <span className="text-xs text-ink-muted">{link.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
