# Faster checkout: filled-in details + Continue with Google

Status: **Phase 1 built and tested (28 Σεπ 2026)**, see §6 · Phase 2 (Google) waits for the owner's Google keys · decisions in §5

The owner approved two steps in principle:

1. **Fill checkout from what we already know**, and make the browser's own
   autofill (Chrome with the Google account, Safari with the iCloud contact
   card) fill every field cleanly.
2. **"Συνέχεια με Google"** as a one-tap way to sign in or create an account.

Not included: Sign in with Apple (needs a paid Apple Developer account,
about $99/year, and gives less than Safari autofill already does), and
Apple Pay / Google Pay (the store has no card processor yet).

## 1. What happens today (read from the code, 28 Σεπ 2026)

- **The checkout fields always start empty**
  ([CheckoutForm.tsx:118](apps/storefront/src/components/checkout/CheckoutForm.tsx:118)).
  That holds for signed-in customers too, and even after a refresh when the
  cart already has the address saved: the shipping options still show, but
  the form above them is blank.
- **Saved addresses are only used on the account page**
  (`/logariasmos/diefthinseis`). Checkout never reads them.
- **Checkout has no way to sign in.** No "Σύνδεση" link, nothing.
- **Live database:** 4 customer rows (1 with a password), 0 orders, 0 saved
  addresses. No real customer data is affected by anything below.

### Autofill problems found

I found these by reading the code. Automation can't drive a real
Chrome/Safari autofill, so during the build I'll check them with a
simulated autofill plus one manual check on your phone.

| # | Problem | Where |
|---|---|---|
| A1 | **Autofilled fields don't get saved.** The form saves when you *leave* a field. Autofill fills every field at once without leaving any of them. If the customer starts autofill from the Email field, the name/address are never saved, so the shipping section keeps saying "fill in your address". Pressing the order button then does nothing visible: every field looks valid, so no error is shown. The same happens to the email when autofill starts from Όνομα. The customer is stuck with no explanation. | `handleDetailsBlur` [:280](apps/storefront/src/components/checkout/CheckoutForm.tsx:280), `findFirstInvalidFieldId` [:428](apps/storefront/src/components/checkout/CheckoutForm.tsx:428) |
| A2 | **Phone with country code is rejected.** "+30 694 123 4567" (how iPhone contacts and often Chrome store numbers) fails the 10-digit check → "Το τηλέφωνο δεν είναι έγκυρο." | [checkout-validation.ts:12](apps/storefront/src/lib/checkout-validation.ts:12) |
| A3 | **Postal code with a space is rejected.** "712 01", the way Greek postal codes are commonly written, fails the 5-digit check. | [checkout-validation.ts:16](apps/storefront/src/lib/checkout-validation.ts:16) |
| A4 | **Street and number land in one field.** Autofill puts "Ικάρου 25" into Οδός and leaves Αριθμός empty → "Παρακαλώ συμπληρώστε το πεδίο". | `AddressSection.tsx` |
| A5 | **The address suggestions pop open after autofill.** Filling Οδός triggers the Google address lookup, so the dropdown opens over the form, and it's a wasted lookup. | [AddressAutocomplete.tsx:72](apps/storefront/src/components/checkout/AddressAutocomplete.tsx:72) |

## 2. Part 1: fill checkout from what we know

### 2.1 Where the values come from, in order

1. **The cart's own saved address.** A refresh or coming back to checkout
   no longer empties the form.
2. **Signed-in customer:** their first saved address (the default one comes
   first). Name and phone fall back to the account profile, and the email
   comes from the account.
3. **Nothing known:** empty, as today.

Only empty fields are filled. Nothing the customer typed is ever overwritten.

**Splitting street and number.** Saved addresses and the cart keep "Οδός
Αριθμός" as one piece of text. When filling the form, the trailing number is
split off:

- "Ικάρου 25" → Ικάρου | 25
- "28ης Οκτωβρίου 12Α" → 28ης Οκτωβρίου | 12Α
- "Κνωσού 25-27" → Κνωσού | 25-27
- no trailing number → everything stays in Οδός

This is safe even when the guess is wrong, because saving joins the two
back together with a space. The order always gets exactly the same
address text. The same small helper also fixes A4, and the account's
"edit address" form, which today shows Αριθμός blank
([customer.ts:204](apps/storefront/src/lib/db/customer.ts:204)).

### 2.2 Saved straight away

Filled-in details are saved immediately, using the same save the form uses
today. Shipping options appear without any clicks. For a Heraklion address,
the single delivery option is picked automatically, as it already is.

