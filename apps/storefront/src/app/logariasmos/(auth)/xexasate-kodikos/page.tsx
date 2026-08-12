import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/account/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Ξέχασες τον κωδικό;",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/xexasate-kodikos" },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">Ξέχασες τον κωδικό;</h1>
      <ForgotPasswordForm />
    </div>
  );
}
