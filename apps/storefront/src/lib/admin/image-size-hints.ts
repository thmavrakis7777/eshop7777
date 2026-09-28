/**
 * The recommended size for every image the dashboard accepts, in one place.
 *
 * Each number comes from measuring where that image actually appears on the
 * storefront (2026-09-28, at 390×844, 768×1024 and 1440×900), not from a
 * rule of thumb: the box it fills, its shape, and whether it is resized
 * automatically. Images that are *not* resized automatically — most
 * homepage images, category thumbnails on category pages, page and journal
 * images — reach every visitor exactly as uploaded, so for those the size
 * here is the difference between a 40 KB and a 360 KB download (measured on
 * the live promo tiles, see HOMEPAGE_IMAGES_SPEC.md). Widths aim at about 2×
 * the largest box on common screens, which stays sharp on phones and
 * laptops without shipping 4K files.
 *
 * Uploads accept JPEG, PNG, WebP and GIF (no SVG) up to 5 MB —
 * lib/storage/upload.ts. When a layout changes, re-measure and update this
 * file; every upload field reads from it.
 */

const NOT_RESIZED = "Δεν αλλάζει μέγεθος αυτόματα — ό,τι ανεβάσεις κατεβάζει κάθε επισκέπτης.";
const RESIZED = "Αλλάζει μέγεθος αυτόματα ανά συσκευή.";

