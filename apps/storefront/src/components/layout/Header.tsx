"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Money, NavCategory } from "@/lib/types";
import type { NavItem } from "@/lib/data/navigation";
import { formatPrice } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage/urls";
import {
  CartIcon,
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
  const headerRowRef = useRef<HTMLDivElement>(null);
  // The mega menu panel sits at `top-full` of this whole row (logo/icon row
  // + the category nav line beneath it), and that combined height isn't a
  // fixed design-token value — it flexes with the logo's clamp()ed font
  // size and whether the nav wraps to a second line for a long category
  // list. A static `calc(100vh - var(--header-height))` undercounts the nav
  // line and lets the panel's bottom edge run past the viewport on a short
  // window (confirmed live at 1440x600). Measuring the real edge is the
  // only way to keep the panel's own bottom pinned inside the viewport at
  // every height.
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    function recompute() {
      const bottom = headerRowRef.current?.getBoundingClientRect().bottom ?? 0;
      setMenuMaxHeight(Math.max(160, window.innerHeight - bottom - 16));
    }
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [openMenu]);

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpenMenu(null);
      }}
    >
      <div ref={headerRowRef} className="container-shell relative" onMouseLeave={() => setOpenMenu(null)}>
        {/* Three columns with FORCED-equal outer widths, so the brand sits at
            the true centre of the header rather than centred in whatever
            space the icons happen to leave. minmax(0,1fr) is what makes the
            sides equal: a plain 1fr refuses to shrink below its content, so
            a wider action cluster on the right would push the brand left.
            Grid over margins/padding for the same reason — no magic number
            to re-tune when an icon is added or removed. */}
        <div className="grid h-(--header-height) grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-4">
          <button
            ref={mobileTriggerRef}
            type="button"
            // col-start-1 is load-bearing: this button is lg:hidden, so on
            // desktop it leaves the grid flow entirely and the action
            // cluster would slide into the centre column, shoving the brand
            // aside. Explicit placement pins each child to its own column
            // whatever else is displayed.
            className="col-start-1 justify-self-start p-2 -ml-2 lg:hidden"
            aria-label="Άνοιγμα μενού"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>

          {/* Column 2. `justify-self-center` keeps it centred within a column
              that is already centred in the header. */}
          <StoreLogo
            storeName={storeName}
            logoUrl={logoUrl}
            className="font-display text-[clamp(0.84375rem,4vw,1.5rem)] tracking-tight text-ink whitespace-nowrap col-start-2 justify-self-center"
          />


          <div className="col-start-3 flex items-center justify-self-end gap-1 sm:gap-2">
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
                <CartIcon />
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

        {/* Its own full-width row, not squeezed between the logo and the
            action icons. A shop with nine main categories and long Greek
            names cannot fit them beside a wordmark without shrinking the
            type past readable — giving the nav its own line buys the whole
            container width, and `flex-wrap` means a very long list becomes a
            second line rather than an overflow. */}
        <nav
          className="hidden border-t border-border/60 lg:block"
          aria-label="Κύρια πλοήγηση"
        >
          <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 py-1.5">
            {navItems.map((item) => {
              // Only a category item can open a mega menu, and only if that
              // category actually has children — a SALES chip or a custom URL
              // has nothing to expand.
              const children = item.categorySlug
                ? (navCategories.find((c) => c.handle === item.categorySlug)?.displayChildren ?? [])
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

              return (
                <li key={item.id}>
                  {hasMenu ? (
                    <button
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
                      href={item.href}
                  className={base}
                  style={style}
                  onMouseEnter={() => setOpenMenu(null)}
                >
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {activeMegaMenu && (
          <div
            // Deliberately a plain container, not role="menu": that role
            // promises arrow-key roving-focus semantics this panel doesn't
            // implement, and it makes screen readers announce ordinary
            // navigation links as menu items. A list of links is what this
            // actually is.
            //
            // max-height + overflow-y-auto is load-bearing: with neither, a
            // category with many subcategories (or a short viewport, e.g.
            // 1440x600) pushed content below the fold with no way to reach
            // it. menuMaxHeight is measured (see above) rather than a fixed
            // calc(), so the panel scrolls internally instead of ever
            // extending past the visible window regardless of header height.
            className="absolute inset-x-0 top-full z-50 hidden overflow-y-auto overscroll-contain rounded-b-md border border-t-0 border-border bg-bg p-6 shadow-lg lg:block"
            style={menuMaxHeight !== null ? { maxHeight: menuMaxHeight } : undefined}
          >
            <div className="grid grid-cols-3 gap-6">
              {/* Two levels deep, and deliberately no further: a column per
                  subcategory with its own types listed underneath is what a
                  desktop shopper can scan at a glance, whereas a third
                  nested tier turns the panel into the whole taxonomy. Anyone
                  who wants to go deeper does it on the category page, where
                  there is room to do it one level at a time. */}
              <div className="col-span-2">
                {/* CSS multi-column, not grid-cols-3: a row-based grid
                    stretches every cell in a row to the tallest one, so one
                    subcategory with many grandchildren (e.g. Καθαριότητα)
                    forced its whole row — including short, childless
                    neighbors — to match its height, leaving large empty gaps
                    under everything else in that row. `columns-3` lets the
                    browser balance real content height into independently-
                    flowing columns instead, with no JS/ResizeObserver
                    needed: each column fills from the top with only as much
                    content as it actually has. `break-inside-avoid` keeps a
                    single child+grandchildren group from being split across
                    two columns mid-list. Order stays logical and lossless —
                    displayChildren is walked in the same sequence either
                    way; multi-column just reads top-to-bottom within a
                    column before continuing into the next one, the same as
                    a newspaper column, rather than left-to-right per row. */}
                <div className="columns-3 gap-x-6">
                  {/* displayChildren, not children: the canonical parent_id
                      tree plus any category cross-listed here (shop.category_
                      secondary_parent). Every link uses each node's own
                      canonicalHref rather than concatenating this menu's
                      handle with the child's — that concatenation assumes the
                      child's URL lives under this exact category, which is
                      false for a cross-listed one (its real URL is wherever
                      its PRIMARY parent puts it). */}
                  {activeMegaMenu.displayChildren.map((child) => (
                    <div key={child.handle} className="mb-5 break-inside-avoid">
                      <Link
                        href={child.canonicalHref}
                        className="block rounded-sm px-2 py-1 text-sm font-medium text-ink hover:text-accent transition-colors"
                        onClick={() => setOpenMenu(null)}
                      >
                        {child.name}
                      </Link>
                      {child.displayChildren.length > 0 && (
                        <ul className="mt-1 flex flex-col">
                          {child.displayChildren.map((grandchild) => (
                            <li key={grandchild.handle}>
                              <Link
                                href={grandchild.canonicalHref}
                                className="block rounded-sm px-2 py-1 text-xs text-ink-muted hover:text-ink transition-colors"
                                onClick={() => setOpenMenu(null)}
                              >
                                {grandchild.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                {/* Outside the column flow on purpose — inside it, the
                    balancing algorithm could drop this "view all" link
                    partway down a column instead of it reading as a single
                    consistent call-to-action under the category list. */}
                <Link
                  href={activeMegaMenu.canonicalHref}
                  className="mt-1 inline-block rounded-sm px-2 py-1 text-sm font-medium text-accent hover:underline"
                  onClick={() => setOpenMenu(null)}
                >
                  Όλα τα προϊόντα →
                </Link>
              </div>
              {activeMegaMenu.promo && (() => {
                const promo = activeMegaMenu.promo;
                const imageUrl = publicImageUrl(promo.imagePath);
                return (
                  <Link
                    href={promo.href}
                    className="group relative flex min-h-48 flex-col justify-end overflow-hidden rounded-md bg-surface p-4"
                    onClick={() => setOpenMenu(null)}
                  >
                    {imageUrl && (
                      <Image
                        src={imageUrl}
                        // Decorative — the visible title/button text below
                        // already say what this links to; a second
                        // description of the same image would be noise for
                        // a screen reader, not help.
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 22vw, 0px"
                        className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                      />
                    )}
                    {/* Gradient only when there's a photo behind the text —
                        the flat bg-surface fallback is already legible on
                        its own and doesn't need darkening. */}
                    {imageUrl && (
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" aria-hidden="true" />
                    )}
                    <div className="relative z-10">
                      {promo.title && (
                        <span className={`block text-sm font-medium ${imageUrl ? "text-white" : "text-ink"}`}>
                          {promo.title}
                        </span>
                      )}
                      {promo.description && (
                        <span className={`mt-1 block text-xs ${imageUrl ? "text-white/80" : "text-ink-muted"}`}>
                          {promo.description}
                        </span>
                      )}
                      <span
                        className={`mt-2 inline-block text-xs font-medium group-hover:underline ${
                          imageUrl ? "text-white" : "text-accent"
                        }`}
                      >
                        {promo.buttonText}
                      </span>
                    </div>
                  </Link>
                );
              })()}
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
        navItems={navItems}
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
