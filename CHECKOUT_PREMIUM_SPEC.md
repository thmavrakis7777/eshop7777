# Premium Greek Checkout — Architecture Review

Status: **DRAFT — architecture review only. No code has been written.** Per your
brief's own §12 and this project's established pattern (every prior phase —
cart, checkout, product code/search, card/wishlist/PDP — got a written spec and
explicit sign-off before any code), this document is the gate before
implementation starts. It covers all 13 review points from §12, per feature
area, plus what's already true today so nothing gets rebuilt that already works.

**Read this first**: this brief bundles roughly **nine separate feature epics**
(delivery/BOX NOW, address autocomplete, billing address, tax documents/AFM/AADE,
payment methods, emails, cart persistence, wishlist persistence, plus the
performance/SEO/Medusa constraints that apply to all of them). Building all nine
in one pass, then testing at the end, is how the checkout phase 4B research
caught real live bugs (missing Greece in the shipping zone, the `subtotal`
double-counting bug) — each new area needs the same "verify live, then build,
then verify live again" discipline. §9 below proposes a phase order; nothing
stops you from approving all of it at once, but I'd still build and verify it
incrementally, exactly like every prior phase.

---

## 0. What's actually true today (don't re-derive, don't rebuild)

Confirmed by reading the live code, not memory:

- **Checkout (Phase 4B) is real, built, and working** — single scrolling page
  (`/checkout`), guest-only, Medusa cart as the single source of truth, real
  shipping options from `/store/shipping-options`, real payment providers from
  `/store/payment-providers`, a real 3-step completion flow (payment collection
  → payment session → cart complete), a real bookmarkable confirmation page.
  This is the foundation everything below extends — **not a rewrite target.**
- **The Medusa backend is currently a vanilla install** — `medusa-config.ts`
  declares no custom modules at all (`src/modules`, `src/subscribers`,
  `src/workflows` each contain only their generated `README.md`). There is
  exactly one payment provider (`pp_system_default`, "Αντικαταβολή") and
  whatever fulfillment options exist from the original demo seed. **Every
  backend-side ask in this brief — BOX NOW, a real payment gateway, AADE/ΑΦΜ
  lookup, order emails — is new backend work, not configuration of something
  that half-exists.**
- **The storefront has zero extra dependencies** beyond Next.js/React/Tailwind
  (`apps/storefront/package.json`). No maps SDK, no form library, nothing.
  Every new client-side capability (autocomplete widget, ΑΦΜ validation) is a
  new, deliberately chosen dependency, not already half-wired.
