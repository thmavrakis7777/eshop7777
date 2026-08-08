"use client";

import { SectionHeading } from "@/components/checkout/SectionHeading";
import { FormField } from "@/components/checkout/FormField";

// Email requested first, with a stated reason — CHECKOUT_UX_SPEC.md §4/§17:
// an unexplained field reads as data-harvesting, an explained one reads as
// "I understand why you're asking."
export function EmailSection({
  value,
  onChange,
  onBlur,
  error,
  saving,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error?: string;
  saving?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading number={1} title="Email" />
      <FormField
        id="checkout-email"
        label="Email"
        type="email"
        autoComplete="email"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
        disabled={saving}
      />
      <p className="text-xs text-ink-muted">
        Θα σου στείλουμε την επιβεβαίωση της παραγγελίας σε αυτό το email.
      </p>
    </section>
  );
}
