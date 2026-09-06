import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCustomer } from "@/lib/data/customer";
import { AccountNav } from "@/components/account/AccountNav";

// Every page under this group is a real customer-only dashboard section.
// No customer session (missing/expired cookie) → straight to login, same
// redirect pattern as /checkout → /kalathi for a missing prerequisite.
// getCustomer() never throws (see lib/data/customer.ts) so an expired
// token reads as "not logged in" here, not a crash.
export default async function AccountDashboardLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  if (!customer) {
    // A layout has no searchParams/pathname prop — x-pathname is proxy.ts's
    // middleware-injected current path (same read-side convention as
    // x-nonce). Without this, every deep link under this group (e.g.
    // /logariasmos/parangelies) redirected to login and then landed back on
    // the generic /logariasmos overview instead of the page actually
    // requested. Always same-origin (derived from the request's own URL,
    // never attacker-controlled) so it doesn't need isSafeRedirectPath.
    const currentPath = (await headers()).get("x-pathname") || "/logariasmos";
    redirect(`/logariasmos/eisodos?redirectTo=${encodeURIComponent(currentPath)}`);
  }

  return (
    <div className="container-shell grid grid-cols-1 gap-8 py-8 md:grid-cols-[220px_1fr] md:py-12">
      <aside className="md:border-r md:border-border md:pr-6">
        <AccountNav customerName={`${customer.firstName} ${customer.lastName}`.trim() || customer.email} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
