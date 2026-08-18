"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

/**
 * The admin chrome: a fixed sidebar on desktop, a slide-over on small screens.
 *
 * Desktop-first by intent — this is where the store is actually run — but the
 * whole thing stays usable on a tablet or phone, because "check today's
 * orders from the shop floor" is a real workflow.
 *
 * Client Component only because it tracks the active route and the mobile
 * drawer's open state. Every page rendered inside it stays a Server Component.
 */

export type NavItem = { label: string; href: string; exact?: boolean };
export type NavGroup = { title: string; items: NavItem[] };

// Sections exist only where the store has something behind them. A "Marketing"
// area with nothing in it would be worse than no area at all — wishlist counts
// live on the product page and marketing consent lives on the customer record,
// where each is actually actionable.
export const NAV: NavGroup[] = [
  { title: "", items: [{ label: "Πίνακας ελέγχου", href: "/admin", exact: true }] },
  {
    title: "Κατάλογος",
    items: [
      { label: "Προϊόντα", href: "/admin/products" },
      { label: "Κατηγορίες", href: "/admin/categories" },
      { label: "Συλλογές", href: "/admin/collections" },
      { label: "Απόθεμα", href: "/admin/inventory" },
    ],
  },
  {
    title: "Πωλήσεις",
    items: [
      { label: "Παραγγελίες", href: "/admin/orders" },
      { label: "Πελάτες", href: "/admin/customers" },
      { label: "Εκπτώσεις", href: "/admin/discounts" },
    ],
  },
  {
    title: "Κατάστημα",
    items: [
      { label: "Αρχική σελίδα", href: "/admin/content/homepage" },
      { label: "Πλοήγηση", href: "/admin/content/navigation" },
      { label: "Header & Footer", href: "/admin/content/layout" },
      { label: "Σελίδες", href: "/admin/content/pages" },
      { label: "Πολυμέσα", href: "/admin/content/media" },
      { label: "SEO", href: "/admin/content/seo" },
    ],
  },
  { title: "Ρυθμίσεις", items: [{ label: "Ρυθμίσεις", href: "/admin/settings" }] },
];

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-6">
      {NAV.map((group) => (
        <div key={group.title || "root"}>
          {group.title && (
            <div className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
              {group.title}
            </div>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-1.5 text-sm transition-colors duration-120 ${
                      active
                        ? "bg-surface-strong font-medium text-ink"
                        : "text-ink-muted hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  children,
  adminName,
  adminRole,
  storeName,
  logout,
}: {
  children: ReactNode;
  adminName: string;
  adminRole: string;
  storeName: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname() ?? "/admin";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface/40">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-bg lg:flex">
        <div className="flex h-14 items-center border-b border-border px-5">
          <Link href="/admin" className="font-display text-lg tracking-tight">
            {storeName}
            <span className="ml-1.5 align-middle text-[10px] font-medium tracking-wider text-ink-muted uppercase">
              Admin
            </span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavLinks pathname={pathname} />
        </div>
        <div className="border-t border-border px-3 py-3">
          <div className="px-3 pb-2">
            <div className="truncate text-sm font-medium text-ink">{adminName}</div>
            <div className="text-xs text-ink-muted">
              {adminRole === "owner" ? "Ιδιοκτήτης" : "Προσωπικό"}
            </div>
          </div>
          <Link
            href="/"
            className="block rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            Προβολή καταστήματος →
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-1.5 text-left text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink"
            >
              Αποσύνδεση
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Άνοιγμα μενού διαχείρισης"
          className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/admin" className="font-display text-base">
          {storeName} <span className="text-xs text-ink-muted uppercase">Admin</span>
        </Link>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Κλείσιμο μενού"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-ink/20"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-bg">
            <div className="flex h-14 items-center justify-between border-b border-border px-5">
              <span className="font-display text-base">Μενού</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Κλείσιμο"
                className="rounded-md p-1.5 text-ink-muted hover:bg-surface hover:text-ink"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-5">
              <NavLinks pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="border-t border-border px-3 py-3">
              <form action={logout}>
                <button type="submit" className="w-full px-3 py-1.5 text-left text-sm text-ink-muted">
                  Αποσύνδεση
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-[80rem] px-5 py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}
