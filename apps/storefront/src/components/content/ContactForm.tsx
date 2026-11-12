"use client";

import Link from "@/components/ui/Link";
import { useState, useTransition } from "react";
import { FormField } from "@/components/checkout/FormField";
import { sendContactMessageAction, type ContactField } from "@/lib/actions/contact";

/**
 * The /epikoinonia contact form — reuses checkout's FormField so it looks
 * and behaves like every other form on the site. The message is emailed to
 * the shop (lib/actions/contact.ts); nothing is stored.
 */
export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot: off-screen and out of the tab order, so people never fill it.
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const res = await sendContactMessageAction({ name, email, phone, orderNumber, message, website });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div role="status" className="mt-4 rounded-sm border border-border bg-surface p-5 text-sm text-ink">
        <p className="font-medium">Ευχαριστούμε, λάβαμε το μήνυμά σας.</p>
        <p className="mt-1 text-ink-muted">Θα σας απαντήσουμε στο {email} το συντομότερο δυνατό, εντός των εργάσιμων ημερών.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contact-name" label="Ονοματεπώνυμο *" value={name} onChange={setName} autoComplete="name" error={fieldErrors.name} />
        <FormField
          id="contact-email"
          label="Email *"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          error={fieldErrors.email}
        />
        <FormField
          id="contact-phone"
          label="Τηλέφωνο (προαιρετικό)"
          type="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          inputMode="tel"
          error={fieldErrors.phone}
        />
        <FormField
          id="contact-order"
          label="Αριθμός παραγγελίας (αν υπάρχει)"
          value={orderNumber}
          onChange={setOrderNumber}
          inputMode="numeric"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contact-message" className="text-xs font-medium text-ink-muted">
          Μήνυμα *
        </label>
        <textarea
          id="contact-message"
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={!!fieldErrors.message}
          aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
          className="rounded-sm border border-border px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
        />
        {fieldErrors.message && (
          <p id="contact-message-error" role="alert" className="text-xs text-danger">
            {fieldErrors.message}
          </p>
        )}
      </div>

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Ιστοσελίδα</label>
        <input
          id="contact-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isPending}
          className="h-11 shrink-0 rounded-sm bg-ink px-6 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
        >
          {isPending ? "Αποστολή…" : "Αποστολή μηνύματος"}
        </button>
        <p className="text-xs text-ink-muted">
          Χρησιμοποιούμε τα στοιχεία σας μόνο για να σας απαντήσουμε. Δείτε την{" "}
          <Link href="/aporrito" className="underline underline-offset-2 hover:text-ink">
            Πολιτική Απορρήτου
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