A returning signed-in customer's checkout becomes: check the details →
choose shipping (if there's more than one option) → press the button.

### 2.3 Several saved addresses

Signed-in customers with 2 or more saved addresses get one dropdown,
"Αποθηκευμένη διεύθυνση", above Στοιχεία παραλήπτη. Its last option,
"Νέα διεύθυνση", clears the fields. It uses the same style as the existing
fields.

### 2.4 Keeping the address for next time

A signed-in customer whose address isn't in their address book yet sees a
checkbox under the address: **"Αποθήκευση διεύθυνσης στον λογαριασμό μου"**
(checked by default, D2).

- It's saved after the order is placed. A failure here never affects the
  order.
- The customer's first saved address becomes their default.
- Duplicates are skipped (same street text + ΤΚ).

### 2.5 Signing in from checkout

Signed-out visitors get one line at the top of the Email section: "Έχεις
λογαριασμό; **Σύνδεση**", plus the "Συνέχεια με Google" button from Part 2.
After signing in they come back to `/checkout`, and the cart is kept (the
existing cart merge already handles this).

### 2.6 Autofill fixes

- **A1:** a field that changes while the customer isn't in it (that's
  autofill, or our own filling) triggers a save a moment later. Typing works
  exactly as today. Safety net: if the order button is pressed while
  everything is valid but not saved yet, it saves first and then shows the
  real state, instead of doing nothing.
- **A2:** accept +30 / 0030, spaces, dashes, dots and brackets, and store
  the number as 10 digits. The server gets the same check; today it doesn't
  check the phone at all.
- **A3:** accept "712 01" and store "71201", in the browser and on the
  server.
- **A4:** after autofill, if Αριθμός is empty and Οδός ends in a number,
  the number moves over (the §2.1 helper). This happens only on autofill,
  never while typing.
- **A5:** suggestions only appear while the customer is typing in Οδός
  itself.

The only visual changes in Part 1 are §2.3–2.5.

## 3. Part 2: Continue with Google

### 3.1 How it works

The button is a plain link to our own server, which sends the customer to
Google's sign-in page and receives them back.

- **No Google script is loaded on our pages.** No speed cost, and no change
  to the site's script security policy.
- It uses Google's standard sign-in flow, with protection against forged
  and replayed requests.
- We ask Google only for name and email. We keep the Google account ID and
  the email. No Google tokens are stored.

### 3.2 Which account they land in

1. The Google account is already linked → that account.
2. An account with the same email exists (and Google confirms it has
   verified the email) → link it and sign in. An existing password keeps
   working (D1).
3. Otherwise → a new account with the name from Google and no password.

After that it works like today's login: a session is created, the guest cart
and wishlist are merged, and the customer returns to where they started
(`/checkout` or `/logariasmos`).

### 3.3 Security rules (not optional)

- **Registration must not take over a Google account.** Today, registering
  with an email whose account has no password quietly sets the new
  password on that account
  ([customer.ts:71](apps/storefront/src/lib/db/customer.ts:71)). That path
  was meant for guests. A Google-only account has no password, so without
  a fix anyone could register with that email and get into it.
  Registration will answer "email already registered" for Google-linked
  accounts and point to the Google button.
- **"Ξέχασες τον κωδικό" works for Google-only accounts.** Today it
  silently skips accounts without a password
  ([customer.ts:133](apps/storefront/src/lib/db/customer.ts:133)). The reset
  email proves the customer owns the address, so this is the safe way to
  add a password.
- **"Αλλαγή κωδικού"** for a Google-only account explains that it has no
  password yet and links to "Ξέχασες τον κωδικό". It can't ask for a
  current password that doesn't exist.
- Password login on a Google-only account gets the same generic "wrong
  email or password" message as today, so it never reveals whether an
  account exists. The Google button sits right below it.
- Same rate limiting as login, and deactivated accounts stay locked out.

### 3.4 Where the button appears

On `/logariasmos/eisodos`, on `/logariasmos/eggrafi`, and at the top of
checkout for signed-out visitors.

- It shows Google's official "G" logo and the text "Συνέχεια με Google",
  as a white button with a border like the site's secondary buttons.
  Google's branding rules allow this.
- It's hidden automatically when the Google keys aren't set, the same way
  address suggestions switch off without their key.

### 3.5 Database

Migration `0034`: a new table, `shop.customer_identity` (customer, provider
= google, Google account ID, unique). No existing table changes.

### 3.6 What you need to set up (free, about 10 minutes)

In Google Cloud Console, in the same project as the address suggestions key:

1. **OAuth consent screen:** External; app name MAVRAKIS HOME; support
   email; links to the homepage, `/aporrito` and `/oroi-xrisis`; then
   publish it to "In production". Name + email only need no Google app
   review. Google shows the app name and logo on its sign-in screen only
   after a free, optional brand check, which needs the domain verified in
   Google Search Console first.
