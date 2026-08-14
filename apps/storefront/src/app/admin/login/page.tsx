import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin/auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default async function AdminLoginPage() {
  // Already signed in — nothing to do here.
  if (await getAdminUser()) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface/40 px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-2xl tracking-tight">
            STIA
            <span className="ml-1.5 align-middle text-[10px] font-medium tracking-wider text-ink-muted uppercase">
              Admin
            </span>
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">Σύνδεση στη διαχείριση του καταστήματος</p>
        </div>
        <div className="rounded-lg border border-border bg-bg p-6">
          <AdminLoginForm />
        </div>
      </div>
    </div>
  );
}
