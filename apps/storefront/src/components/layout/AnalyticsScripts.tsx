"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";
import { getConsentServerSnapshot, getConsentSnapshot, subscribeConsent } from "@/lib/consent-storage";
import type { AnalyticsSettings } from "@/lib/content-types";

// Admin-first platform, Phase K; granular per-category consent added for
// the legal/compliance system. Each script only renders once its own
// category has been actively granted (see ConsentBanner) — no script tag
// for any service exists in the DOM before that, not just "disabled" or
// blocked by CSP. GA4/GTM/Clarity read `consent.analytics`; Meta Pixel
// reads `consent.marketing` — accepting one category never loads the
// other's scripts. One `next/script` block per configured service, each
// independent of the others (an admin can fill in only the ones they
// actually use).
//
// GTM's own base snippet also ships a <noscript><iframe> fallback for
// visitors with JavaScript disabled — deliberately omitted here: a visitor
// with no JS can never interact with ConsentBanner to grant consent in the
// first place, so an unconditional noscript tag would load tracking with
// no consent signal at all. Skipping it is the honest tradeoff, not an
// oversight.
// Second layer of defense: these IDs are already format-validated on save
// (settings-actions.ts's TRACKING_ID regex) before they can reach here, but
// every value interpolated into an executing inline <script> body gets
// JSON.stringify'd at the point of use regardless — never trust a stored
// value to still be safe by the time it's rendered.
function js(id: string): string {
  return JSON.stringify(id).replace(/</g, "\\u003c");
}

export function AnalyticsScripts({
  settings,
  nonce,
}: {
  settings: AnalyticsSettings | null;
  nonce?: string;
}) {
  const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot);

  if (!settings || !consent) return null;
  const analyticsOn = consent.analytics;
  const marketingOn = consent.marketing;

  return (
    <>
      {analyticsOn && settings.ga4MeasurementId && (
        <>
          <Script
            id="ga4-lib"
            src={`https://www.googletagmanager.com/gtag/js?id=${settings.ga4MeasurementId}`}
            strategy="afterInteractive"
            nonce={nonce}
          />
          <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${js(settings.ga4MeasurementId)});`}
          </Script>
        </>
      )}

      {analyticsOn && settings.gtmContainerId && (
        <Script id="gtm-init" strategy="afterInteractive" nonce={nonce}>
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${js(settings.gtmContainerId)});`}
        </Script>
      )}

      {marketingOn && settings.metaPixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive" nonce={nonce}>
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${js(settings.metaPixelId)});
fbq('track', 'PageView');`}
        </Script>
      )}

      {analyticsOn && settings.clarityProjectId && (
        <Script id="clarity-init" strategy="afterInteractive" nonce={nonce}>
          {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", ${js(settings.clarityProjectId)});`}
        </Script>
      )}
    </>
  );
}
