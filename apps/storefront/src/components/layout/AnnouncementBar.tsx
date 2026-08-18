import { PhoneOrdersLink, type PhoneOrders } from "./PhoneOrders";

/**
 * The strip above the header. Both halves are admin-editable via Site
 * Settings, and the bar renders only if at least one of them has content —
 * an unset announcement with phone orders off means no bar at all, not an
 * empty band.
 *
 * The announcement text no longer invents its own copy (a hardcoded
 * free-shipping claim was removed for not being backed by a real shipping
 * rule); it only ever shows what an admin actually typed.
 *
 * Layout: phone orders pinned far left, announcement centred in the space
 * that's left. Plain flexbox, no JavaScript.
 */
export function AnnouncementBar({
  text,
  phoneOrders,
}: {
  text: string | null;
  phoneOrders: PhoneOrders | null;
}) {
  if (!text && !phoneOrders) return null;

  return (
    <div className="bg-ink text-xs text-white/90">
      <div className="container-shell flex items-center gap-3 py-2">
        {phoneOrders && <PhoneOrdersLink phoneOrders={phoneOrders} />}
        {text && <p className="min-w-0 flex-1 text-center">{text}</p>}
      </div>
    </div>
  );
}
