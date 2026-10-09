/**
 * Where every image the dashboard accepts appears, and the shape that suits
 * it, in one place.
 *
 * Each number comes from measuring where that image actually appears on the
 * storefront (2026-09-28, at 390×844, 768×1024 and 1440×900), not from a
 * rule of thumb: the box it fills and its shape.
 *
 * Size, format and file weight are no longer the uploader's job: every
 * upload field runs its file through the image pipeline (lib/images/slots.ts
 * — fitted to the slot's size, WebP + AVIF or JPEG, within a budget), and
 * the field shows that sentence itself (slotProcessingNote). What only the
 * owner can choose is the *framing* — the site crops with CSS, so a photo
 * of the wrong shape loses its edges. That is what these hints are for.
 * Before the pipeline, uploads reached visitors exactly as picked: a 360 KB
 * promo JPEG (HOMEPAGE_IMAGES_SPEC.md, IMAGE_UPLOAD_SPEC.md).
 *
 * Uploads accept JPEG, PNG, WebP and GIF (no SVG); a phone photo is shrunk
 * in the browser first to fit the upload limit (lib/admin/prepare-photo.ts).
 * The branding fields and the homepage's social image are path/URL fields
 * without an upload button, so their hints still give the full spec. When a
 * layout changes, re-measure and update this file and lib/images/slots.ts.
 */

const RESIZED = "Αλλάζει μέγεθος αυτόματα ανά συσκευή.";

