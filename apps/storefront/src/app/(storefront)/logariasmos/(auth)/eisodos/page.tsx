import type { Metadata } from "next";
import { LoginForm } from "@/components/account/LoginForm";

export const metadata: Metadata = {
  title: "Σύνδεση",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/eisodos" },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; reset?: string }>;
}) {
  const { redirectTo, reset } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">Σύνδεση</h1>
      {reset === "success" && (
        <p role="status" className="rounded-sm bg-surface px-4 py-3 text-sm text-ink">
          Ο κωδικός σου ενημερώθηκε. Συνδέσου με τον νέο σου κωδικό.
        </p>
      )}
      <LoginForm redirectTo={redirectTo && redirectTo.startsWith("/") ? redirectTo : "/logariasmos"} />
    </div>
  );
}
