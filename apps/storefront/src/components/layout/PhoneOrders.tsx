import { PhoneIcon } from "@/components/ui/Icons";

export type PhoneOrders = { phone: string; label: string };

/**
 * Resolves the announcement bar's phone-orders line from site settings, or
 * null when it shouldn't render. Kept next to the component so the "is it on?"
 * rule lives in one place rather than being re-derived at each call site.
 *
 * Requires BOTH the toggle and a number: switching it on without entering a
 * phone number must not render an empty link.
 */
export function resolvePhoneOrders(settings: {
  phoneOrdersEnabled: boolean;
  contactPhone: string | null;
  phoneOrdersLabel: string | null;
} | null): PhoneOrders | null {
  const phone = settings?.contactPhone?.trim();
  if (!settings?.phoneOrdersEnabled || !phone) return null;
  return { phone, label: settings.phoneOrdersLabel?.trim() || "Τηλεφωνικές παραγγελίες" };
}

/**
 * `tel:` wants digits and an optional leading +, while the visible text keeps
 * whatever formatting the owner typed.
 */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/**
 * The phone-orders line, sized for the announcement bar it lives in.
 *
 * A real <a href="tel:">, never a script-initiated call: tapping hands off to
 * the device's own dialler, which asks before connecting. No JavaScript at
 * all — this is a Server Component rendering one anchor.
 *
 * Colours are inherited from the bar rather than set here, so the bar stays
 * the single owner of its own theme. On narrow screens the label is dropped
 * to keep the bar one line, but it remains in the accessible name, so the
 * link is never announced as a bare number.
 */
export function PhoneOrdersLink({ phoneOrders }: { phoneOrders: PhoneOrders }) {
  const { phone, label } = phoneOrders;
  return (
    <a
      href={telHref(phone)}
      aria-label={`${label}: ${phone}`}
      // -my-1 py-1 grows the tap target to 24px (WCAG 2.2 target-size
      // minimum) without making the bar any taller: the padding is real,
      // the negative margin absorbs it back out of the layout.
      className="-my-1 flex shrink-0 items-center gap-1.5 py-1 transition-opacity hover:opacity-80"
    >
      <PhoneIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline">{label}:</span>
      <span className="font-medium tabular-nums">{phone}</span>
    </a>
  );
}