export const IMAGE_SIZE_HINTS = {
  homepage: {
    hero: {
      // Measured: the opening Hero fills the screen (1425×868 at 1440×900,
      // ~16:9 on 1920×1080). A later Hero is a fixed 32rem strip
      // (1425×512 at 1440, ~2.8:1).
      desktop: `Προτεινόμενο: 1920×1080 px (16:9), WebP ή JPEG, έως ~250 KB — για το πρώτο Hero της αρχικής, που γεμίζει όλη την οθόνη σε υπολογιστή. Για Hero πιο κάτω στη σελίδα (λωρίδα σταθερού ύψους): 1920×720 px (8:3). ${NOT_RESIZED}`,
      // Measured: the opening Hero shows the mobile image up to 1023 px —
      // 390×796 on a phone (~1:2) and 753×968 on a tablet (~4:5). 2:3 is
      // the shape that crops least across both. A later Hero uses it only
      // below 768 px, in a near-square box (390×416).
      mobile: `Προαιρετικό. Προτεινόμενο: 1200×1800 px (2:3, κάθετη), WebP ή JPEG, έως ~200 KB — για το πρώτο Hero της αρχικής· εμφανίζεται σε κινητά και tablet (έως 1023 px πλάτος οθόνης) και κόβεται λίγο στα πλάγια ή πάνω-κάτω, οπότε κράτα το θέμα στο κέντρο (το κείμενο πέφτει στο κάτω μέρος). Για Hero πιο κάτω στη σελίδα: 1000×1000 px (τετράγωνη), μόνο για κινητά. Χωρίς αυτό εμφανίζεται η desktop εικόνα. ${NOT_RESIZED}`,
    },
    // Banner 1. Measured: with Banner 2 filled in, both are 4:3 cards
    // (701×525 at 1440, 390×293 on a phone). Alone, it's a square on
    // phones and takes the text panel's height on larger screens.
    promo: {
      desktop: `Προτεινόμενο: 1200×900 px (4:3), WebP ή JPEG, έως ~120 KB — όταν υπάρχει και Banner 2 (κάρτες δίπλα-δίπλα, πάντα 4:3). Αν το banner είναι μόνο του: 1200×1200 px (τετράγωνη) — σε κινητό κόβεται τετράγωνη, σε υπολογιστή παίρνει το ύψος του κειμένου δίπλα της. ${NOT_RESIZED}`,
      tablet: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε tablet. Ίδιο σχήμα με την desktop εικόνα (1200×900 ή 1200×1200 px). Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
      mobile: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε κινητό. Ίδιο σχήμα με την desktop εικόνα (1200×900 ή 1200×1200 px). Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
    },
    banner2: {
      desktop: `Προτεινόμενο: 1200×900 px (4:3), WebP ή JPEG, έως ~120 KB — πάντα σε κάρτα 4:3, σε όλες τις συσκευές. ${NOT_RESIZED}`,
      tablet: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε tablet. Ίδιο σχήμα 4:3 (1200×900 px). Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
      mobile: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε κινητό. Ίδιο σχήμα 4:3 (1200×900 px). Χωρίς αυτό εμφανίζεται η desktop εικόνα.",
    },
    // ContentSection: a 4:3 box, half width from 768 px, full width below.
    // Through next/image only while no separate mobile image is set.
    content: {
      desktop: `Προτεινόμενο: 1200×900 px (4:3), WebP ή JPEG, έως ~150 KB — μισό πλάτος σε υπολογιστή, όλο το πλάτος σε κινητό. ${RESIZED} Εξαίρεση: αν ανεβάσεις και ξεχωριστή εικόνα για κινητό, καμία από τις δύο δεν αλλάζει μέγεθος.`,
      mobile: "Προαιρετικό — μόνο αν θέλεις διαφορετική περικοπή σε κινητό. Ίδιο σχήμα 4:3 (1200×900 px), έως ~150 KB.",
    },
    // Newsletter: full-width background through next/image, under a 70%
    // dark overlay. Its component reads only the desktop image.
    newsletter: {
      desktop: `Προτεινόμενο: 1920×640 px (3:1), WebP ή JPEG, έως ~200 KB — φόντο σε όλο το πλάτος, κάτω από σκούρο φίλτρο, οπότε οι λεπτομέρειες δεν φαίνονται πολύ. ${RESIZED}`,
      mobile: "Δεν χρησιμοποιείται σε αυτή την ενότητα — η ίδια εικόνα φόντου εμφανίζεται σε όλες τις συσκευές.",
    },
  },
  category: {
    // Three places: the homepage grid (square, next/image), subcategory
    // tiles on category pages (4:3, plain <img>, 326×245 at 1440), and for
    // Landing categories a full-width banner at its own shape (up to ~700 px).
    image: "Προτεινόμενο: 1000×1000 px (τετράγωνη), WebP ή JPEG, έως ~120 KB, με το θέμα στο κέντρο — εμφανίζεται τετράγωνη στις κάρτες κατηγοριών της αρχικής (αλλάζει μέγεθος αυτόματα) και κομμένη σε 4:3 στις κάρτες υποκατηγοριών των σελίδων κατηγορίας (εκεί δεν αλλάζει μέγεθος). Αν ο «Τύπος σελίδας» είναι Landing, εμφανίζεται και ως banner στην κορυφή της σελίδας στο δικό της σχήμα — τότε προτίμησε 1400×1050 px (4:3).",
    // Mega-menu promo tile: next/image fill, 442×548 at 1440 (~4:5); its
    // height follows the panel's content.
    megaMenu: `Προτεινόμενο: 800×1000 px (4:5, κάθετη), WebP ή JPEG, έως ~200 KB — το πλακίδιο προβολής στο μενού κατηγοριών σε υπολογιστή. Το ύψος του αλλάζει με το πλήθος των υποκατηγοριών, οπότε κράτα το θέμα στο κέντρο. ${RESIZED}`,
  },
  // ContentPageView: 16:9, container-shell max-w-3xl (~704 px wide).
  contentPage: `Προτεινόμενο: 1600×900 px (16:9), WebP ή JPEG, έως ~150 KB — στην κορυφή της σελίδας, στο πλάτος του κειμένου. ${NOT_RESIZED}`,
  journal: {
    // Article page: 3:2 banner up to ~1376 px wide (1361×907 at 1440).
    // Journal list: cropped to 4:3 cards (661×495 and 438×328 at 1440).
    hero: `Προτεινόμενο: 1800×1200 px (3:2), WebP ή JPEG, έως ~200 KB — στην κορυφή του άρθρου σε σχεδόν όλο το πλάτος της οθόνης, και κομμένη σε 4:3 στις κάρτες του Journal, οπότε κράτα το θέμα στο κέντρο. ${NOT_RESIZED}`,
    social: "Προτεινόμενο: 1200×630 px, JPEG ή PNG, έως ~300 KB — η προεπισκόπηση όταν μοιράζεται το άρθρο (Facebook, WhatsApp, Viber κ.λπ.). Αν μείνει κενή, χρησιμοποιείται η κύρια εικόνα.",
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
  // them square at up to ~665 px wide, so 1600 stays sharp at 2×.
  product: `Προτεινόμενο: 1600×1600 px (τετράγωνη), JPEG ή WebP, έως ~500 KB. ${RESIZED}`,
} as const;
