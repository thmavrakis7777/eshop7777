import Image from "next/image";
import Link from "next/link";

/**
 * The store's brand mark. One component so header, mobile menu and footer
 * can never disagree about what the shop is called — before this, each
 * hardcoded the literal "STIA" independently, so renaming the shop meant
 * editing every one of them.
 *
 * Renders the admin-uploaded logo when there is one, and the store name as
 * text otherwise (which is the honest state today: no logo asset exists).
 * The name is always in the DOM either way — as the image's alt text — so
 * the brand is never invisible to a crawler or screen reader.
 */
export function StoreLogo({
  storeName,
  logoUrl,
  className = "font-display text-2xl tracking-tight text-ink shrink-0",
  href = "/",
}: {
  storeName: string;
  logoUrl: string | null;
  className?: string;
  href?: string | null;
}) {
  const content = logoUrl ? (
    // Unoptimized: the logo is a single small asset rendered on every page,
    // and next/image's optimizer would add a round trip per variant for no
    // real saving at this size. width/height are intrinsic-ratio hints only —
    // the CSS height below is what actually sizes it.
    <Image
      src={logoUrl}
      alt={storeName}
      width={160}
      height={40}
      unoptimized
      className="h-8 w-auto object-contain"
      priority
    />
  ) : (
    storeName
  );

  if (href === null) return <span className={className}>{content}</span>;
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}
