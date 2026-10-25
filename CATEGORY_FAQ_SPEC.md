# FAQ on product categories (ΥΓΡΑΕΡΙΟ audit, M1 option B)

Status: **approved 25 Οκτ 2026** — the owner accepted questions 1, 2 and 4–7 (both [ΕΛΕΓΧΟΣ] sentences included) and replaced question 3 with their own. Built the same day; the new answer to question 3 is shown to the owner before pushing.

## 1. Today

- `shop.category.faq` (jsonb, up to 5 question/answer pairs) already exists for every category.
- The dashboard's category form shows the FAQ fields **only** when the page type is «Σελίδα υπηρεσίας» (`CategoryManager.tsx`, `pageType === "landing"`). The server already saves whatever FAQ is sent, for any page type (`parseFaq` in `taxonomy-actions.ts`).
- The storefront shows the FAQ, plus `FAQPage` structured data, **only** on service pages (`CategoryLandingView.tsx`, today only Αντικλείδια). Product categories (`CategoryPLPView.tsx`) ignore it.

## 2. Change

1. **Dashboard:** show the same 5 FAQ fields for both page types. No new fields, no migration.
2. **Storefront:** move the FAQ block out of `CategoryLandingView` into a small shared `CategoryFaq` component (same look: «Συχνές Ερωτήσεις», tap to open each answer). Service pages render it exactly as today; product categories render it after the product grid and «Δείτε επίσης», before the long description.
3. **Only on page 1 without filters.** `?page=2` and filtered URLs (`/filtra`) show no FAQ, so the same answers never appear on many URLs.
4. **Structured data:** product categories also get the `FAQPage` block, built from the same array the page shows, as service pages do today. Google no longer shows FAQ rich results for shops (since 2023), so this is for clarity and AI assistants, not for a visual change in Google results.
5. **Caching:** the FAQ comes from the category row the page already loads. No cookies or search params are added, so category pages stay CDN-cached (PAGE_CACHING_SPEC.md).

Not changed: URLs, canonicals, sitemap, page types, the Αντικλείδια page.

Effort: about 2 hours, plus local checks (desktop + phone, light + dark), type check, lint and the existing tests. One commit; push only with the owner's OK.

## 3. Writing rules for the answers

- Facts only from the product records (descriptions, sizes, compatibility) and the store's settings. No invented figures (gas consumption, burner power, hose lifetime in years).
- No keyword stuffing: each answer is checked with the dashboard's own rule (`validate-seo-content.ts`: no word of 4+ letters more than ~4 times per 100 words), and the question doesn't repeat the category name word for word.
- An answer doesn't repeat a sentence that is already in the same category's description.
- Heraklion is mentioned only on ΥΓΡΑΕΡΙΟ and on the categories with local intent (agreed policy, 3 Οκτ).
- Safety sentences are marked **[ΕΛΕΓΧΟΣ]** and need the owner's explicit OK.

## 4. Questions and answers for approval

Accept, edit or drop each one. The product codes in brackets are where the answer comes from; they are not shown on the site.

### ΥΓΡΑΕΡΙΟ

**Πού μπορώ να βρω καμινέτα και είδη υγραερίου στο Ηράκλειο;**
Στο κατάστημά μας, Σφακιανάκη 4, 71201 Ηράκλειο, τηλ. 2811 751814. Δευτέρα, Τετάρτη και Σάββατο 9:00–15:00· Τρίτη, Πέμπτη και Παρασκευή 9:00–14:30 και 17:30–21:00. Μπορείτε επίσης να παραγγείλετε online και να παραλάβετε από το κατάστημα.

### Καμινέτα Υγραερίου - Καρένες

**Ποιο καμινέτο είναι κατάλληλο για camping;**
Για κάμπινγκ ένα ελαφρύ καμινέτο για φιαλίδιο 190gr, πλαστικό ή μεταλλικό, χωράει εύκολα στο σακίδιο. Για μεγαλύτερη φλόγα υπάρχουν τα καμινέτα «γίγας» για φιαλίδιο 500gr, ενώ η καρένα προσαρμόζεται σε φιάλη 1,5, 2 ή 3kg. Τα φιαλίδια δεν αποστέλλονται με courier.
*(00017, 00013, 00014, 00019, 00045)*

### Κουζινάκια Πετρογκάζ Υψηλής Πίεσης

