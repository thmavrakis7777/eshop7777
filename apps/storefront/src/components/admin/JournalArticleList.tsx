"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, buttonStyles, formatDate } from "@/components/admin/ui/primitives";
import { setJournalArticleStatusAction } from "@/lib/admin/journal-actions";
import { shopDateString } from "@/lib/dates";
import type { AdminJournalArticleRow } from "@/lib/admin/journal";

/**
 * The article list. Publish state leads, exactly as the static-pages editor
 * does — "which of my articles are actually live" is the question this screen
 * exists to answer, and publish/unpublish is the most-used control, so it is
 * on the row rather than behind the editor.
 *
 * Not the shared <Table>: an article row is a title with a stack of small
 * metadata under it, which reads far better as a list than as five columns
 * squeezed onto a phone.
 */
export function JournalArticleList({
  articles,
  today,
}: {
  articles: AdminJournalArticleRow[];
  /** Resolved server-side — reading the clock during render is impure. */
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <>
      {msg && (
        <div
          role="status"
          className={`mb-4 rounded-md border px-4 py-2.5 text-sm ${
            msg.ok
              ? "border-success/30 bg-success/5 text-success"
              : "border-danger/30 bg-danger/5 text-danger"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        {articles.map((a) => {
          const isScheduled =
            a.status === "published" &&
            a.publishedAt !== null &&
            shopDateString(a.publishedAt) > today;
          return (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-surface"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/journal/${a.id}`} className="font-medium text-ink hover:underline">
                    {a.title}
                  </Link>
                  {a.status === "published" ? (
                    isScheduled ? (
                      <Badge tone="warning">Προγραμματισμένο</Badge>
                    ) : (
                      <Badge tone="success">Δημοσιευμένο</Badge>
                    )
                  ) : (
                    <Badge>Πρόχειρο</Badge>
                  )}
                  {a.isFeatured && <Badge tone="info">Κύριο</Badge>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                  <span>/journal/{a.slug}</span>
                  {a.categoryName && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{a.categoryName}</span>
                    </>
                  )}
                  {a.publishedAt && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{formatDate(a.publishedAt)}</span>
                    </>
                  )}
                  {!a.hasBody && <span className="text-accent">χωρίς κείμενο</span>}
                  {!a.hasHeroImage && <span className="text-accent">χωρίς εικόνα</span>}
                </div>
              </div>

              {a.status === "published" && (
                <a
                  href={`/journal/${a.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  Προβολή →
                </a>
              )}

              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await setJournalArticleStatusAction(
                      a.id,
                      a.status === "published" ? "draft" : "published",
                      a.slug
                    );
                    setMsg(
                      result.ok
                        ? { ok: true, text: result.message ?? "Έγινε." }
                        : { ok: false, text: result.error }
                    );
                    if (result.ok) router.refresh();
                  })
                }
                className="rounded-md border border-border px-2.5 py-1 text-sm text-ink transition-colors hover:bg-surface disabled:opacity-50"
              >
                {a.status === "published" ? "Απόσυρση" : "Δημοσίευση"}
              </button>

              <Link href={`/admin/journal/${a.id}`} className={buttonStyles.secondary}>
                Επεξεργασία
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
