"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { NavCategory } from "@/lib/types";
import { ChevronDownIcon, CloseIcon, HeartIcon, UserIcon } from "@/components/ui/Icons";
import { useWishlist } from "@/components/wishlist/WishlistProvider";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileMenu({
  open,
  onClose,
  categories: navCategories,
}: {
  open: boolean;
  onClose: () => void;
  categories: NavCategory[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { count: wishlistCount } = useWishlist();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, onClose]);

  // `open` only ever flips to true from a client click after hydration,
  // so document.body is guaranteed to exist here — no mount-guard effect needed.
  if (!open) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Μενού πλοήγησης"
    >
      <div className="absolute inset-0 bg-ink/40" aria-hidden="true" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <span className="font-display text-xl">STIA</span>
          <button ref={closeButtonRef} type="button" className="p-2" aria-label="Κλείσιμο μενού" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="flex border-b border-border">
          <Link
            href="/lista-epithymion"
            className="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium text-ink hover:text-accent transition-colors"
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
            className="flex flex-1 items-center justify-center gap-2 border-l border-border py-3 text-sm font-medium text-ink hover:text-accent transition-colors"
            onClick={onClose}
          >
            <UserIcon className="h-5 w-5" />
            Λογαριασμός
          </Link>
        </div>

        <nav className="flex flex-col p-2">
          {navCategories.map((cat) => (
            <div key={cat.handle} className="border-b border-border last:border-0">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-medium text-ink"
                aria-expanded={expanded === cat.handle}
                onClick={() => setExpanded((v) => (v === cat.handle ? null : cat.handle))}
              >
                {cat.name}
                <ChevronDownIcon
                  className={`h-4 w-4 transition-transform ${expanded === cat.handle ? "rotate-180" : ""}`}
                />
              </button>
              {expanded === cat.handle && (
                <div className="flex flex-col pb-2 pl-3">
                  {cat.children.map((child) => (
                    <Link
                      key={child.handle}
                      href={`/${cat.handle}/${child.handle}`}
                      className="rounded-sm px-3 py-2 text-sm text-ink-muted"
                      onClick={onClose}
                    >
                      {child.name}
                    </Link>
                  ))}
                  <Link
                    href={`/${cat.handle}`}
                    className="rounded-sm px-3 py-2 text-sm font-medium text-accent"
                    onClick={onClose}
                  >
                    Όλα τα προϊόντα →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>,
    document.body
  );
}
