"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

// Below this, the header sits at the very top of the page (no meaningful
// scroll yet) and stays in its transparent, hero-overlay look; past it, it
// switches to the solid scrolled look. Small on purpose — the transition
// should read as "now you've scrolled", not track the scroll position.
const HEADER_SOLID_SCROLL_THRESHOLD = 20;

// Only the homepage lays its first section out as a full-bleed Hero the
// header is meant to float over (see Hero.tsx's `isFirstSection`) — every
// other route keeps the header's plain always-solid look, so this is the
// only page where the transparent/overlay state can ever apply.
function useHeaderOverlay() {
  const pathname = usePathname();
  const [scrolledPastThreshold, setScrolledPastThreshold] = useState(false);

  useEffect(() => {
    if (pathname !== "/") return;
    function update() {
      setScrolledPastThreshold(window.scrollY > HEADER_SOLID_SCROLL_THRESHOLD);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [pathname]);

  return pathname === "/" && !scrolledPastThreshold;
}

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
  const overlay = useHeaderOverlay();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const activeMegaMenu = navCategories.find((c) => c.handle === openMenu) ?? null;
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const headerRowRef = useRef<HTMLDivElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
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

  // --header-height (globals.css) is what Hero.tsx pulls its first section
  // up by to sit underneath this header — but the real header height isn't
  // one fixed number: the category sub-nav row below the logo only exists
  // at `lg:` (1024px+), so the header is taller there than the static
  // fallback accounts for. Below `lg` the two already match (icon row
  // only), which is why this only ever showed up as a desktop bug. Measured
  // off headerRowRef (the icon row + sub-nav row container) rather than the
  // outer <header> itself, since the outer element also wraps the
  // conditionally-rendered search flyout below — including that would make
  // the hero jump every time search opens/closes. A ResizeObserver, not a
  // resize listener, because the height also changes from the nav
  // wrapping to a second line, which isn't a viewport-resize event.
  useLayoutEffect(() => {
    const el = headerRowRef.current;
    if (!el) return;
    function update() {
      document.documentElement.style.setProperty("--header-height", `${el!.getBoundingClientRect().height}px`);
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // This header lives in the layout, so a client-side navigation never
  // unmounts it — an open search panel, and whatever was typed into it,
  // otherwise rides along onto the destination page (confirmed live: / →
  // /kouzina left the panel open with its query intact), including on
  // browser Back/Forward, which are ordinary pathname changes here too.
  // The router's own pathname is already this file's route signal
  // (useHeaderOverlay above reads the same value), so this needs no extra
  // listener, no global state and no route watcher of its own. Closing is
  // also what RESETS the search: query, results and active option all live
  // inside SearchBox, which unmounts with the panel.
  //
  // Every overlay this header owns is reset here, not just the search panel.
  // The mobile menu was the worst of them: it survived Back/Forward with
  // `body { overflow: hidden }` still applied (measured: menu open on /,
  // history.forward() → /kouzina with the drawer still covering the page and
  // the page still locked). The mega-menu survived the same way — no scroll
  // lock, so milder, but it has its own dismissal only on mouse-leave, which
  // a keyboard or touch user never triggers. Both are the same bug as the
  // search panel's, so they get the same one-line answer rather than three
  // different route watchers.
  //
  // Adjusted during render against the previous pathname — React's
  // documented "reset state when a value changes" pattern, the same one
  // SearchBox uses for its below-min-length reset and CartDrawer for its
  // mount/exit flags — rather than an effect. It re-renders before the
  // browser paints, so the destination page never shows a frame with the
  // old panel still on it, and it costs no extra commit.
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (searchOpen) setSearchOpen(false);
    if (mobileOpen) setMobileOpen(false);
    if (openMenu) setOpenMenu(null);
  }

  // Dismiss-on-outside-click for the whole panel. Deliberately the same
  // `mousedown` + `contains` shape SearchBox (and AddressAutocomplete before
  // it) already uses rather than a second, differently-behaving utility —
  // one level up: SearchBox's own handler closes just its results dropdown,
  // this one closes the panel that contains it. Bound only while the panel
  // is open, so there is no always-on document listener, and `mousedown`
  // (not `click`) is what makes a tap outside dismiss on touch too.
  // The toggle button is excluded on purpose: without that, its own onClick
  // would immediately re-open what this had just closed.
  useEffect(() => {
    if (!searchOpen) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (searchPanelRef.current?.contains(target)) return;
      if (searchToggleRef.current?.contains(target)) return;
      setSearchOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [searchOpen]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-300 motion-reduce:transition-none ${
        overlay
          ? "border-transparent bg-transparent text-white"
          : "border-border bg-bg/95 text-ink backdrop-blur"
      }`}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        setOpenMenu(null);
        // SearchBox's input handler calls preventDefault() only when it
        // actually consumed the Escape to close its own results dropdown, so
        // this reads as: first Escape closes the dropdown, the next closes
        // the whole panel — rather than one keypress collapsing both at once.
        if (!e.defaultPrevented) setSearchOpen(false);
      }}
    >
      <div ref={headerRowRef} className="container-shell relative">
        {/* Three columns with FORCED-equal outer widths, so the brand sits at
            the true centre of the header rather than centred in whatever
            space the icons happen to leave. minmax(0,1fr) is what makes the
            sides equal: a plain 1fr refuses to shrink below its content, so
            a wider action cluster on the right would push the brand left.
            Grid over margins/padding for the same reason — no magic number
            to re-tune when an icon is added or removed. */}
        {/* Fixed literal, not h-(--header-height): that var is now written
            by the ResizeObserver below FROM this row's own rendered height,
            so sizing this row off the same var it feeds would be circular —
            the row grows, the observer measures the growth, writes a larger
            var, which grows the row again. 4.5rem is the row's real,
            never-changing intended height; only the *total* header height
            (this row plus the lg:-only sub-nav row beneath it) varies by
            breakpoint, which is exactly what the var needs to capture. */}
        <div className="grid h-[4.5rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-4">
          <button
            ref={mobileTriggerRef}
            type="button"
            // col-start-1 is load-bearing: this button is lg:hidden, so on
            // desktop it leaves the grid flow entirely and the action
            // cluster would slide into the centre column, shoving the brand
            // aside. Explicit placement pins each child to its own column
            // whatever else is displayed.
            className="col-start-1 justify-self-start p-2 -ml-2 lg:hidden transition-colors motion-reduce:transition-none"
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
            className={`font-display text-[clamp(0.84375rem,4vw,1.5rem)] tracking-tight whitespace-nowrap col-start-2 justify-self-center transition-colors duration-300 motion-reduce:transition-none ${
              overlay ? "text-white" : "text-ink"
            }`}
          />


          {/* The overlay state's hover colour, shared by all four action
              controls below. They used a flat `hover:text-accent` while the
              category nav beneath them already switched to `hover:text-white/
              80` over the Hero — so on the homepage at the top, hovering any
              of these icons turned it terracotta over a photo, which reads as
              noticeably harder to see than the white it replaces (the close X
              in particular, while search is open). Same treatment as the nav,
              so the whole header now behaves as one thing in overlay state. */}
          <div className="col-start-3 flex items-center justify-self-end gap-1 sm:gap-2">
            <button
              ref={searchToggleRef}
              type="button"
              className={`p-2 transition-colors ${overlay ? "hover:text-white/80" : "hover:text-accent"}`}
              aria-label="Αναζήτηση"
              aria-expanded={searchOpen}
              // Both panels hang off the same `top-full` edge and cover the
              // same strip of page, so two of them open at once is just one
              // painted on top of the other. Opening search dismisses the
              // mega-menu here; the other direction is handled on the nav
              // triggers themselves, which decline to open over an open
              // search panel rather than yanking it (and a half-typed query)
              // away on a mouse that merely passed across the nav.
              onClick={() => {
                setOpenMenu(null);
                setSearchOpen((v) => !v);
              }}
            >
              {searchOpen ? <CloseIcon /> : <SearchIcon />}
            </button>
            <Link
              href="/lista-epithymion"
              className={`relative hidden p-2 transition-colors sm:block ${
                overlay ? "hover:text-white/80" : "hover:text-accent"
              }`}
              aria-label={`Λίστα επιθυμιών, ${wishlistCount} προϊόντα`}
            >
              <HeartIcon filled={wishlistCount > 0} />
              {wishlistCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-white tabular-nums">
                  {wishlistCount}
                </span>
              )}
            </Link>
            <Link
              href="/logariasmos"
              className={`hidden sm:block p-2 transition-colors ${
                overlay ? "hover:text-white/80" : "hover:text-accent"
              }`}
              aria-label="Λογαριασμός"
            >
              <UserIcon />
            </Link>
            <button
              type="button"
              className={`flex items-center gap-1.5 rounded-sm px-2 py-2 transition-colors ${
                overlay ? "hover:text-white/80" : "hover:text-accent"
              }`}
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
                <span
                  className={`hidden text-xs font-medium tabular-nums sm:inline transition-colors duration-300 motion-reduce:transition-none ${
                    overlay ? "text-white" : "text-ink"
                  }`}
                >
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
        {/*
            Scopes the "close on mouse-leave" behavior to just the category
            nav + its mega-menu panel, not the whole header row above
            (headerRowRef, which also contains the logo/search/wishlist/
            account/cart icons and used to own this handler). With it on the
            wider row, moving from an open category towards e.g. the cart
            icon never left that row, so the menu stayed open until the
            cursor reached page content below the header entirely. Scoped
            here, leaving this nav+panel area for ANY other header element —
            logo, search, wishlist, account, cart, announcement bar — closes
            it immediately, while moving from a category trigger down into
            its own mega-menu panel stays inside this wrapper and keeps it
            open. */}
        <div onMouseLeave={() => setOpenMenu(null)}>
        <nav
          className={`hidden border-t lg:block transition-colors duration-300 motion-reduce:transition-none ${
            overlay ? "border-transparent" : "border-border/60"
          }`}
          aria-label="Κύρια πλοήγηση"
        >
          <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 py-1.5">
            {navItems.map((item) => {
              // Only a category item can open a mega menu, and only if that
              // category actually has children — a SALES chip or a custom URL
              // has nothing to expand. Keeping the whole category object (not
              // just its children) is what lets the parent label itself link
              // somewhere real below.
              const category = item.categorySlug ? navCategories.find((c) => c.handle === item.categorySlug) : undefined;
              const children = category?.displayChildren ?? [];
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
              const base = `flex items-center gap-1 px-3 py-2 text-sm 2xl:text-[0.9375rem] font-medium transition-colors motion-reduce:transition-none ${chip} ${
                item.textColor || item.backgroundColor
                  ? ""
                  : overlay
                    ? "text-white hover:text-white/80"
                    : "text-ink hover:text-accent"
              }`;

              return (
                <li key={item.id}>
                  {hasMenu && category ? (
                    // A real link, same as any other nav item — clicking the
                    // parent category name navigates to that category's own
                    // page (category.canonicalHref, the exact same field the
                    // mega menu's own "Όλα τα προϊόντα" link below uses, so
                    // the destination can never drift from it). Hover/focus
                    // still open the dropdown exactly as before; only the
                    // click behavior changed — this used to be a <button>
                    // with no href at all; onClick only ever set the same
                    // state onMouseEnter/onFocus already set, so removing it
                    // in favor of real navigation doesn't lose anything a
                    // mouse or hover user could reach.
                    <Link
                      href={category.canonicalHref}
                      className={base}
                      style={style}
                      aria-expanded={openMenu === item.categorySlug}
                      // Not while the search panel is open — the two overlap
                      // exactly (see the search toggle above). Hover is not
                      // intent, so this suppresses the menu rather than
                      // closing search: the shopper's typed query survives,
                      // and actually pressing on a category still closes the
                      // panel via its outside-mousedown handler and
                      // navigates.
                      onMouseEnter={() => !searchOpen && setOpenMenu(item.categorySlug)}
                      onFocus={() => !searchOpen && setOpenMenu(item.categorySlug)}
                      // Closes the mega-menu immediately on click, before the
                      // navigation's own transition — otherwise Header (in
                      // the layout, not this page) stays mounted across the
                      // client-side navigation and the panel keeps showing
                      // over the destination category page until a later
                      // hover/mouse-leave happens to clear it.
                      onClick={() => setOpenMenu(null)}
                    >
                      {item.label}
                      <ChevronDownIcon />
                    </Link>
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
      </div>

      {searchOpen && (
        <div
          ref={searchPanelRef}
          // `absolute`, NOT in the header's flow — this is the actual fix for
          // the search-contrast bug, and it deliberately leaves the
          // transparent/overlay header itself completely untouched.
          //
          // In flow, this panel added its own height to the <header>, which
          // pushed everything after the header down by that much — including
          // the homepage Hero, whose `mt-[calc(var(--header-height)*-1)]`
          // only ever cancels the ROW's height (--header-height is measured
          // off headerRowRef, which excludes this panel, and must stay that
          // way or the Hero would jump on every open/close). The Hero is the
          // only thing behind the transparent header, so the instant search
          // opened the Hero slid out from under it and the whole icon row —
          // white logo, white close X, wishlist, account, cart, category nav
          // — was left as white-on-white over the page background. Measured
          // live before the fix: Hero top moved 55.98px → 131.18px, exactly
          // this panel's own height. Out of flow, nothing after the header
          // moves at all, the Hero stays put behind the transparent row, and
          // every overlay-white element keeps the image it was designed to
          // read against. It also removes a real layout shift on open.
          //
          // The sticky <header> is a positioned element, so it is already
          // this panel's containing block: `top-full` lands exactly on the
          // row's bottom edge, the same `absolute inset-x-0 top-full` +
          // `shadow-lg` overlay shape the mega-menu panel above uses. No
          // z-index on purpose — adding one would make this a stacking
          // context and trap SearchBox's own z-50 results dropdown inside it,
          // underneath the mega-menu panel.
          //
          // text-ink is the other half: this panel is its own solid bg-bg
          // surface, so its contents must not inherit the header's
          // overlay-state `text-white`. Without it the typed query rendered
          // white on white — invisible (measured: computed colour
          // rgb(255,255,255) on #ffffff), which is the bug as reported.
          className="absolute inset-x-0 top-full border-t border-border bg-bg text-ink shadow-lg"
        >
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
