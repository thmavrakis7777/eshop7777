import type { Category, NavCategory, Product } from "./types";

// Information architecture: Home -> Category -> Subcategory -> Product (max 3 clicks).
export const categories: Category[] = [
  { id: "c-kitchen", name: "Κουζίνα", handle: "kouzina" },
  { id: "c-kitchen-cookware", name: "Μαγειρικά Σκεύη", handle: "mageirika-skevi", parentHandle: "kouzina" },
  { id: "c-kitchen-pans", name: "Τηγάνια", handle: "tigania", parentHandle: "kouzina" },
  { id: "c-kitchen-pots", name: "Κατσαρόλες", handle: "katsaroles", parentHandle: "kouzina" },
  { id: "c-kitchen-knives", name: "Μαχαίρια & Κοπή", handle: "maxairia-kopi", parentHandle: "kouzina" },
  { id: "c-kitchen-serve", name: "Είδη Σερβιρίσματος", handle: "eidi-servirismatos", parentHandle: "kouzina" },
  { id: "c-kitchen-storage", name: "Αποθήκευση Τροφίμων", handle: "apothikefsi-trofimon", parentHandle: "kouzina" },
  { id: "c-kitchen-acc", name: "Αξεσουάρ Κουζίνας", handle: "axesouar-kouzinas", parentHandle: "kouzina" },

  { id: "c-storage", name: "Αποθήκευση & Οργάνωση", handle: "apothikefsi-organosi" },
  { id: "c-storage-boxes", name: "Κουτιά Αποθήκευσης", handle: "koutia-apothikefsis", parentHandle: "apothikefsi-organosi" },
  { id: "c-storage-closet", name: "Οργάνωση Ντουλάπας", handle: "organosi-ntoulapas", parentHandle: "apothikefsi-organosi" },
  { id: "c-storage-shelf", name: "Ραφιέρες & Στοιβαζόμενα", handle: "rafieres-stoivazomena", parentHandle: "apothikefsi-organosi" },

  { id: "c-bathroom", name: "Μπάνιο", handle: "banio" },
  { id: "c-bathroom-acc", name: "Αξεσουάρ Μπάνιου", handle: "axesouar-baniou", parentHandle: "banio" },
  { id: "c-bathroom-towels", name: "Πετσέτες & Υφάσματα", handle: "petsetes-yfasmata", parentHandle: "banio" },
  { id: "c-bathroom-org", name: "Οργάνωση Μπάνιου", handle: "organosi-baniou", parentHandle: "banio" },

  { id: "c-cleaning", name: "Καθαρισμός", handle: "katharismos" },
  { id: "c-cleaning-supplies", name: "Είδη Καθαριότητας", handle: "eidi-kathariotitas", parentHandle: "katharismos" },
  { id: "c-cleaning-laundry", name: "Πλύσιμο & Σιδέρωμα", handle: "plysimo-siderosma", parentHandle: "katharismos" },
  { id: "c-cleaning-tools", name: "Σκούπες & Εργαλεία", handle: "skoupes-ergaleia", parentHandle: "katharismos" },

  { id: "c-garden", name: "Κήπος", handle: "kipos" },
  { id: "c-garden-plants", name: "Γλάστρες & Φυτά", handle: "glastres-fyta", parentHandle: "kipos" },
  { id: "c-garden-outdoor", name: "Εξωτερικός Χώρος", handle: "exoterikos-choros", parentHandle: "kipos" },
  { id: "c-garden-tools", name: "Εργαλεία Κήπου", handle: "ergaleia-kipou", parentHandle: "kipos" },

  { id: "c-home", name: "Είδη Σπιτιού", handle: "eidi-spitiou" },
  { id: "c-home-decor", name: "Διακόσμηση", handle: "diakosmisi", parentHandle: "eidi-spitiou" },
  { id: "c-home-lighting", name: "Φωτισμός", handle: "fotismos", parentHandle: "eidi-spitiou" },
  { id: "c-home-textiles", name: "Υφάσματα Σπιτιού", handle: "yfasmata-spitiou", parentHandle: "eidi-spitiou" },
];

export const navCategories: NavCategory[] = categories
  .filter((c) => !c.parentHandle)
  .map((top) => ({
    ...top,
    children: categories.filter((c) => c.parentHandle === top.handle),
    featured: featuredFor(top.handle),
  }));

function featuredFor(handle: string): NavCategory["featured"] {
  const map: Record<string, NavCategory["featured"]> = {
    kouzina: { title: "Το σετ μαγειρικής της σεζόν", ctaLabel: "Δες τη συλλογή", href: "/kouzina" },
    "apothikefsi-organosi": { title: "Οργανώστε κάθε γωνιά του σπιτιού", ctaLabel: "Ανακάλυψε", href: "/apothikefsi-organosi" },
    banio: { title: "Ένα μπάνιο σαν spa", ctaLabel: "Δες τη συλλογή", href: "/banio" },
    katharismos: { title: "Καθαριότητα χωρίς κόπο", ctaLabel: "Δες τα προϊόντα", href: "/katharismos" },
    kipos: { title: "Ο κήπος σου, αναζωογονημένος", ctaLabel: "Δες τη συλλογή", href: "/kipos" },
    "eidi-spitiou": { title: "Διακόσμηση με χαρακτήρα", ctaLabel: "Ανακάλυψε", href: "/eidi-spitiou" },
  };
  return map[handle];
}

