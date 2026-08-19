"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveContentPageAction } from "@/lib/admin/cms-actions";
import type { AdminContentPage } from "@/lib/admin/cms";

/**
 * The eleven static pages, edited from one screen.
 *
 * Publishing is explicit and defaults to off: an unpublished page 404s on the
 * storefront rather than going live empty. That is why the list leads with
 * publish state — "which of my pages are actually live" is the question this
 * screen exists to answer.
 */
export function ContentPageEditor({ pages }: { pages: AdminContentPage[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const published = pages.filter((p) => p.isPublished).length;

  return (
    <>
      {msg && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-4 py-2.5 text-sm ${
            msg.ok ? "border-success/30 bg-success/5 text-success" : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      <p className="mb-4 text-sm text-ink-muted">
        {published} από {pages.length} σελίδες είναι δημοσιευμένες. Οι υπόλοιπες επιστρέφουν 404 στο
        κατάστημα μέχρι να τις δημοσιεύσεις.
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        {pages.map((p) => (
          <div key={p.slug} className="border-b border-border last:border-b-0">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{p.label}</span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
                      p.isPublished ? "bg-success/10 text-success" : "bg-surface text-ink-muted"
                    }`}
                  >
                    {p.isPublished ? "Δημοσιευμένη" : "Πρόχειρη"}
                  </span>
                  {!p.body && <span className="text-xs text-accent">χωρίς κείμενο</span>}
                </div>
                <div className="text-xs text-ink-muted">/{p.slug}</div>
              </div>
              {p.isPublished && (
                <Link
                  href={`/${p.slug}`}
                  target="_blank"
                  className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  Προβολή →
                </Link>
              )}
              <button
                type="button"
                onClick={() => setOpen(open === p.slug ? null : p.slug)}
                className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface"
              >
                {open === p.slug ? "Κλείσιμο" : "Επεξεργασία"}
              </button>
            </div>

            {open === p.slug && (
              <div className="border-t border-border bg-surface/40 px-4 py-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    data.set("slug", p.slug);
                    startTransition(async () => {
                      const result = await saveContentPageAction(data);
                      setMsg(
                        result.ok
                          ? { ok: true, text: result.message ?? "Αποθηκεύτηκε." }
                          : { ok: false, text: result.error ?? "" }
                      );
                      if (result.ok) router.refresh();
                    });
                  }}
                  className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ink">Τίτλος σελίδας</label>
                    <input
                      name="title"
                      defaultValue={p.title}
                      required
                      className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ink">Κείμενο</label>
                    <textarea
                      name="body"
                      rows={16}
                      defaultValue={p.body ?? ""}
                      placeholder="Γράψε εδώ το περιεχόμενο της σελίδας. Οι κενές γραμμές δημιουργούν παραγράφους."
                      className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm leading-relaxed outline-none focus:border-ink"
                    />
                    <p className="text-xs text-ink-muted">
                      <code className="text-ink">## Τίτλος</code> / <code className="text-ink">### Υπότιτλος</code> για
                      επικεφαλίδες, <code className="text-ink">- </code> ή <code className="text-ink">1. </code> για
                      λίστα, <code className="text-ink">{"**έντονα**"}</code> για έντονα,{" "}
                      <code className="text-ink">{"[κείμενο](/apostoles)"}</code> για σύνδεσμο,{" "}
                      <code className="text-ink">{"> "}</code> για παράθεμα. Κενή γραμμή ξεκινά νέα παράγραφο.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ink">Τίτλος SEO (προαιρετικό)</label>
                    <input
                      name="seoTitle"
                      defaultValue={p.seoTitle ?? ""}
                      placeholder={p.title}
                      className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ink">Περιγραφή SEO (προαιρετικό)</label>
                    <textarea
                      name="metaDescription"
                      rows={2}
                      defaultValue={p.metaDescription ?? ""}
                      placeholder="Αν μείνει κενό, χρησιμοποιείται αυτόματα το ίδιο το κείμενο της σελίδας."
                      className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm leading-relaxed outline-none focus:border-ink"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="isPublished"
                      defaultChecked={p.isPublished}
                      className="h-4 w-4 accent-ink"
                    />
                    Δημοσιευμένη στο κατάστημα
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-ink/90 disabled:opacity-50"
                    >
                      {pending ? "Αποθήκευση…" : "Αποθήκευση"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpen(null)}
                      className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface"
                    >
                      Κλείσιμο
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
