"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createAdminAction,
  setAdminActiveAction,
  setAdminRoleAction,
} from "@/lib/admin/settings-actions";
import type { AdminUserRow } from "@/lib/admin/settings";

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

const dt = new Intl.DateTimeFormat("el-GR", { dateStyle: "medium", timeStyle: "short" });

/**
 * Admin accounts. Owner-only — the server enforces it via requireOwner(), and
 * the whole screen is hidden from staff rather than shown disabled, because a
 * control you can see but never use is just a question you cannot answer.
 *
 * You cannot act on your own row: no deactivating yourself, no demoting
 * yourself. Both are locked-out-of-your-own-store mistakes that are only
 * recoverable from a shell.
 */
export function AdminUsersManager({
  users,
  currentAdminId,
}: {
  users: AdminUserRow[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      setMsg(result.ok ? { ok: true, text: result.message ?? "Έγινε." } : { ok: false, text: result.error ?? "" });
      if (result.ok) {
        setCreating(false);
        router.refresh();
      }
    });
  }

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

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-ink px-3.5 py-2 text-sm font-medium text-bg hover:bg-ink/90"
        >
          Νέος διαχειριστής
        </button>
      </div>

      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            run(() => createAdminAction(data));
          }}
          className="mb-4 flex flex-col gap-4 rounded-lg border border-border bg-bg p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Όνομα</label>
              <input name="name" required autoFocus className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Email</label>
              <input name="email" type="email" required className={field} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Κωδικός</label>
              <input name="password" type="text" required className={field} />
              <p className="text-xs text-ink-muted">
                Τουλάχιστον 12 χαρακτήρες. Δώσ&apos; τον με ασφαλή τρόπο — δεν εμφανίζεται ξανά.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink">Ρόλος</label>
              <select name="role" defaultValue="staff" className={field}>
                <option value="staff">Προσωπικό</option>
                <option value="owner">Ιδιοκτήτης</option>
              </select>
              <p className="text-xs text-ink-muted">
                Μόνο οι ιδιοκτήτες διαχειρίζονται άλλους διαχειριστές.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bg hover:bg-ink/90 disabled:opacity-50"
            >
              {pending ? "Δημιουργία…" : "Δημιουργία"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface"
            >
              Άκυρο
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        {users.map((u) => {
          const isSelf = u.id === currentAdminId;
          return (
            <div
              key={u.id}
              className={`flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 ${
                u.isActive ? "" : "opacity-60"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{u.name}</span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-xs font-medium ${
                      u.role === "owner" ? "bg-surface-strong text-ink" : "bg-surface text-ink-muted"
                    }`}
                  >
                    {u.role === "owner" ? "Ιδιοκτήτης" : "Προσωπικό"}
                  </span>
                  {isSelf && (
                    <span className="rounded-sm bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">
                      Εσύ
                    </span>
                  )}
                  {!u.isActive && (
                    <span className="rounded-sm bg-danger/10 px-1.5 py-0.5 text-xs font-medium text-danger">
                      Ανενεργός
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-muted">{u.email}</div>
              </div>

              <div className="text-xs text-ink-muted">
                {u.lastLoginAt ? `Τελευταία σύνδεση ${dt.format(new Date(u.lastLoginAt))}` : "Δεν έχει συνδεθεί"}
              </div>

              {/* Acting on your own row is not offered at all — the server
                  refuses it too, but an absent button needs no explanation. */}
              {!isSelf && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setAdminRoleAction(u.id, u.role === "owner" ? "staff" : "owner"))}
                    className="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface disabled:opacity-50"
                  >
                    {u.role === "owner" ? "Σε προσωπικό" : "Σε ιδιοκτήτη"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setAdminActiveAction(u.id, !u.isActive))}
                    className={`rounded-md px-2.5 py-1 text-sm disabled:opacity-50 ${
                      u.isActive
                        ? "text-ink-muted hover:bg-danger/5 hover:text-danger"
                        : "border border-border text-ink hover:bg-surface"
                    }`}
                  >
                    {u.isActive ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
