// Placeholder pending a real business decision (see CART_UX_SPEC.md §0/§11 —
// flagged as an open question, not something this project has decided yet).
// No Medusa shipping-option currently has a conditional free-shipping rule
// (verified against the live Store API during Phase 4A — both seeded
// shipping options are flat-rate), so this constant is the real source of
// truth for the progress bar until either a business number is set or a
// real conditional shipping rule is added on the backend.
export const FREE_SHIPPING_THRESHOLD_EUR = Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD_EUR ?? 50);
