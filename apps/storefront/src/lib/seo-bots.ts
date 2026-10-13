import { HTML_LIMITED_BOT_UA_RE_STRING } from "next/dist/shared/lib/router/utils/is-bot";

/**
 * Crawlers that get each page's <title>, meta description and canonical
 * inside <head> — next.config.ts `htmlLimitedBots`.
 *
 * Next streams generateMetadata by default: the HTML starts before the
 * metadata is ready, and the tags are appended to <body> when it resolves.
 * They stay in <body> after hydration, and Google only accepts a
 * rel="canonical" found in <head>. Every product page (its metadata needs
 * two queries, so it always loses that race) and some content and category
 * pages reached Googlebot that way — confirmed live 2026-10-13.
 *
 * Next's own list blocks for bots that can't run JavaScript, and it already
 * covered Bingbot and Google-InspectionTool (Search Console's "Test live
 * URL"). That is why the live test showed a correct canonical while the real
 * crawl didn't. It leaves out Googlebot itself on the grounds that Googlebot
 * renders the page, so this adds it. Visitors keep streamed metadata; only
 * the crawlers matched here wait for it, which measured no slower for
 * Bingbot than for a browser (0.34–0.52 s on a product page).
 *
 * Built from Next's own list rather than a copy of it, so an upgrade that
 * adds a bot carries it over. Setting the option replaces the default list
 * instead of adding to it. If Next moves this internal export, loading
 * next.config.ts fails and the build stops, so nothing changes silently.
 * "Googlebot" also matches Googlebot-Image/-News/-Video.
 */
export const HTML_LIMITED_BOTS = new RegExp(`${HTML_LIMITED_BOT_UA_RE_STRING}|Googlebot`, "i");
