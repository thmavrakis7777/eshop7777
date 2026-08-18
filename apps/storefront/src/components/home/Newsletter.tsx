"use client";

import Image from "next/image";
import type { HomepageSection } from "@/lib/content-types";

/**
 * Shipped defaults, used until the owner edits the section. Everything here
 * is overridable from the homepage builder.
 */
const DEFAULTS = {
  heading: "Μείνε ενημερωμένος",
  body: "Νέες αφίξεις, οδηγοί αγορών και αποκλειστικές προσφορές, απευθείας στο inbox σου.",
  ctaLabel: "Εγγραφή",
};

/**
 * The form still has no submit handler — there is no mailing-list integration
 * in this project yet, and inventing one here would collect addresses nowhere.
 * The copy is now the owner's; wiring the submission is a separate job.
 */
export function Newsletter({ section }: { section?: HomepageSection } = {}) {
  const eyebrow = section?.eyebrow?.trim();
  const heading = section?.heading?.trim() || DEFAULTS.heading;
  const body = section?.body?.trim() || DEFAULTS.body;
  const ctaLabel = section?.ctaLabel?.trim() || DEFAULTS.ctaLabel;
  const imageUrl = section?.imageUrl;

  return (
    <section className="container-shell mt-16 md:mt-24">
      <div className="relative overflow-hidden rounded-lg bg-ink px-6 py-12 text-center md:px-12 md:py-16">
        {imageUrl && (
          <>
            <Image
              src={imageUrl}
              alt={section?.imageAlt ?? ""}
              fill
              unoptimized
              sizes="(min-width: 768px) 1152px, 100vw"
              className="object-cover"
            />
            {/* Keeps the white copy readable over any uploaded image — the
                owner picks the picture, not the contrast ratio. */}
            <div className="absolute inset-0 bg-ink/70" aria-hidden="true" />
          </>
        )}

        <div className="relative">
          {eyebrow && (
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">{eyebrow}</p>
          )}
          <h2 className="font-display text-2xl text-white md:text-3xl">{heading}</h2>
          {body && <p className="mx-auto mt-2 max-w-md text-sm text-white/70">{body}</p>}
          <form className="mx-auto mt-6 flex max-w-sm gap-2" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor="newsletter-email" className="sr-only">
              Email
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              placeholder="Το email σου"
              className="w-full rounded-sm border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus-visible:border-white"
            />
            <button
              type="submit"
              className="shrink-0 rounded-sm bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-white/90 transition-colors"
            >
              {ctaLabel}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
