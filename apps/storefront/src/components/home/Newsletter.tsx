"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { HomepageSection } from "@/lib/content-types";
import { subscribeToNewsletterAction } from "@/lib/actions/newsletter";

const DEFAULTS = {
  heading: "Μείνε ενημερωμένος",
  body: "Νέες αφίξεις, οδηγοί αγορών και αποκλειστικές προσφορές, απευθείας στο inbox σου.",
  ctaLabel: "Εγγραφή",
};

const MESSAGES = {
  subscribed: "Ευχαριστούμε! Η εγγραφή σας στη λέσχη MAVRAKIS HOME ολοκληρώθηκε.",
  already_subscribed: "Αυτό το email είναι ήδη εγγεγραμμένο στη λίστα μας.",
  error: "Κάτι πήγε στραβά. Παρακαλούμε δοκιμάστε ξανά.",
  consent: "Χρειαζόμαστε τη συναίνεσή σου για να σε εγγράψουμε στο newsletter.",
};

export function Newsletter({ section }: { section?: HomepageSection } = {}) {
  const eyebrow = section?.eyebrow?.trim();
  const heading = section?.heading?.trim() || DEFAULTS.heading;
  const body = section?.body?.trim() || DEFAULTS.body;
  const ctaLabel = section?.ctaLabel?.trim() || DEFAULTS.ctaLabel;
  const imageUrl = section?.imageUrl;

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<{ kind: "success" | "error"; text: string } | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setResult({ kind: "error", text: MESSAGES.consent });
      return;
    }
    setResult(undefined);
    startTransition(async () => {
      const res = await subscribeToNewsletterAction({ email, consent });
      if (!res.ok) {
        setResult({ kind: "error", text: MESSAGES.error });
        return;
      }
      if (res.status === "already_subscribed") {
        setResult({ kind: "error", text: MESSAGES.already_subscribed });
        return;
      }
      setResult({ kind: "success", text: MESSAGES.subscribed });
      setEmail("");
      setConsent(false);
    });
  }

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
          {eyebrow && <p className="mb-2 text-xs uppercase tracking-[0.2em] text-white/60">{eyebrow}</p>}
          <h2 className="font-display text-2xl text-white md:text-3xl">{heading}</h2>
          {body && <p className="mx-auto mt-2 max-w-md text-sm text-white/70">{body}</p>}
          <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-sm flex-col gap-3">
            <div className="flex gap-2">
              <label htmlFor="newsletter-email" className="sr-only">
                Email
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                disabled={isPending}
                placeholder="Το email σου"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-sm border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus-visible:border-white disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isPending}
                className="shrink-0 rounded-sm bg-white px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-white/90 disabled:opacity-60"
              >
                {isPending ? "…" : ctaLabel}
              </button>
            </div>
            <label className="flex items-start gap-2 text-left text-xs text-white/60">
              <input
                type="checkbox"
                checked={consent}
                disabled={isPending}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                Θέλω να λαμβάνω ενημερωτικά email από το MAVRAKIS HOME. Δείτε την{" "}
                <Link href="/aporrito" className="underline hover:text-white">
                  Πολιτική Απορρήτου
                </Link>
                .
              </span>
            </label>
            {result && (
              <p role="status" className={`text-sm ${result.kind === "success" ? "text-white" : "text-red-300"}`}>
                {result.text}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