**Ποιες είναι οι διαφορές μεταξύ πετρογκάζ-κουζινάκια χαμηλής πίεσης και υψηλής πίεσης;**
Τα χαμηλής είναι τα οικιακά: φτιαγμένα για σταθερή, καθημερινή χρήση στην κουζίνα του σπιτιού, συνδέονται με ρυθμιστή 30mbar. Τα υψηλής, γνωστά και ως ελαφριού τύπου, δίνουν δυνατή, γρήγορη φλόγα, ιδανική για την αυλή και την εξοχή, και θέλουν ρυθμιστή 0–3bar ή 0,5–4bar με λάστιχο προπανίου. Ο ρυθμιστής του ενός τύπου δεν ταιριάζει στον άλλο.
*(Question written by the owner, 25 Οκτ, replacing «δύο ή τρία μάτια». Answer from the household and high-pressure stove descriptions, 00047 and 00048–00051.)*

### Ρυθμιστές Πίεσης - Σύνδεση Συσκευών

**Πώς καταλαβαίνω ποιον ρυθμιστή χρειάζεται η συσκευή μου;**
Κοιτάξτε την ετικέτα ή το εγχειρίδιο της συσκευής: γράφει αν δουλεύει με χαμηλή πίεση (mbar) ή υψηλή (bar). Αν δεν είστε σίγουροι, φέρτε στο κατάστημα μια φωτογραφία της ετικέτας και θα σας δείξουμε τον σωστό. **[ΕΛΕΓΧΟΣ]** Μη συνδέετε ποτέ συσκευή χαμηλής πίεσης σε ρυθμιστή υψηλής.
*(The 30mbar / 0–3bar / 0,5–4bar rule is already in this category's description, so it isn't repeated here.)*

### Λάστιχο Υγραερίου

**Τι λάστιχο χρειάζομαι για τη συσκευή υγραερίου μου;**
Χρησιμοποιήστε μόνο ειδικό λάστιχο υγραερίου, στο μήκος που χρειάζεστε, με σφιγκτήρα σε κάθε άκρη. Το δικό μας, ιταλικής κατασκευής, πωλείται ανά μέτρο· υπάρχουν και έτοιμα σετ ρυθμιστή με σωλήνα 1,5m. **[ΕΛΕΓΧΟΣ]** Αλλάξτε το αν έχει ραγίσματα ή σκληρύνει, ή αν έχει περάσει η ημερομηνία που αναγράφεται πάνω του.
*(00046, 00063, 00047, 00048, 00049)*

### Ανταλλακτικά Συσκευών

**Ποια ανταλλακτικά αλλάζουν συνήθως σε μια συσκευή υγραερίου;**
Συνήθως οι κεφαλές (μάτια), τα σχαράκια, ο διακόπτης της φιάλης και τα ρακόρ σύνδεσης. Θα βρείτε μάτια για καμινέτο 190gr και γίγας, για πετρογκάζ ταχείας πιέσεως, σχαράκια, διακόπτη στραγγαλιστή, αντάπτορα για φιάλη 3kg και τάφ για δύο συσκευές.
*(00055–00062, 00066–00069. The «bring the old part» line is already in the description, so it isn't repeated.)*

### Φιαλίδια Υγραερίου

**Ποιο φιαλίδιο ταιριάζει στο καμινέτο μου;**
Η σελίδα κάθε καμινέτου γράφει τι δέχεται. Για παράδειγμα, το πλαστικό, το ανοξείδωτο και το μεταλλικό καμινέτο με πόδια θέλουν φιαλίδιο 190gr, ενώ τα «γίγας» θέλουν 500gr. Η φιάλη MAP-Pro 400g είναι για το φλόγιστρο συγκόλλησης.
*(00017, 00020, 00018 = 190gr; 00014, 00015, 00019 = 500gr; 00077, 00076. Size not recorded for 00023, so it isn't named.)*

## 5. Phone-order hours (resolved 25 Οκτ 2026)

The «Συχνές Ερωτήσεις» page said phone orders are taken «Δευ-Παρ 9:00-18:00», but the shop's hours in the settings were different. The owner answered: the shop hours. The live faq, epikoinonia and paraggelia pages already show them; the seed script (db/seed-support-pages.mjs) and the trust strip's built-in default (TrustStrip.tsx) were brought in line the same day.
