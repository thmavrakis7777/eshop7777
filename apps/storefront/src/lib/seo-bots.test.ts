import { describe, expect, it } from "vitest";
import { shouldServeStreamingMetadata } from "next/dist/server/lib/streaming-metadata";
import { HTML_LIMITED_BOTS } from "./seo-bots";

// Run through Next's own decision function, fed the way Next feeds it:
// loadConfig turns the RegExp into its `.source` string, and this function
// compiles that again. `false` = metadata blocks and lands in <head>.
const streamsMetadata = (userAgent: string) => shouldServeStreamingMetadata(userAgent, HTML_LIMITED_BOTS.source);

const GOOGLEBOT_SMARTPHONE =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const GOOGLEBOT_DESKTOP = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const GOOGLE_INSPECTION_TOOL =
  "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0;)";
const BINGBOT = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
const FACEBOOK = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

describe("HTML_LIMITED_BOTS", () => {
  it("gives Googlebot (smartphone and desktop) its metadata in <head>", () => {
    expect(streamsMetadata(GOOGLEBOT_SMARTPHONE)).toBe(false);
    expect(streamsMetadata(GOOGLEBOT_DESKTOP)).toBe(false);
    expect(streamsMetadata("Googlebot-Image/1.0")).toBe(false);
  });

  it("keeps Next's own list: Search Console's live test, Bing, link previews", () => {
    expect(streamsMetadata(GOOGLE_INSPECTION_TOOL)).toBe(false);
    expect(streamsMetadata(BINGBOT)).toBe(false);
    expect(streamsMetadata(FACEBOOK)).toBe(false);
  });

  it("leaves visitors' browsers on streamed metadata", () => {
    expect(streamsMetadata(CHROME_DESKTOP)).toBe(true);
    expect(streamsMetadata(SAFARI_IPHONE)).toBe(true);
  });
});
