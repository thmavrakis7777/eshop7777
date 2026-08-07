"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { navCategories } from "@/lib/mock-data";
import { ChevronDownIcon, CloseIcon } from "@/components/ui/Icons";

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // `open` only ever flips to true from a client click after hydration,
  // so document.body is guaranteed to exist here — no mount-guard effect needed.
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Μενού πλοήγησης">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40"
        aria-label="Κλείσιμο μενού"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <span className="font-display text-xl">STIA</span>
          <button type="button" className="p-2" aria-label="Κλείσιμο μενού" onClick={onClose}>
            <CloseIcon />
          </button>
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
