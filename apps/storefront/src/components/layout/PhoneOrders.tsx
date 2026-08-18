import { PhoneIcon } from "@/components/ui/Icons";

export type PhoneOrders = { phone: string; label: string };

/**
 * Resolves the header's phone-orders line from site settings, or null when it
 * shouldn't render. Kept next to the component so the "is it on?" rule lives
 * in one place rather than being re-derived at each call site.
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
 * `tel:` strips spaces and punctuation — a dialler wants digits and an
 * optional leading +, while the visible text keeps whatever formatting the
 * owner typed.
 */
function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

/**
 * The link is a real <a href="tel:">, never a script-initiated call: tapping
 * it hands off to the device's own dialler, which asks before connecting.
 *
 * `variant` controls only how much text is visible. The accessible name is
 * the full "label: number" in every variant, so an icon-only rendering is
 * never an unlabelled link.
 */
export function PhoneOrdersLink({
  phoneOrders,
  variant = "full",
  className = "",
}: {
  phoneOrders: PhoneOrders;
  variant?: "full" | "icon" | "block";
  className?: string;
}) {
  const { phone, label } = phoneOrders;
  const accessibleName = `${label}: ${phone}`;

  if (variant === "icon") {
    return (
      <a
        href={telHref(phone)}
        aria-label={accessibleName}
        className={`p-2 hover:text-accent transition-colors ${className}`}
      >
        <PhoneIcon />
      </a>
    );
  }

  if (variant === "block") {
    return (
      <a
        href={telHref(phone)}
        aria-label={accessibleName}
        className={`flex items-center gap-2 text-sm text-ink hover:text-accent transition-colors ${className}`}
      >
        <PhoneIcon className="h-5 w-5 shrink-0 text-accent" />
        <span className="flex flex-col leading-tight">
          <span className="text-xs text-ink-muted">{label}</span>
          <span className="font-medium tabular-nums">{phone}</span>
        </span>
      </a>
    );
  }

  return (
    <a
      href={telHref(phone)}
      aria-label={accessibleName}
      className={`flex items-center gap-1.5 text-sm text-ink hover:text-accent transition-colors ${className}`}
    >
      <PhoneIcon className="h-4 w-4 shrink-0 text-accent" />
      <span className="text-ink-muted">{label}:</span>
      <span className="font-medium tabular-nums">{phone}</span>
    </a>
  );
}