- **Cart persistence is already solid for guests**: `cart_id` in an `httpOnly`
  cookie (not `localStorage`), 30-day max-age, resolved server-side only. This
  already satisfies "never unexpectedly lose the cart" for guests — see §7 for
  the actual gap (there's no customer account system at all, so "logged-in
  cart sync" in your brief has no account layer to sync against yet).
- **Wishlist persistence is `localStorage`-only** (`lib/wishlist-storage.ts`),
  a deliberate choice from the last phase because Medusa has no native
  wishlist module and this store has no customer auth. Same gap as cart: "sync
  for logged-in customers" needs an account system first.
- **No customer accounts exist anywhere in this codebase.** The confirmation
  page's "Δημιουργία λογαριασμού" link points at `/logariasmos`, which is a
  placeholder route, same status as other not-yet-built content pages. This
  matters a lot for §7/§8 below.

---

## 1. Delivery options: Store Pickup + BOX NOW

### Existing implementation
None. Medusa's fulfillment system today has whatever shipping options survived
the original demo seed (flat-rate "Standard"/"Express" via the same
generic fulfillment provider) — no pickup option, no locker network, and the
fulfillment **provider** architecture (as opposed to the shipping options
themselves) has never been touched.

### Medusa's real extension point
Medusa v2 models delivery through **fulfillment providers** (a module you
register in `medusa-config.ts`, implementing `getFulfillmentOptions`,
`createFulfillment`, `cancelFulfillment`, etc.) plus **shipping options** that
reference a provider and a service zone. This is exactly the extensibility
point your brief asks for ("architect so more providers can be added later") —
it's not something to invent, Medusa already has the seam:

- **Store Pickup** → a genuinely simple, first-party fulfillment provider:
  `getFulfillmentOptions` returns a static list of pickup locations (from a
  small config, not hardcoded strings scattered in the UI), no external API,
  `createFulfillment` is a no-op (nothing to call out to). Low risk, no
  external dependency, can ship first.
- **BOX NOW** → a genuinely new fulfillment provider that calls BOX NOW's
  Partner API. Researched this session (see caveats below): BOX NOW exposes
  an OAuth2 (client-credentials) REST API for locker search and voucher
  creation, but **getting access requires an actual merchant/courier-partner
  relationship with BOX NOW**, not a self-serve API key — I could not verify
  this live (their docs page 403'd on direct fetch; this is from search
  results, not a page I read myself). **This is a blocking external
  dependency, the same class of blocker as the missing Greece shipping zone
  found in Phase 4B — it needs you to actually contact/contract with BOX NOW
  before any integration code is useful, not a purely technical decision.**
  No official or community Medusa plugin exists for BOX NOW — this would be
  built from scratch as a custom fulfillment provider module.

### Required changes / components affected
- **Backend**: two new fulfillment-provider modules (`src/modules/store-pickup`,
  `src/modules/box-now`), registered in `medusa-config.ts`; new service
  zone(s)/shipping options wired to each; BOX NOW's API credentials in backend
  `.env` (never client-exposed).
- **Storefront**: `ShippingSection.tsx` needs a real redesign — right now it's
  a flat radio list of price/name. A locker-picker needs its own UI state (a
  "choose your locker" sub-step: search by area/postal code → list real
  lockers from BOX NOW's destination-search endpoint → confirm). Store Pickup
  needs a short, simple location/instructions block (§ below). This is a
  genuine UI expansion of `ShippingSection.tsx`, not a copy-paste of the
  existing radio pattern — locker selection has a real data-fetch step the
  existing shipping options don't.
- **New type**: `Cart`/checkout domain types need a place to carry
  "which locker was chosen" (BOX NOW requires the specific locker ID at
  fulfillment time, not just "BOX NOW" as a method) — likely
  `cart.shipping_address` metadata or a Medusa `metadata` field on the
  shipping method, needs live verification of what Medusa's shipping-method
  metadata actually supports before assuming.

### Store Pickup specifics (from your brief)
Simple by design, per your own instruction. One (or a small config-driven
list of) pickup location(s), each with an address, opening hours, and a short
"ready within X" instruction. No new external dependency — this is markup +
a small config file, could ship independently of BOX NOW and de-risk the
fulfillment-provider pattern before the harder locker integration.

### Medusa / DB impact
New fulfillment provider modules + new shipping options/service zones — additive,
same low-risk pattern as the Greece geo_zone fix in Phase 4B. No schema changes
beyond what Medusa's own fulfillment tables already model.

### Performance / SEO
Locker search should be a Server Action or route handler proxy (never expose
BOX NOW API credentials to the client) with debounced client input — same
shape as the existing search-preview pattern already in this codebase
(`lib/actions/search.ts`). No SEO impact — checkout is `noindex` already.

### Security
BOX NOW OAuth2 credentials stay server-side only, same rule already followed
for `DATABASE_URL`/`JWT_SECRET`. Never let the client call BOX NOW directly.

### Mobile / Desktop UX
Locker picker needs a real mobile pattern (a bottom sheet or inline expandable
list, not a modal that fights the existing single-scroll-page checkout
philosophy from Phase 4B) — needs its own short wireframe pass once BOX NOW
access is confirmed, not designed blind in this document.

### Testing
Cannot be verified live until BOX NOW sandbox credentials exist. Store Pickup
can be fully built and verified without any external dependency.

**Open decision**: do you already have (or can you get) a BOX NOW
merchant/partner account and API credentials? Nothing beyond Store Pickup can
be built against a real API without this.

---

## 2. Smart address autocomplete

### Existing implementation
None — `AddressSection.tsx` is plain manual `Οδός`/`Αριθμός`/`ΤΚ`/`Πόλη`/
`Περιοχή` text inputs, no dependency for this exists yet.

### Recommendation: Google Places API (New), not Mapbox
Researched this session — Google's session-based Autocomplete + Place Details
pricing is free or near-free at a few thousand sessions/month (billed per
session only if a session doesn't end in a Place Details call), Greek
street/ΤΚ coverage is well-established, and Next.js integration is more
mature. Mapbox's Greek address depth has reportedly improved but I could not
verify current parity for Greece live — **flagging honestly**: if you want
certainty before committing, the fair test is pulling a batch of real Greek
addresses through both and comparing, not trusting either vendor's marketing
claim. Given the cost is near-zero at your current scale either way, I'd
default to Google unless you have a reason to prefer Mapbox (e.g. already
using Mapbox elsewhere).

### Required changes
- New dependency (`@googlemaps/js-api-loader` or a lean fetch-based
  integration — a full SDK is not required just for Autocomplete+Details).
- `AddressSection.tsx` gains an autocomplete-enabled `Οδός` field: user types
  → debounced predictions → selecting one populates Οδός/Αριθμός/Πόλη/ΤΚ via
  Place Details, **fields stay fully editable after autofill** (your own
  requirement — never a locked field). A small map-pin confirmation (a static
  Maps Embed/Static Maps image is cheaper and simpler than a full interactive
  map widget for a one-line confirmation — recommend Static Maps unless you
  want a fully interactive map).
- Google API key: **client-side key, restricted by HTTP referrer** (Places
  Autocomplete JS widget requires a browser-exposed key by design — this is
  normal for Google Maps Platform, not a leak, but the key must be
  referrer-restricted in Google Cloud Console to the storefront's real domain).

### Medusa / DB impact
None — this is purely a storefront form-UX layer feeding the same
`shipping_address` fields Medusa already accepts.

### Performance
Google's Places JS library is not tiny (~40-60kB gzipped depending on
libraries loaded) — load it lazily (only on `/checkout`, only once the
address field is focused/interacted with, not in the root layout) to protect
the rest of the site's Core Web Vitals. This needs a real lazy-load
implementation, not `next/script` with `beforeInteractive`.

### SEO
None — checkout is `noindex`/robots-blocked already.

### Security
Client-exposed key is expected for this API family; restrict by HTTP referrer
in Google Cloud Console, never reuse a server-side key for it.

### Mobile / Desktop UX
Predictions dropdown needs real keyboard/touch handling (arrow keys + Enter on
desktop, tap on mobile) and must not fight the existing 44px touch-target
standard. Manual entry must always work with zero JS — a slow/blocked Maps
script should degrade to the current plain fields, not break the form.

### Testing
Real Greek addresses (urban + at least one rural/island postal code) clicked
through live, both keyboard-only and touch, plus the "Maps script fails to
load" degrade path.

---

## 3. Billing address toggle

### Existing implementation
None — Medusa carts support a separate `billing_address` object
(distinct from `shipping_address`) already, at the API level; the storefront
just never uses it — `updateCheckoutDetailsAction` only ever writes
`shipping_address`.

### Required changes
- Checkbox: "Τα στοιχεία τιμολόγησης είναι διαφορετικά από τη διεύθυνση
  αποστολής" — unchecked by default, matching your spec.
- A new `BillingAddressSection.tsx` (same field shape as `AddressSection.tsx`,
  reused via the same `FormField` components — not a duplicated design)
  that smoothly expands/collapses (CSS grid-rows or `max-height` transition,
  ~150-200ms per this project's existing motion convention — not a hard
  show/hide).
- `updateCheckoutDetailsAction` (or a new sibling action) needs to
  conditionally include `billing_address` in the same cart write, defaulting
  to a copy of `shipping_address` when unchecked (Medusa's own completion
  flow expects a billing address to exist, confirmed by the current code
  never setting one — **worth verifying live whether cart completion
  currently silently defaults billing to shipping or would newly require an
  explicit write; this needs a real API check before assuming**, since Phase
  4B's build never exercised billing-address-absent behavior against a paying
  flow that requires an invoice).
- **Preserve entered values while unchecked** (your requirement) means the
  billing fields' React state shouldn't be destroyed on uncheck — keep it in
  local state, just don't render/submit it, same pattern as any
  progressive-disclosure form section.

### Medusa / DB impact
None beyond using a field Medusa's cart object already has.

### Testing
Toggle on/off repeatedly with data entered, confirm nothing is lost; confirm
order confirmation page and (once built) the invoice email both show the
correct billing address when it differs from shipping.

---

## 4. Greek tax documents: Απόδειξη / Τιμολόγιο, ΑΦΜ, AADE

This is the single most involved addition — it touches checkout UI, cart
data, order emails, and a real external compliance-adjacent lookup.

### 4.1 Receipt vs. Invoice toggle
Two radio options, Απόδειξη (default) / Τιμολόγιο. No Medusa-native field for
this exists — needs to live in `cart.metadata` (Medusa carts support an
arbitrary `metadata` object; this is the normal Medusa pattern for
store-specific fields that aren't part of the core commerce model, not a
schema change).

### 4.2 Invoice fields + ΑΦΜ validation
When Τιμολόγιο is selected: reveal Επωνυμία, ΑΦΜ, ΔΟΥ, Δραστηριότητα,
Έδρα/Διεύθυνση fields (Έδρα can reuse the billing-address pattern from §3
rather than being a third address form).

**ΑΦΜ checksum validation** — this is a well-defined, standard algorithm (a
weighted mod-11 checksum against the 9-digit ΑΦΜ), can be implemented
entirely client-side with no external call, same "validate on blur" pattern
as the existing `isValidPhone`/`isValidPostalCode` helpers in
`lib/checkout-validation.ts`. Low risk, no new dependency, no external
service needed for *validation* (as opposed to *lookup*, next section).

### 4.3 AADE / business lookup — real findings, real caveat
Researched this session, and this is the part of your brief I'd push back on
directly:

- The official AADE service ("Αναζήτηση Βασικών Στοιχείων Μητρώου
  Επιχειρήσεων", via myDATA web services) requires **the requesting
  business's own TAXISnet credentials plus separately-applied-for special API
  access codes** — this is a B2B compliance-lookup tool, gated behind you
  (STIA) having your own registered-business TAXISnet login, not a public
  self-serve API key. It's built for businesses verifying other businesses'
  tax status, not consumer-checkout autofill — using it for this is a
  repurposing that plenty of Greek ecommerce sites do in practice, but the
  access process is a real administrative step (contacting AADE, not signing
  up on a developer portal), and I could not verify rate limits or exact
  response SLAs live.
- **Recommended alternative: ΓΕΜΗ Open Data API**
  (`opendata.businessportal.gr`) — free, registers via a simple `api_key`
  request (no TAXISnet), returns company registry data by ΑΦΜ/ΓΕΜΗ number
  (name, address, registration status). Lower friction, faster to actually
  get working, and covers the core ask (autofill Επωνυμία + Έδρα from a valid
  ΑΦΜ). It won't return ΔΟΥ or Δραστηριότητα/ΚΑΔ as reliably as the AADE
  registry service might — **this is the "some fields cannot legally or
  technically be retrieved" case your brief already anticipates**: ship ΓΕΜΗ
  lookup for what it covers, leave ΔΟΥ/Δραστηριότητα as manual-entry fields
  always, with a small helper note, rather than blocking the whole feature on
  the harder AADE integration.
- Either way: **the lookup call happens server-side only** (a small Medusa
  custom API route, e.g. `POST /store/afm-lookup`, proxying to ΓΕΜΗ/AADE) —
  the storefront never holds the API key. This satisfies your "never expose
  sensitive credentials on the client" requirement directly.

**Open decision**: start with ΓΕΜΗ (fast, real, lower-friction) and treat
direct AADE myDATA registry access as a later upgrade once you've actually
gone through AADE's access process? I'd recommend this rather than blocking
the whole invoice flow on TAXISnet paperwork.

### Required changes / components affected
- Backend: one new custom API route (AFM lookup proxy), `cart.metadata` fields
  for document type + invoice details (or a dedicated `TaxDetails` shape
  stored there).
- Storefront: new `TaxDocumentSection.tsx`, ΑΦΜ checksum validator in
  `lib/checkout-validation.ts`, a lookup-triggered autofill flow (debounced
  on valid-checksum ΑΦΜ, not on every keystroke — same discipline as the
  address autocomplete's debouncing).
- Order confirmation page + order email (§6) both need to render invoice
  details when present.

### Medusa / DB impact
`cart.metadata`/`order.metadata` only — no schema change, but **this needs
live verification that `metadata` survives cart→order completion intact**
(Medusa's own documented behavior says it does, but this project's rule is
verify-live-not-assumed, same as every other Medusa claim in this repo).

### Security
AFM lookup key server-side only. No sensitive personal data beyond what a
legitimate invoice already needs; still worth confirming GDPR-appropriate
handling (a business ΑΦΜ/name isn't the same sensitivity class as a personal
SSN, but treat it carefully regardless).

### Testing
Real 9-digit ΑΦΜ checksum edge cases (valid, invalid, wrong length), a real
lookup against whichever service is chosen, and the full toggle → reveal →
autofill → still-editable flow end to end.

---

## 5. Payment methods

### Existing implementation
One provider, `pp_system_default`, presented as "Αντικαταβολή" — this is a
deliberate, already-approved decision from Phase 4B (§0.3 of
`CHECKOUT_UX_SPEC.md`), not something to revisit lightly.

### Important context you should know before deciding
**A prior session explicitly held off picking/integrating a real payment
processor at your own instruction** — you said you'd set up the processor
account yourself first, and asked me not to pick one or start integrating on
my own initiative. Your new brief asks me to "recommend the best payment
provider for Greece" and lists Visa/Mastercard/Apple Pay/Google Pay/IRIS as
targets — I'll give the recommendation below since you're asking directly,
but **actual integration still needs real (even test-mode) credentials from
an account you control**, same constraint as before.

### Recommendation
Researched this session:
- **Stripe** has an official, Medusa-maintained payment module
  (`@medusajs/medusa/payment-stripe`) — genuinely the lowest-integration-effort
  path, supports cards + Apple Pay + Google Pay out of the box. **No IRIS
  support** (IRIS is a Greek/DIAS-specific instant-transfer rail Stripe
  doesn't offer).
- **Viva Wallet** has real IRIS support (and cards/Apple Pay/Google Pay) and
  strong Greek-market fit (Greek PSP, local support) — but **no existing
  Medusa plugin was found**, official or community. Integrating it means
  building a custom Medusa v2 payment-provider module against Viva's REST/
  Cloud API from scratch.
- **My recommendation**: Stripe first (fast, official plugin, covers card +
  Apple Pay + Google Pay — the majority of card-based online payment volume),
  with Viva Wallet as a second provider once you specifically want IRIS —
  architecture already supports this (`PaymentSection.tsx` already renders
  whatever `/store/payment-providers` returns, not a hardcoded list; adding a
  provider is additive, exactly like your brief asks for). If IRIS is
  actually a near-term priority for you (it's become a very common
  expectation in Greek ecommerce), building the Viva module first instead of
  Stripe is a reasonable alternative call — this is a real trade-off, not an
  obvious answer, and worth you weighing in on directly.
- Keep **Αντικαταβολή** — Greek market still trusts COD highly, and it's
  already working; this is additive, not a replacement.

### Required changes
- Backend: install/configure `@medusajs/medusa/payment-stripe` (config +
  webhook endpoint for payment confirmation) and/or a new custom Viva Wallet
  payment-provider module.
- Storefront: `PaymentSection.tsx`'s hardcoded `PROVIDER_LABELS` map needs
  real entries for each new provider ID, plus (for Stripe) mounting Stripe's
  Payment Element / Apple Pay / Google Pay button components — this is a real
  UI addition, not just a label change, since card payment needs its own
  client-side element mounted and confirmed, unlike the current
  radio-button-only COD flow.
- `completeCheckoutAction` currently always picks `providers[0]` — once more
  than one provider exists, this needs to become "whichever the customer
  actually selected," a real logic change, not cosmetic.

### Existing copy debt (found in Phase 4B, still unfixed)
`TrustStrip.tsx` (homepage) and the PDP delivery block still say "Κάρτα, Viva
Wallet ή αντικαταβολή" — aspirational copy from before any processor existed.
**This finally becomes true once a real card provider ships** — reconcile
these two copy blocks as part of this work, not a separate task.

### Security
PCI scope: using Stripe's Payment Element (hosted fields) or Viva's hosted
checkout/iframe keeps card data out of STIA's own servers entirely — don't
build a raw card-number form. Standard, not optional.

### Testing
Full test-mode charge (success + a real decline) for whichever provider(s)
you set up test credentials for; COD flow re-verified unchanged.

**Open decision**: Stripe first, Viva first, or both together? And: can you
get test-mode credentials for whichever you pick, same gate as last time?

---

## 6. Order confirmation emails

### Existing implementation
None — no notification module configured, no `order.placed` subscriber
exists (`src/subscribers/` is empty). Order confirmation today is *only* the
`/checkout/epibebaiosi` page — nothing is emailed.

### Recommendation
Medusa's documented, first-party-supported pattern: **Notification module +
Resend (or SendGrid) provider + a subscriber on the `order.placed` event.**
This is the standard path (official Medusa guide exists for Resend
specifically), not something to build a custom pipeline for.

### Required changes
- Backend: register the notification module + Resend provider in
  `medusa-config.ts`, add `RESEND_API_KEY` to `.env`, write
  `src/subscribers/order-placed.ts` calling
  `notificationModuleService.createNotifications(...)`.
- A real HTML email template — matching brand (Inter/Literata, the terracotta
  accent, the same restrained visual language as the site) — needs product
  images. **Real product photography doesn't exist yet** (site-wide
  `PlaceholderTile` stand-in) — the email template should use the same
  placeholder tiles as everywhere else rather than assuming real images that
  don't exist, consistent with this project's anti-fabrication rule; swapping
  in real photos later is a template change, not a re-architecture.
- Content: your list (customer name, order #, products, images, SKU, qty,
  unit price, VAT breakdown, shipping method, payment method, total, billing,
  shipping, contact) — all of this is already present on `order` once fetched
  with the right fields (same `getOrder`/`toDomainOrder` pattern already used
  for the confirmation page, reusable rather than rebuilt), **except VAT
  breakdown**, which needs checking live — Medusa's tax_total is currently
  fetched as a single number for the confirmation page; a real per-line VAT
  breakdown needs `+items.tax_lines` or similar, unverified until built.

### Medusa / DB impact
None beyond the notification module's own tables (Medusa-managed).

### Security
Resend API key server-side only, standard.

### Testing
A real test order through to a real inbox, checked on both a desktop mail
client and a phone mail app (email HTML rendering is notoriously
inconsistent — this needs actual visual verification, not just "the template
compiles").

---

## 7 & 8. Cart and wishlist persistence

### Reality check on what your brief is asking for
Both sections ask for "guest / returning visitors / logged-in customers" and
"synchronize whenever possible." **This store has no customer accounts at
all** — no login, no session, no `/store/customers` usage anywhere. So:

- **Guest persistence already exists and is solid** for both cart (httpOnly
  cookie, 30-day, server-resolved) and wishlist (`localStorage`, real
  external store, SSR-safe). Nothing needs rebuilding here — this already
  satisfies "never unexpectedly lose the cart/wishlist" for every visitor
  today, since every visitor today is a guest.
- **"Logged-in customer" sync has no account system to sync against.** Building
  real customer accounts (Medusa does support this — `/store/customers`,
  password or social auth) is its own significant feature, not a checkout
  sub-task, and it's the actual prerequisite for anything in §7/§8 beyond what
  already works. I'd treat "customer accounts + cart/wishlist merge-on-login"
  as an explicitly separate phase (it touches auth, session management, and a
  real merge-conflict UX question — "you have a cart on this device and a
  different one on your account, which wins?" — that deserves its own short
  spec, not a paragraph here) rather than something silently included in the
  checkout brief.

### Recommendation for this phase
Ship the checkout/tax/delivery/payment work against the **existing, already-
solid guest persistence** — it already meets your stated bar. Treat customer
accounts (and the cart/wishlist sync that depends on it) as a clearly-flagged
follow-up, not bundled into this build. Happy to scope that separately once
you want it.

---

## 9. Recommended phase order

Given the size, I'd sequence this so each phase is independently testable
(same discipline as every prior phase in this project), roughly:

1. **Store Pickup** — no external dependency, exercises the new
   fulfillment-provider pattern safely.
2. **Billing address toggle** + **receipt/invoice toggle + ΑΦΜ validation**
   (client-side only, no external service) — pure checkout-form work.
3. **Address autocomplete** (Google Places) — independent of everything else,
   improves the existing address section directly.
4. **ΑΦΜ/business lookup** (ΓΕΜΗ first) — depends on #2's fields existing.
5. **Order confirmation emails** — depends on nothing above, could actually
   move earlier if you want it sooner; genuinely independent.
6. **BOX NOW** — blocked on you securing API access; can start in parallel
   with the above once credentials exist.
7. **Real payment gateway(s)** — blocked on you choosing + getting test
   credentials, same gate as before.
8. *(Separate, later, explicitly not part of this brief unless you want it
   pulled in)* — customer accounts + cart/wishlist sync.

## 10. Cross-cutting: performance, SEO, security (applies to all of the above)

- **Performance**: every new external script (Google Maps JS, Stripe.js,
  BOX NOW widget if one exists) loads lazily and only on `/checkout` — never
  in the root layout, protecting the rest of the site's Core Web Vitals
  exactly as your brief requires. `/checkout` is already dynamically
  rendered (cart cookie dependency) so this doesn't change its rendering
  mode, just its client JS payload.
- **SEO**: zero impact expected — checkout is already `noindex`/robots-blocked.
  Verify this remains true if any new route (e.g. a dedicated invoice/tax
  page) is added rather than folded into the existing single-page checkout.
- **Security**: every external API key (BOX NOW, AFM lookup, Resend, Stripe
  secret key) stays server-side; only Google Maps' and Stripe's *publishable*
  client keys are client-exposed, both by design for those specific SDKs, both
  restricted (HTTP referrer / publishable-key semantics respectively).
- **Medusa as source of truth**: every new piece of data (delivery choice,
  locker ID, tax document type, ΑΦΜ) lives on the Medusa cart/order (via
  `metadata` where no native field exists) — nothing gets a parallel
  storefront-only database or duplicated business logic, per your §11.

---

## Decisions (2026-08-09) — recorded before any code was written

1. **BOX NOW**: deferred. Ship **Store Pickup only** this phase; the
   fulfillment-provider architecture is still built so BOX NOW (or another
   locker network) is an additive module later, not a rework.
2. **Payment**: **Stripe first** (official Medusa plugin, cards + Apple Pay +
   Google Pay). Viva Wallet/IRIS stays a documented future option (§5), not
   built this phase. Still needs real (test-mode) Stripe credentials from you
   before the actual integration step — same gate as before.
3. **ΑΦΜ lookup**: **ΓΕΜΗ Open Data API** (lower friction, no TAXISnet).
   ΔΟΥ/Δραστηριότητα stay manual-entry fields.
4. **Customer accounts / cart-wishlist sync**: confirmed **out of scope** for
   this phase — ship against the existing guest persistence, scope accounts
   separately later.

## Revised phase order (BOX NOW removed, per the decision above)

1. ~~Store Pickup (new fulfillment-provider module, extensible architecture)~~
   — **done (2026-08-09)**, built and verified live with the real pickup
   address (Σφακιανάκη 4, Ηράκλειο) and hours; see `CHANGELOG.md` and
   `PROJECT_MEMORY.md`.
2. Billing address toggle + receipt/invoice toggle + ΑΦΜ checksum validation
   (client-side only)
3. Address autocomplete (Google Places)
4. ΑΦΜ/business lookup (ΓΕΜΗ Open Data)
5. Order confirmation emails (Resend + `order.placed` subscriber)
6. Stripe payment integration (needs your test-mode credentials)

Each phase gets built, verified live, `tsc`/`eslint`/`next build` clean, before
moving to the next — same discipline as every prior phase — with
`PROJECT_MEMORY.md`/`TASKS.md`/`CHANGELOG.md` kept current as we go.
