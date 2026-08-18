import { PhoneOrdersLink, type PhoneOrders } from "./PhoneOrders";

/**
 * The strip above the header. Both halves are admin-editable via Site
 * Settings, and the bar renders only if at least one has content — an unset
 * announcement with phone orders off means no bar at all, not an empty band.
 *
 * The announcement text no longer invents its own copy (a hardcoded
 * free-shipping claim was removed for not being backed by a real shipping
 * rule); it only ever shows what an admin actually typed.
 *
 * LAYOUT — two regimes, because one cannot serve both well:
 *
 * Narrow (< sm): stacked. Phone on its own line at the left, announcement
 * centred beneath it. Below roughly 400px the two simply do not fit on one
 * line, and stacking is what keeps the announcement readable instead of
 * squeezing it to two words per line or letting it collide with the number.
 *
 * sm and up: a three-column grid, `minmax(0,1fr) auto minmax(0,1fr)`. The
 * two outer columns are forced to exactly equal widths, so the middle column
 * sits at the TRUE centre of the bar — not centred in the space left over
 * after the phone, which is what a plain `flex-1 text-center` gives you.
 *
 * Deliberately a grid rather than an absolutely-positioned centre: an
 * absolute element is out of flow, so a bar with an announcement and no
 * phone number would collapse to zero height. This keeps both children in
 * flow, so the bar is always as tall as its content whichever half is set.
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
      <div
        className="container-shell flex flex-col items-center gap-1 py-2
                   sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3"
      >
        {phoneOrders && (
          <div className="self-start sm:col-start-1 sm:justify-self-start">
            <PhoneOrdersLink phoneOrders={phoneOrders} />
          </div>
        )}
        {text && (
          <p className="text-balance text-center sm:col-start-2 sm:justify-self-center">{text}</p>
        )}
      </div>
    </div>
  );
}
