import Link from "next/link";
import Image from "next/image";
import type { HomepageSection } from "@/lib/content-types";

/**
 * A free-form content section: image (with its own mobile crop), heading,
 * text and an optional button. The generic building block for anything that
 * isn't a hero, a rail or a category grid — "our story", a shipping promise,
 * a seasonal message.
 *
 * The button is genuinely optional: it renders only when the owner has set
 * both a label and a destination AND hasn't switched it off, so the same
 * section can be a plain image+text panel.
 */
export function ContentSection({ section }: { section: HomepageSection }) {
  const { eyebrow, heading, body, ctaLabel, ctaHref, imageUrl, mobileImageUrl, imageAlt, config } =
    section;

  // Nothing to show at all — don't leave an empty band on the page.
  if (!heading && !body && !imageUrl) return null;

  const showButton = config.showButton !== false && Boolean(ctaLabel && ctaHref);

  return (
    <section className="container-shell mt-16 md:mt-24">
      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-10">
        {imageUrl && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-surface">
            {/* Art direction: a separate crop for narrow viewports when the
                owner supplied one, rather than letting the desktop image
                scale down badly. <picture> rather than two <Image>s so only
                one request is ever made. */}
            {mobileImageUrl ? (
              <picture>
                <source media="(min-width: 768px)" srcSet={imageUrl} />
                <img
                  src={mobileImageUrl}
                  alt={imageAlt ?? heading ?? ""}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              </picture>
            ) : (
              <Image
                src={imageUrl}
                alt={imageAlt ?? heading ?? ""}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
            )}
          </div>
        )}

        <div className={imageUrl ? "" : "md:col-span-2 max-w-2xl"}>
          {eyebrow && (
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-accent">{eyebrow}</p>
          )}
          {heading && <h2 className="mt-3 text-2xl text-ink md:text-3xl">{heading}</h2>}
          {body && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-muted md:text-base">
              {body}
            </p>
          )}
          {showButton && (
            <Link
              href={ctaHref!}
              className="mt-6 inline-flex items-center rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
