# Checkout UX Specification — Phase 4B

Status: **DRAFT — awaiting final approval to begin the checkout build. No checkout
code has been written.** The three groundwork decisions in §0 have been made and
applied (see below); this is the finalized design, ready for a go/no-go on
implementation.

**Decisions made and applied (2026-08-08):**
- §0.1 (Greece missing from the shipping service zone) — **fixed**, via Admin
  API, verified live: Greek addresses now resolve both real shipping options.
- §0.2 (unbacked free-shipping promise) — **softened**, per explicit decision:
  `FreeShippingProgress` disabled behind a flag (not deleted — trivially
  reversible once a real rule exists), and the sitewide `AnnouncementBar`
  banner's *separate, hardcoded, mismatched* "δωρεάν αποστολή άνω των 39€"
  claim was also removed (found while fixing this — same underlying issue, an
  even more prominent unbacked promise, with a threshold that didn't even
  match the cart's own €50 config).
- §0.3 (payment method label) — **decided**: "Αντικαταβολή" (Cash on
  Delivery). §0.4's homepage/PDP copy inconsistency should be reconciled to
  this during implementation.

Research grounding: every Medusa claim below was verified live against the running
backend this session (not assumed from docs/memory), per this project's established
rule. Competitor research is honest about its limits — see §0.5.

---

## 0. Findings that affect the design more than any wireframe choice

### 0.1 — Blocking: Greece is not in the shipping service zone (real bug, not a UI question)

Tested live: setting a cart's shipping address to Greece and querying
`/store/shipping-options?cart_id=...` returns **zero** valid options. Setting the
same cart to a German address returns both configured options normally. The
fulfillment set's service zone lists 7 countries (`gb, de, dk, se, fr, es, it`) —
the exact leftover set from Medusa's demo seed — and **Greece was never added**,
even though Greece *was* added to the sales region and the tax region back in
Phase 2/3. This is the same class of bug as the "region didn't include Greece"
finding from Phase 2, just in a different subsystem (fulfillment, not sales
region), and it was missed because nothing in Phases 1–4A ever exercised the
shipping-options-for-a-real-address path — the cart never needed it.

**Practical effect: no Greek customer can complete checkout today, regardless of
how good the UI is.** This needs a one-time Admin API fix (add a `gr` geo_zone to
the existing service zone) — additive, low-risk, not a UI/code change. I have not
made this change. **Want me to fix it now**, separately from the checkout build
(it's backend configuration, not checkout code), or hold it until implementation
starts?

### 0.2 — The cart's "free shipping" promise isn't backed by a real rule yet

Confirmed live (already noted once in `PROJECT_MEMORY.md` from the Phase 4A cart
work, resurfacing because it's now checkout-relevant): both shipping options are
flat-rate with no conditional discount. The cart's "🎉 Έχεις ΔΩΡΕΑΝ μεταφορικά"
message is a **frontend-only promise** — nothing on the backend actually zeroes
out shipping cost yet. If checkout is built against the real API as-is, a
customer who saw "free shipping" in the cart would still be charged the real
flat rate at checkout — a direct, visible broken promise at the worst possible
moment. This needs either (a) a real Medusa promotion targeting shipping methods
once the free-shipping threshold is a real business decision, or (b) the cart's
messaging softened until it's backed by something real. Flagging now because
checkout is where this gap becomes customer-visible, not because it's new.

### 0.3 — Only one payment provider exists: `pp_system_default`

Confirmed live via `/store/payment-providers`. There is no Stripe, Viva Wallet,
or Everypay configured — just Medusa's generic manual/system provider, which
exists mainly as a placeholder for "capture payment outside the automated flow."
**Decided: this single method is presented as "Αντικαταβολή" (Cash on
Delivery)** — honest to what the backend can actually do today, and a
familiar, trusted method in the Greek market. The design below architects the
payment step to read its options from the live API (not a hardcoded list), so
adding a real processor later is a data change, not a redesign — at that
point "Αντικαταβολή" simply becomes one option among several rather than the
only one.

### 0.4 — The homepage and PDP already promise payment methods that don't exist yet

Found while cross-checking §0.3: `TrustStrip.tsx` (homepage) currently says
"Ασφαλείς πληρωμές: Κάρτα, Viva Wallet ή αντικαταβολή" and the PDP's delivery
info block says "Πληρωμή: Κάρτα, Viva Wallet, αντικαταβολή" — both written
during Phase 1/3 as placeholder/aspirational copy, before any payment
provider was actually configured (confirmed by §0.3: only
`pp_system_default` exists today). This isn't new to this session, but
checkout is the moment this becomes load-bearing rather than decorative —
whatever gets decided for §0.3 should also reconcile these two existing
copy blocks so the site stops promising something checkout can't deliver.
Not proposing a fix here (out of scope for this spec), just flagging it
alongside §0.3 since it's the same underlying decision.

### 0.5 — Competitor research: what I could and couldn't verify

Live access to Kouzinika, Spitishop, and (this session) public.gr was blocked by
this environment's browsing controls on every attempt. I did reach Estia Home
Art once, earlier in this project, and confirmed its header is fairly dense
(register/login/wishlist/language-selector/search all competing for space) but
could not load its cart/checkout widget specifically. **I am not claiming to
have observed any competitor's current checkout UI live** — the analysis in §2
below is drawn from well-established, general Greek-ecommerce conventions
(guest-checkout-first, ΤΚ/address structure, COD's historical trust role,
Viva Wallet's market presence) and broadly published international checkout
usability research, not a specific site's exact implementation. Said plainly
rather than dressed up as verified observation.

---

## 1. Checkout UX strategy

**One scrollable page, not a multi-step wizard.** Every section (email → contact
→ address → shipping → payment → review) lives on one page, in order, each
validated as you go. No separate page loads between sections — the customer
never loses their place, never sees a "step 2 of 5" progress bar promising more
work than is actually left. The single most-cited cause of checkout abandonment
in the general body of checkout research is friction from unnecessary steps and
surprise requirements (surprise costs, forced account creation) — a single
honest page with a visible running total addresses both directly. Numbered
section headers (not a stepper widget) give orientation without the overhead of
literal page transitions.

**Guest-first, always.** Email is just a field on the Medusa cart
(`cart.email`) — confirmed live, no `/store/customers` call, no password, no
account required anywhere in the flow. Account creation is offered once, after
a successful order, entirely optional.

## 2. Competitor analysis (see §0.5 for what's verified vs. general knowledge)

| Pattern | What it does well | What creates friction | Verdict for STIA |
|---|---|---|---|
| Guest checkout as default (near-universal in Greek ecommerce) | Removes the #1 conversion killer — forced registration | — | Adopt, as already planned |
| Email requested first, before address | Lets order-confirmation infrastructure work even if the customer abandons later | None if explained | Adopt, with a one-line reason (§4) |
| COD as a payment option | High historical trust in the Greek market; works even where card adoption is lower | Slower fulfillment, no upfront revenue certainty for the merchant | Relevant given §0.3 — this may end up being the *only* real option until a processor is added |
| Multi-step wizards with a progress bar | Feels structured | Extra page loads, easy to lose the sense of "how much is left"; running total often not visible mid-flow | Avoid — single page instead |
| Trust badge walls (SSL logos, payment-method logos plastered everywhere) | Attempts to build confidence | Reads as compensating for something; dated, cluttered | Avoid — one quiet line near the CTA instead (§13) |
| Mandatory account creation before checkout | Data capture for the merchant | Reliably the highest-friction pattern in checkout research generally | Avoid entirely, as instructed |
| Collapsed/expandable order summary on mobile | Keeps the form the visual focus while total stays reachable | If total isn't visible even collapsed, defeats the purpose | Adopt, with total always visible even collapsed (§16) |

## 3. Recommended checkout structure

Single page, sections in this order (each is a section on one scroll, not a
separate URL):

1. **Η παραγγελία σου** — collapsed order summary (mobile) / persistent sticky
   card (desktop) — shown first so "how much am I paying" is answered before
   any data entry starts.
2. **Email**
3. **Στοιχεία παραλήπτη** (name, phone)
4. **Διεύθυνση παράδοσης**
5. **Τρόπος αποστολής**
6. **Πληρωμή**
7. **Έλεγχος & Ολοκλήρωση** — final review + submit

## 4. Desktop wireframe (≥1024px)

```
┌─────────────────────────────────────────────┬───────────────────────────┐
│  1  Email                                    │  Η παραγγελία σου          │
│     [ email@example.com            ]         │  ┌────┐ Τηγάνι Wok 30cm    │
│     Θα σου στείλουμε την επιβεβαίωση          │  │IMG │ Ποσ.: 2 · 85,80€   │
│     της παραγγελίας σε αυτό το email.        │  └────┘                    │
│                                               │  ┌────┐ Κατσαρόλα 24cm     │
│  2  Στοιχεία παραλήπτη                       │  │IMG │ Ποσ.: 1 · 54,50€   │
│     [ Όνομα        ] [ Επώνυμο      ]        │  └────┘                    │
│     [ Τηλέφωνο                     ]         │  ─────────────────────    │
│                                               │  Υποσύνολο      140,30€   │
│  3  Διεύθυνση παράδοσης                      │  Έκπτωση         −7,94€   │
│     [ Οδός                 ] [ Αριθμός ]     │  Μεταφορικά        10,00€  │
│     [ ΤΚ        ] [ Πόλη            ]        │  ─────────────────────    │
│     [ Περιοχή (προαιρετικό)        ]         │  Σύνολο          142,36€   │
│     Χώρα: Ελλάδα                             │                             │
│                                               │  🔒 Ασφαλής πληρωμή        │
│  4  Τρόπος αποστολής                         │  Δωρεάν επιστροφές          │
│     ( ) Στάνταρ αποστολή      10,00€         │  εντός 30 ημερών            │
│         Παράδοση σε 2–3 εργάσιμες            │                             │
│     ( ) Ταχεία αποστολή       10,00€         │                             │
│         Παράδοση εντός 24 ωρών               │                             │
│                                               │                             │
│  5  Πληρωμή                                  │                             │
│     (•) Αντικαταβολή                         │                             │
│         Πληρώνεις όταν παραλάβεις             │                             │
│                                               │                             │
│  ────────────────────────────────────────    │                             │
│  [   ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ · 142,36 €   ]  │                             │
└─────────────────────────────────────────────┴───────────────────────────┘
```

Right column mirrors the cart page's already-established sticky-summary
pattern (`CartPageView.tsx`) — same spatial language site-wide, not a new one
invented for checkout.

## 5. Mobile wireframe (375px)

```
┌───────────────────────────┐
│ Η παραγγελία σου · 142,36€ ▾│   ← collapsed, total always visible
├───────────────────────────┤
│ 1  Email                   │
│ [ email@example.com    ]   │
│ Θα σου στείλουμε την        │
│ επιβεβαίωση σε αυτό το     │
│ email.                     │
│                             │
│ 2  Στοιχεία παραλήπτη      │
│ [ Όνομα              ]     │
│ [ Επώνυμο            ]     │
│ [ Τηλέφωνο           ]     │
│                             │
│ 3  Διεύθυνση παράδοσης     │
│ [ Οδός               ]     │
│ [ Αριθμός            ]     │
│ [ ΤΚ                 ]     │
│ [ Πόλη               ]     │
│ [ Περιοχή (προαιρ.)  ]     │
│ Χώρα: Ελλάδα                │
│                             │
│ 4  Τρόπος αποστολής        │
│ ( ) Στάνταρ · 10,00€       │
│ ( ) Ταχεία · 10,00€        │
│                             │
│ 5  Πληρωμή                 │
│ (•) Αντικαταβολή           │
│     Πληρώνεις όταν         │
│     παραλάβεις             │
├───────────────────────────┤
│ [ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ]   │ ← sticky bottom, always reachable
│      142,36 €              │
└───────────────────────────┘
```

Real inputs, not desktop shrunk: `type="email"` (email keyboard),
`type="tel"` (numeric keyboard) for phone, `inputmode="numeric"` for ΤΚ — each
field summons the right mobile keyboard. 44px+ touch targets throughout,
matching the cart's established standard.

## 6. Exact Greek labels

| Field/element | Label | Notes |
|---|---|---|
| Section 1 | Email | Helper: "Θα σου στείλουμε την επιβεβαίωση της παραγγελίας σε αυτό το email." |
| Section 2 | Στοιχεία παραλήπτη | Όνομα, Επώνυμο, Τηλέφωνο |
| Section 3 | Διεύθυνση παράδοσης | Οδός, Αριθμός, ΤΚ, Πόλη, Περιοχή (προαιρετικό), Χώρα |
| Section 4 | Τρόπος αποστολής | Per-option: name, delivery estimate, price |
| Section 5 | Πληρωμή | Today, one option: "Αντικαταβολή" — "Πληρώνεις τοις μετρητοίς όταν παραλάβεις την παραγγελία σου." Driven by live `/store/payment-providers`, not hardcoded — more real providers appear automatically once configured. |
| Order summary | Η παραγγελία σου | Υποσύνολο / Έκπτωση / Μεταφορικά / Σύνολο (same words as the cart) |
| Final CTA | ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ | See §15 for why this differs from the cart's "ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ" |
| Cart → checkout CTA | ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ | As you specified; already wired in the cart (currently linking to the not-yet-built `/checkout`) |

## 7. Guest checkout flow

```
/kalathi → click "ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ" → /checkout
  (same Medusa cart carries over — coupon, items, discounts already applied,
   nothing re-entered)
→ fill email + contact + address (each section validates inline)
→ pick shipping method (real price appears immediately)
→ pick payment method
→ review (everything visible on the same page, scroll up to change anything)
→ ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ
→ order created → /checkout/epityhis (or similar) confirmation page
```

No login. No "create account" wall. No separate address-entry page.

## 8. Shipping flow

- Shipping options fetched live from `/store/shipping-options?cart_id=...`
  once the address is complete enough to resolve them (needs at minimum
  country + postal code) — never hardcoded.
- Each option shows: name (translated to Greek presentation copy, not
  renamed in Medusa), delivery estimate, exact price.
- Selecting one calls Medusa's add-shipping-method endpoint immediately: the
  order summary's Μεταφορικά line and Σύνολο update in place, not just on
  final submit.
- **Depends on §0.1 being fixed** — right now this section would show "no
  shipping methods available" for every Greek address.

## 9. Payment flow

- Payment methods fetched live from `/store/payment-providers?region_id=...`
  — today, exactly one, presented as **"Αντικαταβολή"** (§0.3). Selecting it
  creates a payment collection + payment session (already confirmed the
  payment-collection endpoint works correctly) and completes on order
  submission.
- Architected so a second/third real provider (Viva Wallet, Stripe) slots in
  as another radio option automatically once configured — no redesign.

## 10. Order summary

Reuses the cart's compact line-item presentation (image, title, quantity,
price) rather than the full 5-column desktop table — appropriate density for
a persistent sidebar/collapsed panel rather than the cart's own dedicated
page. Totals block reuses the exact same words as `CartTotals.tsx`
(Υποσύνολο / Έκπτωση / Μεταφορικά / Σύνολο) for consistency — except
**Μεταφορικά is now a real number**, not "Υπολογίζεται στο checkout", once a
shipping method is chosen. Any coupon applied in the cart is already on the
same Medusa cart object — nothing to re-enter.

## 11. Product images

Small (thumbnail-scale, consistent with the cart's own `PlaceholderTile`
sizing at its most compact) — present for recognition, not full-size product
photography inside checkout.

## 12. Error states

| Scenario | Copy | Behavior |
|---|---|---|
| Invalid email | "Το email δεν είναι έγκυρο." | Inline, under the field, on blur |
| Missing required field | "Συμπλήρωσε αυτό το πεδίο." | Inline, on submit attempt |
| Invalid postal code | "Ο ταχυδρομικός κώδικας δεν είναι έγκυρος." | Inline |
| Invalid phone | "Το τηλέφωνο δεν είναι έγκυρο." | Inline |
| No shipping methods for this address | "Δεν είναι διαθέσιμη αποστολή για αυτή τη διεύθυνση. Επικοινώνησε μαζί μας." | Blocks progressing past shipping, not a silent dead end |
| Payment failure | "Η πληρωμή απέτυχε. Δοκίμασε ξανά ή επίλεξε άλλο τρόπο πληρωμής." | Stays on checkout, cart/data preserved |
| Product unavailable at completion | "Ένα προϊόν στο καλάθι σου δεν είναι πλέον διαθέσιμο." + link back to the line | Never a generic failure |
| Price changed since cart | "Η τιμή ενός προϊόντος ενημερώθηκε." + updated total shown | Non-blocking, informational |
| Coupon becomes invalid | "Ο κωδικός έκπτωσης δεν ισχύει πλέον." | Recalculated total shown |
| Session/cart expired | "Η παραγγελία σου έληξε. Ξεκίνα ξανά από το καλάθι." | Same honest pattern already used in the cart |
| Network/API failure | "Κάτι πήγε στραβά. Δοκίμασε ξανά." | Generic fallback only, never a raw error — same rule as the cart |

## 13. Loading states

Inline button spinners on submit (matches `AddToCartButton`/`CouponForm`'s
established "…" pattern), skeleton order summary on initial page load
(matches `CartDrawer`'s skeleton), shipping options show a small inline
loading state while resolving after address entry — never a full-page
blocking spinner.

## 14. Empty/unavailable states

- Arriving at `/checkout` with an empty cart → redirect to `/kalathi` (same
  empty-cart state already built), not a broken checkout form with nothing
  to check out.
- A line item going out of stock mid-checkout is handled at the error-state
  level (§12), not a separate empty state — the cart itself doesn't go
  empty just because one item did.

## 15. Order confirmation concept (design only, not built this phase)

Dedicated page (own URL, not a modal — survives a refresh/bookmark):

- "Η παραγγελία σου ολοκληρώθηκε." + order number (`order.display_id`)
- Total paid, delivery address, shipping method chosen
- "Σου στείλαμε επιβεβαίωση στο {email}"
- A short "τι γίνεται τώρα" timeline: Παραλάβαμε την παραγγελία →
  Προετοιμασία → Αποστολή → Παράδοση
- Support contact link
- **Optional, dismissable** post-purchase prompt: "Θέλεις να δημιουργήσεις
  λογαριασμό για τις επόμενες παραγγελίες;" — never blocking, never before
  the order exists.

## 16. Recommended final CTA wording

**"ΟΛΟΚΛΗΡΩΣΗ ΠΑΡΑΓΓΕΛΙΑΣ"**, with the total shown directly on/beside the
button (e.g. "Ολοκλήρωση παραγγελίας · 142,36 €") — deliberately *not* the
same words as the cart's "ΟΛΟΚΛΗΡΩΣΗ ΑΓΟΡΑΣ", because they're different
actions: one navigates to checkout, the other creates a binding, paid order.
Reusing identical wording for both would blur that distinction right at the
moment it matters most.

This also isn't only a stylistic choice: the EU Consumer Rights Directive
(2011/83/EU, Art. 8(2)) requires an online order button to be labeled
unambiguously as creating a payment obligation — the Directive's own example
wording is "order with obligation to pay." Greek ecommerce generally
satisfies this in practice with "Ολοκλήρωση Παραγγελίας" *combined with* a
clearly visible total right at the point of clicking, which is exactly what
showing the amount on the button itself reinforces. I'd avoid a literal
"ΑΓΟΡΑ ΜΕ ΥΠΟΧΡΕΩΣΗ ΠΛΗΡΩΜΗΣ" translation — it reads as machine-translated
legalese, not natural Greek retail copy, and isn't necessary given the
combined label+total approach is the real-world norm. Flagging the legal
basis explicitly since it's a genuine requirement, not just a preference —
happy to reconsider if you have specific legal guidance that says otherwise.

## 17. Why this should perform well for Greek customers

- Guest-first removes the single most common reason Greek (and general)
  shoppers abandon a cart — being asked to register before they're ready to
  commit to a merchant relationship.
- Email requested first, with a stated reason, builds the "I understand why
  you're asking" trust that an unexplained field doesn't.
- A single page with a visible, honest running total answers "how much am I
  paying" before it can become an anxiety — no surprise costs revealed at
  the very end.
- Real shipping/payment options pulled live from Medusa mean the checkout
  can never promise something the backend can't deliver — directly
  preventing the exact class of "cart said free shipping, checkout charged
  me anyway" trust breach flagged in §0.2.
- A quiet, single trust line near the CTA (security + returns + support)
  reads as confident, not defensive — matching the same restrained,
  premium visual language already established for the rest of this site.

---

## What happens after approval

Per the brief: fix §0.1 (if approved separately) and get a decision on §0.2
and §0.3, then a short implementation plan, then build incrementally against
the real Medusa checkout endpoints (cart update, shipping methods, payment
collections/sessions, cart completion — each verified against the live API
before being coded against, same discipline as every prior phase), then the
full test matrix specified in the brief, then `tsc`/`eslint`/`next build`,
then update `PROJECT_MEMORY.md`/`TASKS.md`/`CHANGELOG.md`. Order confirmation
UI ships as part of this phase (it's the natural end of the flow); nothing
about it is deferred.
