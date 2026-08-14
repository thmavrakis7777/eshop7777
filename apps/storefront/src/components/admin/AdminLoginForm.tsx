"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adminLoginAction, type AdminLoginState } from "@/lib/admin/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-full rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-bg transition-colors duration-120 hover:bg-ink/90 disabled:opacity-60"
    >
      {pending ? "Σύνδεση…" : "Σύνδεση"}
    </button>
  );
}

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

export function AdminLoginForm() {
  const [state, formAction] = useActionState<AdminLoginState, FormData>(adminLoginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-email" className="text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className={field}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admin-password" className="text-sm font-medium text-ink">
          Κωδικός πρόσβασης
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </div>

      {/* One message for every failure mode — never "no such user", which
          would turn this form into an account-enumeration tool. */}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
