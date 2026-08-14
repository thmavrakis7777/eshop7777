import { redirect } from "next/navigation";
import { getAdminUser, logoutAdmin } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * The session gate for every real admin page.
 *
 * proxy.ts already redirects unauthenticated requests away from /admin, but
 * that is a convenience, not the control: this check is the authoritative one
 * for page renders, and requireAdmin() is the authoritative one for Server
 * Actions. A page must never rely on middleware alone.
 */
export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  async function logout() {
    "use server";
    await logoutAdmin();
    redirect("/admin/login");
  }

  return (
    <AdminShell adminName={admin.name} adminRole={admin.role} logout={logout}>
      {children}
    </AdminShell>
  );
}
