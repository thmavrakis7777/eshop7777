"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PromoBanner } from "@/lib/content-types";

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

function remaining(endsAt: string): Remaining | null {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Admin-editable via Admin-first platform, Phase J — promotes a real
// discount the admin manages in Medusa's own Promotions section; this
// component only ever renders marketing copy plus a live countdown, never
// creates a discount itself.
//
// `time` deliberately starts `null` on every render (server *and* the
// client's first paint) rather than computed from `Date.now()` up front —
// computing it eagerly caused a real hydration mismatch, since the server
// and the client hydrate at slightly different instants and can land on
// different seconds. The real value is only ever set inside an effect,
// which runs strictly after hydration, so React just patches the DOM
// normally instead of comparing server vs. client markup. The backend's
// /store/promo-banner route already guarantees an expired banner is never
// sent down in the first place; `expired` here only covers the banner
// expiring live, mid-visit, while the tab stays open.
export function PromoBannerBar({ banner }: { banner: PromoBanner }) {
  const [time, setTime] = useState<Remaining | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!banner.endsAt) return;
    const endsAt = banner.endsAt;

    function tick() {
      const t = remaining(endsAt);
      if (!t) setExpired(true);
      else setTime(t);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [banner.endsAt]);

  if (expired) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent px-4 py-2 text-center text-xs text-white">
      {banner.headline && <span className="font-medium">{banner.headline}</span>}
      {banner.body && <span className="text-white/90">{banner.body}</span>}
      {time && (
        <span className="font-mono tabular-nums" aria-live="off">
          {time.days > 0 && `${time.days}η `}
          {pad(time.hours)}:{pad(time.minutes)}:{pad(time.seconds)}
        </span>
      )}
      {banner.ctaLabel && banner.ctaHref && (
        <Link href={banner.ctaHref} className="font-medium underline underline-offset-2">
          {banner.ctaLabel}
        </Link>
      )}
    </div>
  );
}
