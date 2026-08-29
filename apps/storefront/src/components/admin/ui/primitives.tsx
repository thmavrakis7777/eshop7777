import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The admin's shared vocabulary. Every screen in Phases 8–11 is assembled
 * from these, so consistency is structural rather than something each page
 * has to remember.
 *
 * Design rules encoded here:
 *   - Near-monochrome. Colour carries meaning (status) and nothing else.
 *   - Tabular numerals on every figure, so columns of money align.
 *   - Motion is 120ms opacity/colour only. No page transitions, no bounce.
 *   - Every list has a real empty state; every figure has a label.
 *
 * Server Components by default — none of these need client JS. Interactive
 * pieces (drawers, confirm dialogs) live in their own "use client" files.
 */

// ---------------------------------------------------------------------------
// Page scaffolding
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  breadcrumb,
  action,
}: {
  title: string;
  description?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            {breadcrumb.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                {c.href ? (
                  <Link href={c.href} className="transition-colors hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate font-display text-2xl text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-bg p-5 ${className}`}>{children}</div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-semibold tracking-wide text-ink uppercase">{children}</h2>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * A single headline figure. `hint` carries the comparison or unit — never
 * a fabricated trend percentage: with no historical series to compare
 * against, an arrow pointing up would be decoration pretending to be data.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const valueTone =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-accent" : "text-ink";
  return (
    <div className="rounded-lg border border-border bg-bg px-5 py-4">
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className={`mt-1.5 font-display text-2xl tabular-nums ${valueTone}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-surface text-ink-muted",
  info: "bg-surface-strong text-ink",
  success: "bg-success/10 text-success",
  warning: "bg-accent/10 text-accent",
  danger: "bg-danger/10 text-danger",
};

// Greek labels + tone for every status value the schema allows. Centralised
// so an order's status reads identically on the list, the detail page and
// the dashboard.
const ORDER_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Σε αναμονή", tone: "warning" },
  confirmed: { label: "Επιβεβαιωμένη", tone: "info" },
  processing: { label: "Σε επεξεργασία", tone: "info" },
  shipped: { label: "Απεστάλη", tone: "info" },
  delivered: { label: "Παραδόθηκε", tone: "success" },
  cancelled: { label: "Ακυρώθηκε", tone: "danger" },
};

const PAYMENT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  unpaid: { label: "Απλήρωτη", tone: "warning" },
  paid: { label: "Πληρωμένη", tone: "success" },
  refunded: { label: "Επιστροφή", tone: "neutral" },
  partially_refunded: { label: "Μερική επιστροφή", tone: "neutral" },
};

const FULFILLMENT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  unfulfilled: { label: "Ανεκτέλεστη", tone: "warning" },
  fulfilled: { label: "Εκτελεσμένη", tone: "success" },
  partially_fulfilled: { label: "Μερικώς εκτελεσμένη", tone: "info" },
  returned: { label: "Επεστράφη", tone: "neutral" },
};

export const STATUS_MAPS = {
  order: ORDER_STATUS,
  payment: PAYMENT_STATUS,
  fulfillment: FULFILLMENT_STATUS,
} as const;

export function StatusBadge({
  value,
  kind = "order",
}: {
  value: string;
  kind?: keyof typeof STATUS_MAPS;
}) {
  const entry = STATUS_MAPS[kind][value] ?? { label: value, tone: "neutral" as StatusTone };
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[entry.tone]}`}
    >
      {entry.label}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  // overflow-x-auto on the wrapper, never on the page: a wide table scrolls
  // inside itself rather than making the whole layout scroll sideways.
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[40rem] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`border-b border-border bg-surface px-4 py-2.5 text-xs font-semibold text-ink-muted text-${align} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td className={`border-b border-border px-4 py-3 text-${align} ${className}`}>{children}</td>
  );
}

/** Every row is a link — the whole row is the target, not just the first cell. */
export function LinkedRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <tr className="group transition-colors last:[&>td]:border-b-0 hover:bg-surface">
      {children}
      <td className="w-10 border-b border-border px-2 text-right">
        <Link
          href={href}
          className="inline-flex h-full w-full items-center justify-end text-ink-muted transition-colors group-hover:text-ink"
          aria-label="Άνοιγμα"
        >
          →
        </Link>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

/**
 * Never just "No data". An empty state says what would appear here and, where
 * there is one, offers the action that fills it.
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors duration-120 disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  primary: `${BUTTON_BASE} bg-ink text-bg hover:bg-ink/90`,
  secondary: `${BUTTON_BASE} border border-border bg-bg text-ink hover:bg-surface`,
  danger: `${BUTTON_BASE} bg-danger text-bg hover:bg-danger/90`,
  ghost: `${BUTTON_BASE} text-ink-muted hover:bg-surface hover:text-ink`,
} as const;

export function ButtonLink({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: ReactNode;
  variant?: keyof typeof buttonStyles;
}) {
  return (
    <Link href={href} className={buttonStyles[variant]}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Formatting — one implementation, so money and dates read the same everywhere
// ---------------------------------------------------------------------------

const currency = new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR" });
const dateTime = new Intl.DateTimeFormat("el-GR", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("el-GR", { dateStyle: "medium" });

export const money = (cents: number) => currency.format(cents / 100);
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));
