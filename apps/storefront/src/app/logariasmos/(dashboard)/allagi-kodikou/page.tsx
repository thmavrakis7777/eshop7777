import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export const metadata: Metadata = {
  title: "Αλλαγή κωδικού",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/allagi-kodikou" },
};

export default function ChangePasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">Αλλαγή κωδικού</h1>
      <ChangePasswordForm />
    </div>
  );
}
