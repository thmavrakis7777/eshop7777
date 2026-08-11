"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";
import { getConsentServerSnapshot, getConsentSnapshot, subscribeConsent } from "@/lib/consent-storage";
import type { AnalyticsSettings } from "@/lib/data/analytics-settings";

// Admin-first platform, Phase K. Renders nothing until the visitor has
// actively accepted (see ConsentBanner) — no script tag for any service
// exists in the DOM before that, not just "disabled" or blocked by CSP.
// One `next/script` block per configured service, each independent of the
// others (an admin can fill in only the ones they actually use).
//
// GTM's own base snippet also ships a <noscript><iframe> fallback for
// visitors with JavaScript disabled — deliberately omitted here: a visitor
// with no JS can never interact with ConsentBanner to grant consent in the
// first place, so an unconditional noscript tag would load tracking with
// no consent signal at all. Skipping it is the honest tradeoff, not an
// oversight.
export function AnalyticsScripts({ settings }: { settings: AnalyticsSettings | null }) {
  const consent = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot);

  if (!settings || consent !== "accepted") return null;

  return (
    <>
      {settings.ga4MeasurementId && (
        <>
          <Script
            id="ga4-lib"
            src={`https://www.googletagmanager.com/gtag/js?id=${settings.ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${settings.ga4MeasurementId}');`}
          </Script>
        </>
      )}

      {settings.gtmContainerId && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${settings.gtmContainerId}');`}
        </Script>
      )}

      {settings.metaPixelId && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${settings.metaPixelId}');
fbq('track', 'PageView');`}
        </Script>
      )}

      {settings.clarityProjectId && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "${settings.clarityProjectId}");`}
        </Script>
      )}
    </>
  );
}
