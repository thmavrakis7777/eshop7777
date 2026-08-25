"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "@/components/checkout/FormField";
import { loginAction } from "@/lib/actions/customer";
import { mergeWishlistOnLoginAction } from "@/lib/actions/wishlist";
import { getWishlistSnapshot } from "@/lib/wishlist-storage";
import { isValidEmail, isRequired } from "@/lib/checkout-validation";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email) || !isRequired(password)) {
      setError("Συμπλήρωσε email και κωδικό πρόσβασης.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await loginAction({ email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Server Actions can't read localStorage — the guest wishlist has to
      // be merged from here, right after login succeeds. Best-effort: a
      // failure here must not block navigating past a successful login.
      try {
        await mergeWishlistOnLoginAction(getWishlistSnapshot());
      } catch {
        // Non-critical — the account's own wishlist still loads normally.
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormField id="login-email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
      <FormField
        id="login-password"
        label="Κωδικός πρόσβασης"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="h-11 rounded-sm bg-ink text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {isPending ? "Σύνδεση…" : "Σύνδεση"}
      </button>
      <div className="flex items-center justify-between text-sm">
        <Link href="/logariasmos/xexasate-kodikos" className="text-ink-muted hover:text-ink hover:underline">
          Ξέχασες τον κωδικό;
        </Link>
        <Link href="/logariasmos/eggrafi" className="text-accent hover:underline">
          Δημιουργία λογαριασμού
        </Link>
      </div>
    </form>
  );
}
