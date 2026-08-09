// Store pickup location content — deliberately NOT sourced from Medusa.
// The store-pickup fulfillment provider (apps/backend/.../src/modules/store-pickup)
// only needs to say a shipping option IS pickup; the address/hours/instructions
// shown to the customer live here, same "small stable-code-keyed table" shape
// as DELIVERY_ESTIMATES in lib/data/checkout.ts.
export type PickupLocation = {
  name: string;
  addressLine: string;
  city: string;
  postalCode: string;
  // Structured per day rather than one collapsed string — the real
  // schedule has split shifts on some days (e.g. Tuesday), which a single
  // "Δευτέρα–Παρασκευή ..." range can't represent honestly.
  hours: { day: string; hours: string }[];
  instructions: string;
};

export const PICKUP_LOCATION: PickupLocation = {
  name: "STIA — Κατάστημα Ηρακλείου",
  addressLine: "Σφακιανάκη 4",
  city: "Ηράκλειο",
  postalCode: "71201",
  hours: [
    { day: "Δευτέρα", hours: "09:00–15:00" },
    { day: "Τρίτη", hours: "09:00–14:00 & 17:30–21:00" },
    { day: "Τετάρτη", hours: "09:00–15:00" },
    { day: "Πέμπτη", hours: "09:00–14:00 & 17:30–21:00" },
    { day: "Παρασκευή", hours: "09:00–14:00 & 17:30–21:00" },
    { day: "Σάββατο", hours: "09:00–15:00" },
    { day: "Κυριακή", hours: "Κλειστά" },
  ],
  instructions:
    "Η παραγγελία σου είναι έτοιμη για παραλαβή εντός 1-2 εργάσιμων ημερών. Θα ενημερωθείς με email μόλις είναι έτοιμη. Φέρε μαζί σου τον αριθμό παραγγελίας.",
};