2. **Create an OAuth client** of type "Web application", with these
   redirect addresses:
   `https://www.mavrakishome.gr/api/auth/google/callback` and
   `http://localhost:3000/api/auth/google/callback`. The other three
   addresses (`mavrakishome.gr`, `mavrakishome.com`, `www.mavrakishome.com`)
   all redirect to `www.mavrakishome.gr` (checked 28 Σεπ 2026), so they
   don't need their own.
3. **Put the two values in Vercel and `.env.local`:**
   `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`. I'll add both
   to `.env.example`.

It works on the live site and on localhost. Vercel preview links won't
support it, because Google needs exact addresses.

**Privacy page:** `/aporrito` should say that Google sign-in shares the
customer's name, email and Google account ID with the store. It's edited
in the dashboard, and I'll give you a draft sentence to approve.

### 3.7 Cost

**Free.** No paid service and no new npm package. Google doesn't charge for
sign-in.

## 4. Build order and testing

**Phase 1 (Part 1):**
1. Helpers + unit tests (street/number split, phone, postal code).
2. Filling and saving the checkout.
3. Address dropdown + "save address" checkbox.
4. Autofill fixes.
5. Sign-in line on checkout.

**Phase 2 (Part 2):**
1. Migration.
2. Google routes.
3. Account rules (§3.3).
4. Buttons.
5. Testing on localhost with your Google client.

Every phase gets the full tsc/eslint/test/build check, a live check in the
browser, and a commit question.

**Testing note:** localhost writes to the live database. Filling and saving
a cart is harmless. The "save address" step only runs after an order is
placed, so I'll test the saving function directly, unless you OK one test
order.

## 5. Decisions (owner, 28 Σεπ 2026)

**D1. An account with a password signs in with Google for the first time.**
Registration has never checked that people own their email, so someone
could have registered *your* email with *their* password before you ever
use Google.

- (a) Recommended: link and sign in, but remove the old password and sign
  out other devices. Would close that gap; a real customer who had a
  password would reset it to use it again.
- **(b) Chosen: link and keep the password.** Smoother for customers.
  Accepted risk: the pre-registration gap above stays open.
- (c) Don't link; ask them to sign in with their password first.

**D2. "Save address" checkbox: checked by default.** That's what makes the
next checkout one tap; the customer can untick it.

**D3. Sign-in line + Google button at the top of checkout: yes.** It's the
one visible addition to checkout's layout, shown to signed-out visitors
only.

## 6. Phase 1: built and tested (28 Σεπ 2026)

Everything in §2 as specified. Main files: `lib/address-format.ts` (split,
phone, ΤΚ), `lib/checkout-prefill.ts` (what the form starts with),
`components/checkout/autofill.ts` (autofill detection),
`SavedAddressPicker.tsx`, `CheckoutForm.tsx`, and
`saveOrderAddressToCustomer` in `lib/db/customer.ts`.

**Added while building, same goal:**
- The order button also needs the fields *on screen* to be valid, and no
  email/address save in flight. Before, emptying a field left the cart's
  old address in place and the order could still be placed with it.
- Only the newest address save may update the form. Found live: an older
  answer arriving first flashed a Heraklion option for an address already
  changed to Athens. The server already refused that combination, so no
  wrong order was possible; now the form doesn't show it either.
- Login ↔ register links keep `redirectTo`, so checkout → Σύνδεση →
  Δημιουργία λογαριασμού lands back in checkout.
- The account's address book stores the ΤΚ and phone cleaned the same way,
  and its edit form shows Οδός / Αριθμός split.

**Tested live on localhost** (fake data, no order placed):
- Simulated Chrome autofill from the Email field: everything saved, Heraklion
  delivery auto-picked, "Ικάρου 25" split, no suggestions popup;
  "+30 690 000 0000" / "712 01" stored as `6900000000` / `71201`.
- Refresh keeps the form and the chosen shipping.
- An emptied field blocks the button. A blocked click with every field valid
  scrolls to shipping.
- Test account (created, then deleted with its cart and addresses):
  checkout filled from the first saved address, saved email + address,
  and auto-picked delivery with no clicks. The dropdown switches addresses and
  saves; "Νέα διεύθυνση" clears the address, keeps name/phone and blocks the
  button. The save checkbox is ticked by default and only shows for an unsaved
  address.
- Saving the address after an order needs a real order, so it wasn't run.
  Its SQL was checked with `EXPLAIN` against the live schema.

Checks: tsc, eslint, vitest (156 tests, new ones for the split, phone, ΤΚ
and fill-in rules), `next build`.
