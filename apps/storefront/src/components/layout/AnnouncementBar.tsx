// Admin-editable via Site Settings (Admin-first platform, Phase C) —
// empty/unset text means no bar at all, not a placeholder default. The
// previous hardcoded free-shipping claim was removed for not being backed
// by a real Medusa shipping rule (see CHECKOUT_UX_SPEC.md §0.2); this
// component no longer invents its own copy, it only ever shows what an
// admin actually typed.
export function AnnouncementBar({ text }: { text: string | null }) {
  if (!text) return null;

  return (
    <div className="bg-ink px-4 py-2 text-center text-xs text-white/90">
      {text}
    </div>
  );
}
