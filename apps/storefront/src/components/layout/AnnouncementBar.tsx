// The free-shipping-over-€39 claim was hardcoded here independently of
// FreeShippingProgress's own (different, €50 default) threshold, and
// neither is backed by a real Medusa shipping rule — see
// CHECKOUT_UX_SPEC.md §0.2 for the full finding. Removed rather than fixed
// to a "correct" number, since there isn't a real number yet; restore once
// a real free-shipping rule exists on the backend.
export function AnnouncementBar() {
  return (
    <div className="bg-ink px-4 py-2 text-center text-xs text-white/90">
      Παραδόσεις σε όλη την Ελλάδα
    </div>
  );
}
