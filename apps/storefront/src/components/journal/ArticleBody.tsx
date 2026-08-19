import Link from "next/link";
import type { ReactNode } from "react";
import { publicImageUrl } from "@/lib/storage/urls";

/**
 * The Journal's content format.
 *
 * A deliberate NON-decision to add a rich-text editor. Three reasons, in
 * order of weight:
 *
 *   1. Production runs a strict nonce'd CSP with no 'unsafe-inline' on
 *      script-src and no external script origins (src/proxy.ts). Every
 *      mainstream WYSIWYG either injects inline styles/scripts or loads from
 *      a CDN, so adopting one means loosening the policy that is currently
 *      this app's main XSS control.
 *   2. A WYSIWYG produces HTML, which then has to be rendered with
 *      dangerouslySetInnerHTML and therefore sanitised — a second dependency
 *      and a permanent class of bug.
 *   3. This parser emits React elements. There is no HTML string anywhere in
 *      the pipeline, so there is nothing to sanitise and nothing to escape.
 *
 * It extends the plain-text convention ContentPageView.renderBody already
 * established (blank line = paragraph) with exactly the marks an editorial
 * article needs, and nothing else:
 *
 *     ## Επικεφαλίδα            → <h2>
 *     ### Υπο-επικεφαλίδα       → <h3>
 *     - στοιχείο                → <ul><li> (consecutive lines group)
 *     1. στοιχείο               → <ol><li> (consecutive lines group)
 *     > παράθεμα                → pull quote
 *     [εικόνα: journal/x.jpg | περιγραφή]  → real <img> + <figcaption>
 *     [κείμενο](/kouzina)       → link (internal links use next/link)
 *     **έντονα**                → <strong>
 *
 * The image token is a real <img> element, never a CSS background-image:
 * inline style attributes are blocked by style-src-elem in production, which
 * this repo has already been bitten by once (commit 5095f74).
 */

// ---------------------------------------------------------------------------
// Inline marks
// ---------------------------------------------------------------------------

/**
 * Admin-authored, but still validated: an owner pasting a `javascript:` URL
 * out of somewhere would otherwise become a stored XSS vector on a page every
 * visitor sees. Anything not on this list renders as plain text.
 */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("#")) return trimmed;
  return null;
}

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  // Fresh lastIndex per call — INLINE is a module constant with /g, so a
  // leftover index from the previous line would silently skip matches.
  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [, linkLabel, linkHref, bold] = match;

    if (bold !== undefined) {
      out.push(
        <strong key={`${keyPrefix}-b-${match.index}`} className="font-semibold text-ink">
          {bold}
        </strong>
      );
    } else {
      const href = safeHref(linkHref);
      if (!href) {
        out.push(linkLabel);
      } else if (href.startsWith("/")) {
        // Internal links are the point of the whole format — they are what
        // ties an article to the categories and products it discusses, for
        // readers and for crawlers alike.
        out.push(
          <Link
            key={`${keyPrefix}-l-${match.index}`}
            href={href}
            className="text-accent underline underline-offset-2 hover:no-underline"
          >
            {linkLabel}
          </Link>
        );
      } else {
        out.push(
          <a
            key={`${keyPrefix}-a-${match.index}`}
            href={href}
            {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="text-accent underline underline-offset-2 hover:no-underline"
          >
            {linkLabel}
          </a>
        );
      }
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

// Greek and English spellings both accepted so the owner never has to
// remember which language the token is in.
const IMAGE_TOKEN = /^\[(?:εικόνα|εικονα|image|img)\s*:\s*([^\]|]+?)(?:\s*\|\s*([^\]]*))?\]$/i;

export function ArticleBody({ body }: { body: string }) {
  // Windows browsers submit CRLF from a textarea, which turns a blank line
  // into "\r\n\r\n" — no two consecutive \n, so an unnormalised split runs
  // every paragraph together. Same fix as ContentPageView.renderBody.
  const lines = body.replace(/\r\n?/g, "\n").split("\n");

  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let listKind: "ul" | "ol" | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const key = `p-${blocks.length}`;
    const text = paragraphBuffer.join("\n");
    blocks.push(
      <p key={key} className="text-[1.0625rem] leading-[1.75] text-ink-muted">
        {text.split("\n").map((line, i, arr) => (
          <span key={i}>
            {renderInline(line, `${key}-${i}`)}
            {i < arr.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0 || !listKind) return;
    const key = `list-${blocks.length}`;
    const items = listBuffer.map((item, i) => (
      <li key={i} className="pl-1.5 text-[1.0625rem] leading-[1.75] text-ink-muted marker:text-accent">
        {renderInline(item, `${key}-${i}`)}
      </li>
    ));
    blocks.push(
      listKind === "ul" ? (
        <ul key={key} className="flex list-disc flex-col gap-2 pl-5">
          {items}
        </ul>
      ) : (
        <ol key={key} className="flex list-decimal flex-col gap-2 pl-5">
          {items}
        </ol>
      )
    );
    listBuffer = [];
    listKind = null;
  };

  const flushAll = () => {
    flushList();
    flushParagraph();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushAll();
      continue;
    }

    const image = IMAGE_TOKEN.exec(line);
    if (image) {
      flushAll();
      const url = publicImageUrl(image[1].trim());
      const caption = image[2]?.trim() ?? "";
      if (url) {
        blocks.push(
          <figure key={`fig-${blocks.length}`} className="my-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin-entered storage path or external URL of unknown dimensions; the aspect-ratio class is what prevents layout shift, which is next/image's main benefit here. */}
            <img
              src={url}
              alt={caption}
              loading="lazy"
              decoding="async"
              className="aspect-[3/2] w-full rounded-lg object-cover"
            />
            {caption && (
              <figcaption className="mt-2 text-sm text-ink-muted">{caption}</figcaption>
            )}
          </figure>
        );
      }
      continue;
    }

    if (line.startsWith("### ")) {
      flushAll();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mt-4 font-display text-lg text-ink md:text-xl">
          {line.slice(4).trim()}
        </h3>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushAll();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="mt-6 font-display text-xl text-ink md:text-2xl">
          {line.slice(3).trim()}
        </h2>
      );
      continue;
    }

    if (line.startsWith("> ")) {
      flushAll();
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          className="border-l-2 border-accent pl-5 font-display text-lg leading-relaxed text-ink md:text-xl"
        >
          {renderInline(line.slice(2).trim(), `q-${blocks.length}`)}
        </blockquote>
      );
      continue;
    }

    const bullet = /^[-•*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (listKind === "ol") flushList();
      listKind = "ul";
      listBuffer.push(bullet[1]);
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushParagraph();
      if (listKind === "ul") flushList();
      listKind = "ol";
      listBuffer.push(numbered[1]);
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushAll();

  return <div className="flex flex-col gap-5">{blocks}</div>;
}

/**
 * Plain text of an article body, for meta descriptions and JSON-LD — every
 * mark stripped, so a description never leaks "## " or a link's URL into a
 * search result. Shared by the article route's metadata and its structured
 * data so the two can never describe the page differently.
 */
export function articleBodyToPlainText(body: string | null): string {
  if (!body) return "";
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    // Line-level marks have to go before the lines are joined — once it is
    // one long string, a `^`-anchored strip only ever reaches the first line.
    .filter((line) => line && !IMAGE_TOKEN.test(line))
    .map((line) => line.replace(/^(#{2,3}|>|[-•*]|\d+[.)])\s+/, ""))
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
