"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/settings", label: "Λογαριασμός", exact: true },
  { href: "/admin/settings/shipping", label: "Αποστολές" },
  { href: "/admin/settings/search", label: "Αναζήτηση" },
  { href: "/admin/settings/analytics", label: "Analytics" },
  { href: "/admin/settings/users", label: "Διαχειριστές" },
];

export function SettingsNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="mt-4 flex flex-wrap gap-1" aria-label="Ρυθμίσεις">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-120 ${
              active ? "bg-surface-strong font-medium text-ink" : "text-ink-muted hover:bg-surface hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
