"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { CategoryNode, NavCategory } from "@/lib/types";
import type { NavItem } from "@/lib/data/navigation";
import { ChevronRightIcon, CloseIcon, HeartIcon, UserIcon } from "@/components/ui/Icons";
import { StoreLogo } from "./StoreLogo";
import { useWishlist } from "@/components/wishlist/WishlistProvider";
import { publicImageUrl } from "@/lib/storage/urls";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Mirrors DEFAULT_VIEW_ALL_TEXT in lib/data/categories.ts — only used as a
// last-resort fallback if a CategoryNode somehow arrives without
// mobileViewAllButton populated (every real node from fetchAllCategories
// always has it; this keeps the component correct even if a caller ever
// hands it a hand-built CategoryNode that omits the optional field).
const DEFAULT_VIEW_ALL_TEXT = "Δείτε όλα τα προϊόντα της κατηγορίας";

// One shape for every tappable line in the drawer. py-4 puts a text-sm row at
// 52px and the smaller text-xs back row at 48px — both comfortably past the
// 44px one-handed target, on the narrowest phone the shop supports.
const ROW = "flex w-full items-center gap-3 px-4 py-4 text-left";

type DrawerProps = {
  onClose: () => void;
  categories: NavCategory[];
  navItems: NavItem[];
  storeName: string;
  logoUrl: string | null;
};

/**
 * The drawer exists only while it is open, which is what resets the
 * drill-down: closing unmounts the level state, so the menu always reopens at
 * the top rather than three taps deep into wherever the shopper last was. It
 * also means `open` only ever flips to true from a client click after
 * hydration, so document.body is guaranteed to exist by the time we portal.
 */
export function MobileMenu({ open, ...props }: DrawerProps & { open: boolean }) {
  if (!open) return null;
  return createPortal(<MenuDrawer {...props} />, document.body);
}