const tones: Product["placeholderTone"][] = ["clay", "sage", "stone", "linen"];

function money(amount: number): Product["price"] {
  return { amount, currencyCode: "EUR" };
}

function makeProduct(
  id: string,
  title: string,
  categoryHandle: string,
  price: number,
  opts: Partial<Product> = {}
): Product {
  return {
    id,
    title,
    handle: id,
    categoryHandle,
    shortDescription: opts.shortDescription ?? "Ανθεκτική κατασκευή, σχεδιασμένο για καθημερινή χρήση.",
    price: money(price),
    compareAtPrice: opts.compareAtPrice,
    rating: opts.rating ?? 4.6,
    reviewCount: opts.reviewCount ?? 128,
    badges: opts.badges,
    variants: opts.variants ?? [{ id: `${id}-default`, title: "Μονή επιλογή", price: money(price), inventoryQuantity: 24 }],
    placeholderTone: tones[Math.abs(hash(id)) % tones.length],
  };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export const products: Product[] = [
  makeProduct("antikollitiko-tigani-28", "Αντικολλητικό Τηγάνι 28cm", "tigania", 34.9, {
    badges: ["bestseller"],
    reviewCount: 342,
  }),
  makeProduct("set-katsaroles-5tem", "Σετ Κατσαρόλες Ανοξείδωτες 5 τεμ.", "katsaroles", 129, {
    compareAtPrice: money(159),
    badges: ["sale"],
  }),
  makeProduct("maxairi-sef-20cm", "Μαχαίρι Σεφ 20cm", "maxairia-kopi", 24.5),
  makeProduct("organoseis-ntoulapas-set", "Σετ Οργάνωσης Ντουλάπας 8 τεμ.", "organosi-ntoulapas", 39.9, {
    badges: ["new"],
  }),
  makeProduct("koutia-apothikefsis-set-3", "Κουτιά Αποθήκευσης με Καπάκι, Σετ 3", "koutia-apothikefsis", 22.9),
  makeProduct("axesouar-baniou-set", "Σετ Αξεσουάρ Μπάνιου Κεραμικό", "axesouar-baniou", 44.9, {
    badges: ["bestseller"],
  }),
  makeProduct("petsetes-100-vamvaki-set", "Πετσέτες 100% Βαμβάκι, Σετ 6", "petsetes-yfasmata", 29.9),
  makeProduct("skoupa-mikroinon", "Σκούπα Μικροϊνών με Κοντάρι", "skoupes-ergaleia", 18.5),
  makeProduct("glastra-keramiki-m", "Γλάστρα Κεραμική Μεσαία", "glastres-fyta", 16.9, { badges: ["new"] }),
  makeProduct("fotistiko-orofis-linen", "Φωτιστικό Οροφής Λινό", "fotismos", 59, {
    compareAtPrice: money(74),
    badges: ["sale"],
  }),
  makeProduct("diakosmitiko-jarrhoi-set", "Διακοσμητικά Βάζα Σετ 3", "diakosmisi", 27.5),
  makeProduct("ergaleia-kipou-set-5", "Εργαλεία Κήπου Σετ 5 τεμ.", "ergaleia-kipou", 32, { badges: ["bestseller"] }),
  makeProduct("tigani-wok-30", "Τηγάνι Wok 30cm", "tigania", 42.9),
  makeProduct("katsarola-gastronomias-24", "Κατσαρόλα Gastronomia 24cm", "katsaroles", 54.5, { badges: ["new"] }),
  makeProduct("set-mageirikis-6tem", "Σετ Εργαλείων Μαγειρικής Σιλικόνης 6 τεμ.", "mageirika-skevi", 27.9),
  makeProduct("pina-servirismatos-3orofon", "Πιατέλα Σερβιρίσματος 3 Ορόφων", "eidi-servirismatos", 36.9),
];

export function getProductsByCategory(handle: string): Product[] {
  return products.filter((p) => p.categoryHandle === handle);
}

export function getBestSellers(): Product[] {
  return products.filter((p) => p.badges?.includes("bestseller"));
}

export function getNewArrivals(): Product[] {
  return products.filter((p) => p.badges?.includes("new"));
}

export function getCategoryByHandle(handle: string): Category | undefined {
  return categories.find((c) => c.handle === handle);
}

export function getProductByHandle(handle: string): Product | undefined {
  return products.find((p) => p.handle === handle);
}
