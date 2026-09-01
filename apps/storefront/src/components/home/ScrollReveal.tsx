"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Subtle fade + slide-up reveal for the homepage Hero and Promo (Editorial-
 * Banner) sections only — not a general-purpose primitive, so it stays this
 * small and un-abstracted on purpose. A plain wrapper rather than a change
 * to Hero/EditorialBanner themselves, so those stay server components and
 * every other homepage section (products, categories, guarantees,
 * newsletter, footer) is never touched by this.
 *
 * Uses whileInView (IntersectionObserver-backed, not a scroll listener) with
 * viewport.once: false so the section fades back out on the way past and
 * back in in on return, per spec. Only opacity/transform are animated —
 * both compositor-only, so this can't introduce layout shift.
 */
export function ScrollReveal({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
