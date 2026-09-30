import type { Metadata } from "next";
import { LoginForm } from "@/components/account/LoginForm";
import { isSafeRedirectPath } from "@/lib/checkout-validation";
import { googleSignInHref } from "@/lib/auth/google";

export const metadata: Metadata = {
  title: "Σύνδεση",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/eisodos" },
};

// What a failed "Συνέχεια με Google" lands here with (?google=…, set by
// app/api/auth/google and its callback via loginErrorPath). A cancel is the
// customer's own choice, so it gets no message at all.
const GOOGLE_MESSAGES: Record<string, string> = {
  failed: "Δεν ήταν δυνατή η σύνδεση με Google. Δοκίμασε ξανά ή συνδέσου με email.",
  unverified: "Το email του λογαριασμού Google δεν είναι επιβεβαιωμένο. Συνδέσου με email και κωδικό.",
  unavailable: "Η σύνδεση με Google δεν είναι διαθέσιμη αυτή τη στιγμή. Συνδέσου με email και κωδικό.",
  rate_limited: "Πάρα πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; reset?: string; google?: string }>;
}) {
  const { redirectTo, reset, google } = await searchParams;
  const destination = isSafeRedirectPath(redirectTo) ? redirectTo : "/logariasmos";
  const googleMessage = google ? GOOGLE_MESSAGES[google] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">Σύνδεση</h1>
      {reset === "success" && (
        <p role="status" className="rounded-sm bg-surface px-4 py-3 text-sm text-ink">
          Ο κωδικός σου ενημερώθηκε. Συνδέσου με τον νέο σου κωδικό.
        </p>
      )}
      {googleMessage && (
        <p role="alert" className="rounded-sm bg-surface px-4 py-3 text-sm text-danger">
          {googleMessage}
        </p>
      )}
      <LoginForm redirectTo={destination} googleHref={googleSignInHref(destination)} />
    </div>
  );
}
