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
 * LAYOUT — three regimes, because one cannot serve all well:
 *
 * Below sm (true phones): a single row using the same equal-outer-column
 * grid trick as desktop (see below), except the left column now holds just
 * the phone icon rather than the full number — see PhoneOrdersLink, which
 * drops its own text below sm. A narrow icon column keeps the row from
 * wrapping at any width down to 320px while the announcement stays
 * genuinely centred rather than centred in the leftover space next to the
 * icon.
 *
 * sm up to xl (tablet, and the stacked phone label/number fallback): stacked,
 * both lines centred. The phone label ("Τηλεφωνικές παραγγελίες:") is long
 * enough that the three-column grid below has it wrapping to a second line —
 * and colliding with the centred announcement — anywhere from ~640px up to
 * just past 1024px. That wrap point shifts with whatever an admin types into
 * either field, so rather than chase it with a breakpoint tuned to today's
 * copy, the stacked layout (each half gets its own full-width row, so
 * nothing competes for column space) simply runs all the way through tablet
 * widths, where it has plenty of room to look intentional rather than
 * squeezed. The phone label is shown here (unlike true mobile) since a
 * tablet-width bar has room for it.
 *
 * xl and up: a three-column grid, `minmax(0,1fr) auto minmax(0,1fr)`. The
 * two outer columns are forced to exactly equal widths, so the middle column
 * sits at the TRUE centre of the bar — not centred in the space left over
 * after the phone, which is what a plain `flex-1 text-center` gives you.
 * Safe from 1280px on: comfortably past where the phone content could wrap.
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
        className="container-shell grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-2
                   sm:flex sm:flex-col sm:items-center
                   xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-center xl:gap-3"
      >
        {phoneOrders && (
          <div className="col-start-1 justify-self-start xl:self-start">
            <PhoneOrdersLink phoneOrders={phoneOrders} />
          </div>
        )}
        {text && (
          <p className="text-balance text-center col-start-2 justify-self-center">{text}</p>
        )}
      </div>
    </div>
  );
}
