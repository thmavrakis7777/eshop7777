import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/data/customer";

// Login/register/forgot-password/reset-password share this simple centered
// card shell. If a visitor is already logged in and lands here (e.g. a
// bookmarked /logariasmos/eisodos), there's nothing for them to do here —
// send them straight to the dashboard, same "arrived here without the
// prerequisite" redirect pattern as /checkout redirecting to /kalathi.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  if (customer) redirect("/logariasmos");

  return (
    <div className="container-shell flex justify-center py-12 md:py-20">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
