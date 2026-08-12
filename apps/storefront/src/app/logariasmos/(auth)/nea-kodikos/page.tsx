import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Ορισμός νέου κωδικού",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/nea-kodikos" },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl text-ink">Μη έγκυρος σύνδεσμος</h1>
        <p className="text-sm text-ink-muted">
          Αυτός ο σύνδεσμος δεν είναι έγκυρος. Ζήτησε έναν νέο σύνδεσμο επαναφοράς κωδικού.
        </p>
        <Link href="/logariasmos/xexasate-kodikos" className="text-sm text-accent hover:underline">
          Ζήτησε νέο σύνδεσμο
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">Ορισμός νέου κωδικού</h1>
      <ResetPasswordForm token={token} />
    </div>
  );
}