function MenuDrawer({
  onClose,
  categories: navCategories,
  navItems,
  storeName,
  logoUrl,
}: DrawerProps) {
  /**
   * The categories drilled into, outermost first — empty means the top level.
   *
   * This is presentational state, deliberately not in the URL: a level of the
   * menu is not a place the shopper can link to or return to, and pushing
   * history entries for it would make the back button undo menu taps instead
   * of page visits — exactly when they most expect it to leave the page they
   * just opened. The path doubles as the URL builder, since a category's
   * canonical href is its whole handle chain.
   */
  const [path, setPath] = useState<CategoryNode[]>([]);
  // Which edge the incoming level slides in from. Forward reads as "deeper",
  // back as "out" — the cue that this is still one menu, not a page change.
  const [goingBack, setGoingBack] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const { count: wishlistCount } = useWishlist();

  const depth = path.length;
  const current = path.at(-1);
  // Only ever real at depth 1: `path[0]` is the exact NavCategory object
  // Header.tsx's own top-level list holds (see the top-level branch below,
  // `drillInto(category)`), so it's the only level with a `.promo` — a
  // grandchild CategoryNode from `node.children` never carries one. Main-
  // category-only by construction, matching the desktop mega menu.
  const topLevelPromo = depth === 1 ? (current as NavCategory | undefined)?.promo : undefined;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    // A level swap unmounts the control that was just tapped, and focus left
    // on a removed node falls to <body> — outside the dialog, where the Tab
    // trap below can no longer reach it. Hand it to the new level's first
    // control instead. The new level also starts at its own top: inheriting
    // the previous level's scroll offset hides the heading that says where
    // the shopper now is.
    (backButtonRef.current ?? closeButtonRef.current)?.focus();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [depth]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onClose]);

  function drillInto(node: CategoryNode) {
    setPath((p) => [...p, node]);
    setGoingBack(false);
  }

  function drillOut() {
    setPath((p) => p.slice(0, -1));
    setGoingBack(true);
  }

  // current.canonicalHref, not a path-handle join: a cross-listed category
  // drilled into from a non-primary parent has a real URL that lives
  // elsewhere (wherever its OWN primary parent puts it), so concatenating
  // this drill session's own path would silently build the wrong link.
  const currentHref = current?.canonicalHref ?? `/${path.map((c) => c.handle).join("/")}`;
  const parentName = depth > 1 ? path[depth - 2].name : null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Μενού πλοήγησης"
    >
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-bg shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
          <StoreLogo storeName={storeName} logoUrl={logoUrl} href={null} className="font-display text-xl" />
          <button ref={closeButtonRef} type="button" className="p-2" aria-label="Κλείσιμο μενού" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Only the level in view scrolls, so the logo and the close button
            stay reachable however long a category's child list gets. */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          {/* Keyed on the path so each level is a fresh mount and replays the
              entry animation — the movement is what tells the shopper a level
              changed, since the drawer itself never moves. */}
          <div
            key={currentHref}
            className="menu-level"
            style={{ "--menu-level-from": goingBack ? "-1rem" : "1rem" } as React.CSSProperties}
          >
            {current ? (
              <>
                <div className="sticky top-0 z-10 border-b border-border bg-bg">
                  <button
                    ref={backButtonRef}
                    type="button"
                    className={`${ROW} text-xs font-medium uppercase tracking-[0.12em] text-ink-muted`}
                    aria-label={`Πίσω σε ${parentName ?? "κύριο μενού"}`}
                    onClick={drillOut}
                  >
                    <ChevronRightIcon className="h-4 w-4 shrink-0 rotate-180" />
                    <span className="min-w-0 flex-1 truncate">{parentName ?? "Μενού"}</span>
                  </button>
                  {/* Where you are. Wraps rather than truncates — a clipped
                      Greek category name is unreadable, and the heading is
                      the only thing naming the level. */}
                  <h2 className="-mt-1 px-4 pb-4 font-display text-lg break-words text-ink">{current.name}</h2>
                </div>

                {/* Compact by design (spec: "do not blindly force the same
                    large promotional panel into the mobile menu") — one
                    row, not the desktop panel's full image tile, so it
                    can't push the last subcategory further down a screen
                    that's already tight. Lives in the same scrollable flow
                    as everything below it; it never claims a fixed height
                    or its own scroll container, so it can't be the thing
                    that breaks reaching the final subcategory. */}
                {topLevelPromo && (
                  <Link
                    href={topLevelPromo.href}
                    onClick={onClose}
                    className={`${ROW} gap-3 border-b border-border`}
                  >
                    {(() => {
                      const imageUrl = publicImageUrl(topLevelPromo.imagePath);
                      return imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- fixed 48x48 thumbnail in a flex row, not worth next/image's config for this size.
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-sm bg-surface object-cover"
                        />
                      ) : null;
                    })()}
                    <span className="min-w-0 flex-1">
                      {topLevelPromo.title && (
                        <span className="block truncate text-sm font-medium text-ink">{topLevelPromo.title}</span>
                      )}
                      <span className="text-xs font-medium text-accent">{topLevelPromo.buttonText}</span>
                    </span>
                  </Link>
                )}

                {(() => {
                  // Dashboard-configurable (Category Management → "Κινητό
                  // μενού"): enable/disable, button text, and top/bottom
                  // position, per category, surviving renames since it's
                  // keyed by the category's own id (shop.category_view_all_
                  // button). Defaults (enabled, bottom, default text) match
                  // what a category with no explicit row gets from the
                  // database's own COALESCE, so this branch is only ever a
                  // defensive fallback, not the real default path.
                  const viewAll = current.mobileViewAllButton;
                  const showViewAll = viewAll?.enabled ?? true;
                  const viewAllText = viewAll?.text ?? DEFAULT_VIEW_ALL_TEXT;
                  const viewAllOnTop = viewAll?.position === "top";

                  // Conditionally rendered, not conditionally hidden — when
                  // disabled this is simply absent from the tree, so no
                  // empty row/gap survives (section 7 of the spec).
                  const viewAllLink = showViewAll ? (
                    <Link
                      key="view-all"
                      href={currentHref}
                      className={`${ROW} border-b border-border text-sm font-medium text-accent last:border-0`}
                      onClick={onClose}
                    >
                      {viewAllText}
                    </Link>
                  ) : null;

                  return (
                    <nav className="flex flex-col" aria-label={current.name}>
                      {viewAllOnTop && viewAllLink}
                      {/* displayChildren, not children — see Header.tsx's
                          mega menu for the same reasoning: this level's
                          canonical children plus anything cross-listed
                          here (shop.category_secondary_parent). */}
                      {current.displayChildren.map((child) => (
                        <CategoryRow key={child.handle} node={child} onDrill={drillInto} onClose={onClose} />
                      ))}
                      {/* Default position — the last element in the
                          scrollable flow, so reaching it is exactly the
                          same "scroll the container to its real bottom"
                          behavior already verified for the last
                          subcategory. No fixed/sticky wrapper, no
                          reserved height: it's a completely normal flex
                          child like every CategoryRow above it. */}
                      {!viewAllOnTop && viewAllLink}
                    </nav>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="flex border-b border-border">
                  <Link
                    href="/lista-epithymion"
                    className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium text-ink transition-colors hover:text-accent"
                    onClick={onClose}
                  >
                    <span className="relative flex">
                      <HeartIcon filled={wishlistCount > 0} className="h-5 w-5" />
                      {wishlistCount > 0 && (
                        <span className="absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-white tabular-nums">
                          {wishlistCount}
                        </span>
                      )}
                    </span>
                    Λίστα επιθυμιών
                  </Link>
                  <Link
                    href="/logariasmos"
                    className="flex flex-1 items-center justify-center gap-2 border-l border-border py-3 text-sm font-medium text-ink transition-colors hover:text-accent"
                    onClick={onClose}
                  >
                    <UserIcon className="h-5 w-5" />
                    Λογαριασμός
                  </Link>
                </div>

                {/* Exactly the navigation configured in the admin, in the same
                    order as the desktop bar — the two read the same list, so
                    they cannot drift apart. */}
                {/* Distinct from the desktop bar's landmark: two <nav> elements
                    sharing one accessible name makes a screen reader's landmark
                    list ambiguous. Same items, same order, different label. */}
                <nav className="flex flex-col" aria-label="Πλοήγηση καταστήματος">
                  {navItems.map((item) => {
                    const category = item.categorySlug
                      ? navCategories.find((c) => c.handle === item.categorySlug)
                      : undefined;
                    const style = {
                      color: item.textColor ?? undefined,
                      backgroundColor: item.backgroundColor ?? undefined,
                    };

                    // A SALES chip, a custom URL or a childless category has
                    // nothing to drill into, so it stays a plain link. The
                    // chevron is a promise, and one that opens an empty level
                    // is worse than no chevron at all. displayChildren, not
                    // children, so a main category made up entirely of
                    // cross-listed subcategories still drills in correctly.
                    if (!category || category.displayChildren.length === 0) {
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`${ROW} border-b border-border text-sm font-medium text-ink last:border-0`}
                          style={style}
                          onClick={onClose}
                        >
                          <span className="min-w-0 flex-1 break-words">{item.label}</span>
                        </Link>
                      );
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`${ROW} border-b border-border text-sm font-medium text-ink last:border-0`}
                        style={style}
                        onClick={() => drillInto(category)}
                      >
                        <span className="min-w-0 flex-1 break-words">
                          {item.label}
                          {/* The chevron alone does not say what the button
                              does; the label stays first so voice control can
                              still match what is on screen. */}
                          <span className="sr-only">: εμφάνιση υποκατηγοριών</span>
                        </span>
                        <ChevronRightIcon className="h-5 w-5 shrink-0" />
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One child row: a button that opens the next level when the category has
 * one, a link straight to its page when it does not.
 *
 * The depth limit lives in the data, not here — this renders whatever level
 * it is handed, which is what lets main → sub → sub-sub work (and any deeper
 * level the owner ever creates) without a per-level variant.
 */
function CategoryRow({
  node,
  onDrill,
  onClose,
}: {
  node: CategoryNode;
  onDrill: (node: CategoryNode) => void;
  onClose: () => void;
}) {
  // displayChildren, not children: a cross-listed leaf category (no
  // children of its own) always renders as a direct link to its real
  // canonical URL here, never a drill-in — there is nothing of its own to
  // drill into regardless of which parent it's being shown under.
  if (node.displayChildren.length === 0) {
    return (
      <Link
        href={node.canonicalHref}
        className={`${ROW} border-b border-border text-sm text-ink last:border-0`}
        onClick={onClose}
      >
        <span className="min-w-0 flex-1 break-words">{node.name}</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${ROW} border-b border-border text-sm text-ink last:border-0`}
      onClick={() => onDrill(node)}
    >
      <span className="min-w-0 flex-1 break-words">
        {node.name}
        <span className="sr-only">: εμφάνιση υποκατηγοριών</span>
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-muted" />
    </button>
  );
}
