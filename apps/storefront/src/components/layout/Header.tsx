"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Money, NavCategory } from "@/lib/types";
import type { NavItem } from "@/lib/data/navigation";
import { formatPrice } from "@/lib/format";
import {
  BagIcon,
  ChevronDownIcon,
  CloseIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/Icons";
import { MobileMenu } from "./MobileMenu";
import { SearchBox } from "./SearchBox";
import { StoreLogo } from "./StoreLogo";
import { useCartUI } from "@/components/cart/CartUIProvider";
import { useWishlist } from "@/components/wishlist/WishlistProvider";

export function Header({
  categories: navCategories,
  navItems,
  cartItemCount,
  cartTotal,
  storeName,
  logoUrl,
}: {
  categories: NavCategory[];
  /** Resolved main nav — owner-composed items, or the category fallback. */
  navItems: NavItem[];
  cartItemCount: number;
  cartTotal: Money;
  storeName: string;
  logoUrl: string | null;
}) {
  const { openDrawer } = useCartUI();
  const { count: wishlistCount } = useWishlist();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const activeMegaMenu = navCategories.find((c) => c.handle === openMenu) ?? null;
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpenMenu(null);
      }}
    >
      <div className="container-shell relative" onMouseLeave={() => setOpenMenu(null)}>
        <div className="flex h-(--header-height) items-center justify-between gap-2 sm:gap-4">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="p-2 -ml-2 lg:hidden"
            aria-label="Άνοιγμα μενού"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>

          <StoreLogo storeName={storeName} logoUrl={logoUrl} />

          <nav className="hidden lg:flex items-center gap-1" aria-label="Κύρια πλοήγηση">
            {navItems.map((item) => {
              // Only a category item can open a mega menu, and only if that
              // category actually has children — a SALES chip or a custom URL
              // has nothing to expand.
              const children = item.categorySlug
                ? (navCategories.find((c) => c.handle === item.categorySlug)?.children ?? [])
                : [];
              const hasMenu = children.length > 0;

              // Only ever colour and padding, never arbitrary CSS: the values
              // are #rrggbb strings validated in the admin action and by a
              // column CHECK, so an owner cannot inject layout-breaking
              // styling through the colour fields.
              const style = {
                ...(item.textColor ? { color: item.textColor } : {}),
                ...(item.backgroundColor ? { backgroundColor: item.backgroundColor } : {}),
              };
              const chip = item.backgroundColor ? "rounded-sm" : "";
              const base = `flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors ${chip} ${
                item.textColor || item.backgroundColor ? "" : "text-ink hover:text-accent"
              }`;

              return hasMenu ? (
                <button
                  key={item.id}
                  type="button"
                  className={base}
                  style={style}
                  aria-expanded={openMenu === item.categorySlug}
                  onMouseEnter={() => setOpenMenu(item.categorySlug)}
                  onFocus={() => setOpenMenu(item.categorySlug)}
                  // Opens only, never toggles closed: a mouse click arrives
                  // *after* mouseenter/focus have already opened the panel, so
                  // a toggle would slam it shut under the cursor. Activation
                  // still does something real (matching aria-expanded) for
                  // anyone who reaches this without hover; Escape closes.
                  onClick={() => setOpenMenu(item.categorySlug)}
                >
                  {item.label}
                  <ChevronDownIcon />
                </button>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  className={base}
                  style={style}
                  onMouseEnter={() => setOpenMenu(null)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              className="p-2 hover:text-accent transition-colors"
              aria-label="Αναζήτηση"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              {searchOpen ? <CloseIcon /> : <SearchIcon />}
            </button>
            <Link
              href="/lista-epithymion"
              className="relative hidden p-2 hover:text-accent transition-colors sm:block"
              aria-label={`Λίστα επιθυμιών, ${wishlistCount} προϊόντα`}
            >
              <HeartIcon filled={wishlistCount > 0} />
              {wishlistCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-white tabular-nums">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link href="/logariasmos" className="hidden sm:block p-2 hover:text-accent transition-colors" aria-label="Λογαριασμός">
              <UserIcon />
            </Link>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-sm px-2 py-2 hover:text-accent transition-colors"
              aria-label={`Καλάθι, ${cartItemCount} προϊόντα${
                cartItemCount > 0 ? `, σύνολο ${formatPrice(cartTotal)}` : ""
              }`}
              onClick={openDrawer}
            >
              <span className="relative flex">
                <BagIcon />
                {cartItemCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-white tabular-nums">
                    {cartItemCount}
                  </span>
                )}
              </span>
              {cartItemCount > 0 && (
                <span className="hidden text-xs font-medium tabular-nums text-ink sm:inline">
                  {formatPrice(cartTotal)}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeMegaMenu && (
          <div
            // Deliberately a plain container, not role="menu": that role
            // promises arrow-key roving-focus semantics this panel doesn't
            // implement, and it makes screen readers announce ordinary
            // navigation links as menu items. A list of links is what this
            // actually is.
            className="absolute inset-x-0 top-full z-50 hidden rounded-b-md border border-t-0 border-border bg-bg p-6 shadow-lg lg:block"
          >
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 grid grid-cols-2 gap-x-6 gap-y-2">
                {activeMegaMenu.children.map((child) => (
                  <Link
                    key={child.handle}
                    href={`/${activeMegaMenu.handle}/${child.handle}`}
                    className="rounded-sm px-2 py-1.5 text-sm text-ink-muted hover:bg-surface hover:text-ink transition-colors"
                    onClick={() => setOpenMenu(null)}
                  >
                    {child.name}
                  </Link>
                ))}
                <Link
                  href={`/${activeMegaMenu.handle}`}
                  className="rounded-sm px-2 py-1.5 text-sm font-medium text-accent hover:underline"
                  onClick={() => setOpenMenu(null)}
                >
                  Όλα τα προϊόντα →
                </Link>
              </div>
              {activeMegaMenu.featured && (
                <Link
                  href={activeMegaMenu.featured.href}
                  className="group flex flex-col justify-end rounded-md bg-surface p-4"
                  onClick={() => setOpenMenu(null)}
                >
                  <span className="text-sm font-medium text-ink">{activeMegaMenu.featured.title}</span>
                  <span className="mt-1 text-xs text-accent group-hover:underline">
                    {activeMegaMenu.featured.ctaLabel}
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {searchOpen && (
        <div className="border-t border-border bg-bg">
          <div className="container-shell py-4">
            <SearchBox onNavigate={() => setSearchOpen(false)} />
          </div>
        </div>
      )}

      <MobileMenu
        open={mobileOpen}
        categories={navCategories}
        storeName={storeName}
        logoUrl={logoUrl}
        onClose={() => {
          setMobileOpen(false);
          mobileTriggerRef.current?.focus();
        }}
      />
    </header>
  );
}
