import type { Metadata } from "next";
import { RegisterForm } from "@/components/account/RegisterForm";
import { isSafeRedirectPath } from "@/lib/checkout-validation";
import { googleSignInHref } from "@/lib/auth/google";

export const metadata: Metadata = {
  title: "Δημιουργία λογαριασμού",
  robots: { index: false, follow: true },
  alternates: { canonical: "/logariasmos/eggrafi" },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  const destination = isSafeRedirectPath(redirectTo) ? redirectTo : "/logariasmos";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-ink">Δημιουργία λογαριασμού</h1>
      <RegisterForm redirectTo={destination} googleHref={googleSignInHref(destination)} />
    </div>
  );
}
