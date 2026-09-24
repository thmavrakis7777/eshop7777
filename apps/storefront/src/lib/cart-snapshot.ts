import type { Cart } from "@/lib/types";

/**
 * Which of two server snapshots of the cart the browser should keep.
 *
 * The shared client cart (CartUIProvider) is fed from several places that
 * can arrive in any order: the layout's first render, /kalathi and
 * /checkout's own renders, every cart action's returned Cart, background
 * refreshes when the drawer or those pages open. Before SPD-08 a full-page
 * refresh after every action papered over the ordering; without it, a page
 * restored by the Back button would otherwise hand in the cart it was
 * rendered with minutes ago and roll back newer state. So the rule is the
 * server's own clock: the snapshot read from the database last wins.
 *
 * `null` (no cart: never created, expired, or just turned into an order)
 * always wins. It only ever comes from a fresh answer — an action result or
 * a layout re-render — never from a page restored out of the router cache,
 * because the pages that take a snapshot in (/kalathi, /checkout) only do so
 * when they have a cart to show.
 *
 * An equal timestamp takes the incoming one: two reads in the same
 * millisecond describe the same database state, and the incoming copy is
 * the one a caller just asked to show.
 */
export function newerCart(current: Cart | null, incoming: Cart | null): Cart | null {
  if (incoming === null || current === null) return incoming;
  return incoming.fetchedAt >= current.fetchedAt ? incoming : current;
}

/**
 * What a page that was server-rendered with its own cart (/kalathi,
 * /checkout) should show on this render, before and after it has handed
 * that snapshot to the shared cart.
 *
 * The shared copy wins ties, unlike newerCart: once the page's snapshot is
 * stored, the two carry the same fetchedAt, and only the shared copy has the
 * shopper's optimistic edits on it (patchCart keeps fetchedAt). The page's
 * own snapshot shows only while the shared one is older — the first paint
 * of a fresh visit, before the effect stores it — or absent. "Absent" also
 * covers a cart that expired mid-visit, where this keeps the last known
 * lines on screen next to the action's error, as these pages always have.
 */
export function displayedCart(shared: Cart | null, pageSnapshot: Cart): Cart {
  return shared && shared.fetchedAt >= pageSnapshot.fetchedAt ? shared : pageSnapshot;
}