export const IMAGE_SIZE_HINTS = {
  homepage: {
    hero: {
      // Measured: the opening Hero fills the screen (1425×868 at 1440×900,
      // ~16:9 on 1920×1080). A later Hero is a fixed 32rem strip
      // (1425×512 at 1440, ~2.8:1).
      desktop: "Σχήμα 16:9, ιδανικά τουλάχιστον 1920×1080 px για να φαίνεται καθαρή — για το πρώτο Hero της αρχικής, που γεμίζει όλη την οθόνη σε υπολογιστή. Για Hero πιο κάτω στη σελίδα (λωρίδα σταθερού ύψους): 8:3, π.χ. 1920×720 px.",
      // Measured: the opening Hero shows the mobile image up to 1023 px —
      // 390×796 on a phone (~1:2) and 753×968 on a tablet (~4:5). 2:3 is
      // the shape that crops least across both. A later Hero uses it only
      // below 768 px, in a near-square box (390×416).
      mobile: "Προαιρετικό. Σχήμα 2:3 (κάθετη), π.χ. 1200×1800 px — για το πρώτο Hero της αρχικής· εμφανίζεται σε κινητά και tablet (έως 1023 px πλάτος οθόνης) και κόβεται λίγο στα πλάγια ή πάνω-κάτω, οπότε κράτα το θέμα στο κέντρο (το κείμενο πέφτει στο κάτω μέρος). Για Hero πιο κάτω στη σελίδα: τετράγωνη, μόνο για κινητά. Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
    },
    // Banner 1. Measured: with Banner 2 filled in, both are 4:3 cards
    // (701×525 at 1440, 390×293 on a phone). Alone, it's a square on
    // phones and takes the text panel's height on larger screens.
    promo: {
      desktop: "Σχήμα 4:3 (π.χ. 1200×900 px) όταν υπάρχει και Banner 2 (κάρτες δίπλα-δίπλα, πάντα 4:3). Αν το banner είναι μόνο του: τετράγωνη (π.χ. 1200×1200 px) — σε κινητό κόβεται τετράγωνη, σε υπολογιστή παίρνει το ύψος του κειμένου δίπλα της.",
      tablet: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε tablet. Ίδιο σχήμα με την desktop εικόνα (4:3 ή τετράγωνη). Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
      mobile: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε κινητό. Ίδιο σχήμα με την desktop εικόνα (4:3 ή τετράγωνη). Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
    },
    banner2: {
      desktop: "Σχήμα 4:3 (π.χ. 1200×900 px) — πάντα σε κάρτα 4:3, σε όλες τις συσκευές.",
      tablet: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε tablet. Ίδιο σχήμα 4:3. Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
      mobile: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε κινητό. Ίδιο σχήμα 4:3. Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
    },
    // ContentSection: a 4:3 box, half width from 768 px, full width below.
    content: {
      desktop: "Σχήμα 4:3 (π.χ. 1200×900 px) — μισό πλάτος σε υπολογιστή, όλο το πλάτος σε κινητό.",
      mobile: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε κινητό. Ίδιο σχήμα 4:3.",
    },
    // Editorial Showcase «Spread»: 4:5 beside the text on desktop (676×845
    // at 1440), a 3:2 crop across the page on tablets, 4:5 edge to edge on
    // phones. Optional — EditorialShowcase falls back to the category's or
    // collection's own image, then to the first product's photo.
    showcase: {
      desktop: "Προαιρετικό. Κάθετη 4:5 (π.χ. 1200×1500 px), με το θέμα στο κέντρο — σε υπολογιστή δίπλα στο κείμενο, σε tablet κόβεται πιο φαρδιά (3:2), σε κινητό σε όλο το πλάτος. Χωρίς εικόνα εμφανίζεται η εικόνα της κατηγορίας/συλλογής ή η φωτογραφία του πρώτου προϊόντος.",
      mobile: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε κινητό. Κάθετη 4:5. Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
    },
    // Newsletter: full-width background under a 70% dark overlay. Its
    // component reads only the desktop image.
    newsletter: {
      desktop: "Σχήμα 3:1 (π.χ. 1920×640 px) — φόντο σε όλο το πλάτος, κάτω από σκούρο φίλτρο, οπότε οι λεπτομέρειες δεν φαίνονται πολύ.",
      mobile: "Δεν χρησιμοποιείται σε αυτή την ενότητα — η ίδια εικόνα φόντου εμφανίζεται σε όλες τις συσκευές.",
    },
  },
  category: {
    // Three places: the homepage grid (square — 312×312 at 1440, 262×262 on
    // a 390 phone since 2026-10-09 — with the name in white over a dark fade
    // on its lower part), subcategory tiles on category pages (4:3, 326×245
    // at 1440), and for Landing categories a full-width banner at its own
    // shape (up to ~700 px).
    image: "Τετράγωνη (π.χ. 1000×1000 px), με το θέμα στο κέντρο ή λίγο πιο πάνω — εμφανίζεται τετράγωνη στις κάρτες κατηγοριών της αρχικής, με το όνομα της κατηγορίας γραμμένο πάνω στο κάτω μέρος της φωτογραφίας (σε σκούρο φόντο), οπότε μην έχεις σημαντικές λεπτομέρειες εκεί. Κομμένη σε 4:3 στις κάρτες υποκατηγοριών των σελίδων κατηγορίας. Αν ο «Τύπος σελίδας» είναι Landing, εμφανίζεται και ως banner στην κορυφή της σελίδας στο δικό της σχήμα — τότε προτίμησε 4:3 (π.χ. 1400×1050 px).",
    // Mega-menu promo tile: 442×548 at 1440 (~4:5); its height follows the
    // panel's content.
    megaMenu: "Κάθετη 4:5 (π.χ. 800×1000 px) — το πλακίδιο προβολής στο μενού κατηγοριών σε υπολογιστή. Το ύψος του αλλάζει με το πλήθος των υποκατηγοριών, οπότε κράτα το θέμα στο κέντρο.",
  },
  // ContentPageView: 16:9, container-shell max-w-3xl (~704 px wide).
  contentPage: "Σχήμα 16:9 (π.χ. 1600×900 px) — στην κορυφή της σελίδας, στο πλάτος του κειμένου.",
  journal: {
    // Article page: 3:2 banner up to ~1376 px wide (1361×907 at 1440).
    // Journal list: cropped to 4:3 cards (661×495 and 438×328 at 1440).
    hero: "Σχήμα 3:2 (π.χ. 1800×1200 px) — στην κορυφή του άρθρου σε σχεδόν όλο το πλάτος της οθόνης, και κομμένη σε 4:3 στις κάρτες του Journal, οπότε κράτα το θέμα στο κέντρο.",
    social: "Σχήμα 1200×630 px — η προεπισκόπηση όταν μοιράζεται το άρθρο (Facebook, WhatsApp, Viber κ.λπ.). Αν το σχήμα διαφέρει, οι εφαρμογές κόβουν λίγο τις άκρες. Αν μείνει κενή, χρησιμοποιείται η κύρια εικόνα.",
  },
  branding: {
    // StoreLogo renders h-8 (32 px high), width auto, through next/image.
    logo: "Προτεινόμενο: PNG με διάφανο φόντο, 96 px ύψος (εμφανίζεται 32 px ψηλό), πλάτος ανάλογο έως ~480 px, έως ~50 KB. Διαδρομή αρχείου ή πλήρες URL. Κενό = εμφανίζεται το όνομα του καταστήματος ως κείμενο.",
    favicon: "Προτεινόμενο: 512×512 px (τετράγωνο), PNG, έως ~50 KB — το εικονίδιο στην καρτέλα του browser. Διαδρομή αρχείου ή πλήρες URL.",
    ogImage: "Προτεινόμενο: 1200×630 px, JPEG ή PNG, έως ~300 KB — εμφανίζεται όταν μοιράζεται κάποιος σύνδεσμο του καταστήματος σε social/messaging.",
  },
  // Homepage SEO override (content/seo) — same Open Graph target as above.
  // (storefront)/page.tsx sets its own openGraph, which replaces the
  // layout's rather than merging with it, so the store-wide image above is
  // NOT a fallback for the homepage — the hint says so rather than implying one.
  seoSocial: "Προτεινόμενο: 1200×630 px, JPEG ή PNG, έως ~300 KB — εμφανίζεται όταν μοιράζεται κάποιος τον σύνδεσμο της αρχικής σε social/messaging. Αν μείνει κενό, η αρχική κοινοποιείται χωρίς εικόνα (η γενική «Εικόνα κοινοποίησης» δεν χρησιμοποιείται εδώ).",
  // Product photos go through next/image everywhere; the product page shows
  // them square at up to ~665 px wide, so 1600 stays sharp at 2×. The same
  // 1600 is what prepare-photo.ts shrinks a larger photo to before upload.
  product: `Τετράγωνη, ιδανικά τουλάχιστον 1600×1600 px. Ανέβασε όποια φωτογραφία έχεις, ακόμα και από κινητό: μικραίνει αυτόματα και αποθηκεύεται ως WebP για το κατάστημα και ως JPEG για τον κατάλογο Facebook/Instagram. ${RESIZED}`,
} as const;
