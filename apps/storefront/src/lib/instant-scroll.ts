/**
 * Scroll the window without the site's smooth scrolling (html has
 * scroll-behavior: smooth). A smooth scroll started while a page is still
 * settling gets cancelled on phones (confirmed live, 25 Οκτ 2026), so
 * programmatic jumps — to the products after a filter, back to where the
 * shopper was — switch it off for the one call. `behavior: "instant"` would
 * do the same, but older Safari does not understand it.
 */
export function instantScrollTo(top: number): void {
  const root = document.documentElement;
  const previous = root.style.scrollBehavior;
  root.style.scrollBehavior = "auto";
  window.scrollTo(0, Math.max(0, top));
  root.style.scrollBehavior = previous;
}

/** Height of the sticky site header (73 px on phones, 120–160 px on desktops). */
export function stickyHeaderHeight(): number {
  const header = document.querySelector("header.sticky");
  return header ? header.getBoundingClientRect().height : 0;
}
