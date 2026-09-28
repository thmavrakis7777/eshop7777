# Faster search suggestions (Speed audit SPD-10)

Status: **built 2026-09-28 as specified, D1 = no CDN cache (owner), tested locally, not yet on production** · §9 has the results

## 1. Problem (re-measured on production, 28 Σεπ 2026, desktop, after SPD-01)

The 19 Σεπ audit measured 0.73–1.28 s from the last keystroke to the
suggestions. That was before the server moved to Dublin. Measured again
with the in-app browser on www.mavrakishome.gr (6 queries, warm):

| | Now |
|---|---|
| Last keystroke → suggestions on screen | **0.40–0.66 s** |
| of which: fixed wait after typing stops | 250 ms (`DEBOUNCE_MS`) |
| of which: the request (POST server action) | 135–280 ms |
| Response size | 0.4–1.9 KB |

Mobile on 4G was not re-measured. The audit's target is under 300 ms.

The search itself is already cheap: `searchProducts` ranks an in-memory
copy of the catalogue that is cached for 60 s and refreshed immediately
whenever the dashboard saves a product (`updateTag(SEARCH_CACHE_TAG)`). The
time goes on the fixed wait and on how the request is made.

## 2. Why a server action is the wrong tool here

`SearchBox` calls `searchProductsPreviewAction`, a server action. Next's own
docs (`guides/server-actions.md`, "Sequential dispatch on the client"):
Next sends server actions **one at a time per visitor** and recommends a
Route Handler for requests that don't change anything. For search that
means:

- A suggestion waits behind any cart action still in flight. For example,
  tapping + on a search result (a quick add, also a server action) and then
  typing more: the next suggestion waits for the add.
- The fixed wait can't safely be shortened. More requests while typing would
  queue behind each other instead of the newest one simply winning.
- A request can't be cancelled when a newer keystroke makes it pointless.
- Every request goes through the proxy (CSP nonce, headers). `/api/*` routes
  are excluded from the proxy matcher (`src/proxy.ts`).

## 3. Proposal

1. **A GET route, `/api/search?q=…`,** returning the same six `Product`s the
   action returns today, from the same `searchProducts` (and so the same
   ranking, synonyms, boost and hide rules as the `/anazitisi` page). The
   query is trimmed and capped at 100 characters. The response is marked
   `no-store`: nothing is cached anywhere new, so a dashboard edit still
   reaches search immediately (see D1).
2. **`SearchBox` fetches it** instead of calling the action:
   - The fixed wait after typing drops from **250 ms to 150 ms**.
   - Each new keystroke **cancels** the previous request, and the existing
     "ignore a superseded answer" guard stays.
   - The query is sent normalized (lower case, no accents, the same
     `normalizeSearchText` the ranking applies internally). Results are
     identical, since every comparison in `lib/search.ts` normalizes anyway.
   - **Answers already seen while the search panel is open are reused at
     once.** Backspacing from "τηγα" to "τηγ", or retyping, shows the list
     with no request and no wait. The memory is cleared when the panel
     closes, so the next search always starts from fresh data.
   - A failed request (offline, server error) ends the loading state instead
     of leaving the spinner running. Today a thrown action leaves it spinning.
3. **The server action is removed** (`lib/actions/search.ts`); `SearchBox`
   was its only caller.

No visual change: same dropdown, same rows, same skeleton, same messages.

## 4. Expected result (to be re-measured, not promised)

- A new query: about 150 ms wait + the request (today 135–280 ms, perhaps a
  little less without the proxy and action handling) → roughly
  **0.3–0.45 s**, down from 0.40–0.66 s.
- A query already seen in the open panel: **instant**.
- Never queued behind a cart action.

This may not reach the audit's 300 ms target for a first-time query. The
remaining time is the round trip to the server in Dublin. Only a cache
nearer the shopper (D1) or searching inside the browser (§5) would remove
that.

## 5. Considered and not recommended

- **Searching inside the browser** (download the catalogue once, rank
  locally). Suggestions would be instant, and at 11 products the download is
  ~5 KB. But it grows with every product added. With 161 categories set up,
  a catalogue in the thousands would mean hundreds of KB to download before
  the first suggestion on a phone. It would also need synonyms and the
  boost/hide rules shipped to the browser, and a second way to keep them
  fresh.
- **A 250 → 120 ms wait** (the audit's figure). 150 ms is practically as fast
  and fires fewer requests while someone is mid-word.

## 6. Decision for the owner

**D1. Also cache suggestions on Vercel's CDN for 60 s?** Recommended: **no,
not now.**

- For: a query someone else typed in the last minute would be answered from
  a server near the shopper (tens of ms) without running the function. No
  extra cost.
- Against: after you change a price or stock in the dashboard, suggestions
  could show the old value for up to 60 s. Today they update immediately.
  Avoiding that needs a new `@vercel/functions` dependency and a purge call
  in every admin save. With today's traffic, few shoppers would type the
  same query within the same minute, so it would rarely be used.
- Worth revisiting if traffic grows. It's a header change on the new route.

## 7. Verification plan

- Local: type, backspace, retype; fast typing (only the last query's
  results show); Enter, arrow keys, "Δες όλα τα αποτελέσματα", quick add
  from a result; no-results message; offline (DevTools) → spinner stops;
  results identical to the old action's for a set of queries (Greek with and
  without accents, a product code, a synonym, a misspelling).
- Gate: tsc, ESLint, Vitest, `next build`.
- Production after the push: last keystroke → suggestions, same method as §1.

## 8. Files

`app/api/search/route.ts` (new), `components/layout/SearchBox.tsx`,
`lib/actions/search.ts` (removed).

## 9. What implementation found (2026-09-28)

Owner's decision on D1: **no CDN cache**. Suggestions stay live, so price
and stock are always current. Built as §3, nothing else about search
changed.

**Same results as before.** For 11 queries (Greek with and without accents,
capitals, a misspelling, a product code, a no-match), the new route returned
the same products in the same order as the live site's old server action.
Both read the same database. Sending the query normalized gave the same
answer as sending it as typed, every time. No synonyms are configured today,
so that path had nothing to compare.

Tested locally (dev server against the production database). These times
leave out the internet round trip to Vercel, so they don't compare directly
with §1's production numbers:

| Case | Result |
|---|---|
| New query, warm | shown 221–325 ms after typing (request starts at ~155 ms, takes 59–117 ms) |
| Backspace to a query already seen | shown within a frame, **no request** |
| Fast typing (60 ms between keys) | **one** request, for the final text |
| Slower typing (170 ms between keys) | each earlier request **cancelled** by the next key; only the last answer used |
| Server error (500) / offline | spinner stops, dropdown closes; the next query works |
| Arrow down + Enter | opens the product |
| «Δες όλα τα αποτελέσματα» | opens `/anazitisi?q=Wok` with the query as typed |
| Quick add from a result | added (toast, header 1 item / 42,90 €); test cart emptied afterwards |

One slow outlier (1.2 s): the 60 s search catalogue refreshing from the
database in Ireland over the local connection. On Vercel that refresh runs
next to the database.

The first «Δες όλα» click stalled once in dev. That was the dev server's
bundler (Turbopack) hitting an internal cache error, which also made
hot-reload reconnect in a loop. It worked after a reload. That button's
code is unchanged.

Gate: tsc, ESLint, Vitest 114/114, `next build` (`/api/search` is dynamic).
Production timing to be measured after the push, same method as §1.
