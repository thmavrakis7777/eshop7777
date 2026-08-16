"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AdminAuthError, loginAdmin, setAdminSessionCookie } from "@/lib/admin/auth";
import { checkRateLimit, rateLimitKey } from "@/lib/auth/session";

/**
 * Admin Server Actions.
 *
 * Every action here is a publicly reachable HTTP endpoint — middleware does
 * not run for Server Action invocations — so each one authenticates itself
 * before doing anything. The login action below is the sole exception, and it
 * is rate limited precisely because it is the one unauthenticated door.
 */

const loginSchema = z.object({
  email: z.string().email("Μη έγκυρη διεύθυνση email."),
  password: z.string().min(1, "Συμπλήρωσε τον κωδικό πρόσβασης."),
});

export type AdminLoginState = { error?: string };

export async function adminLoginAction(
  _prev: AdminLoginState,
  formData: FormData
): Promise<AdminLoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Έλεγξε τα στοιχεία σου." };
  }

  // Tighter than the storefront's customer login (10/15min): far fewer people
  // legitimately hit this form, and it is the higher-value target.
  if (!(await checkRateLimit(await rateLimitKey("admin-login"), 5, 900))) {
    return { error: "Πάρα πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο." };
  }

  try {
    await setAdminSessionCookie(await loginAdmin(parsed.data.email, parsed.data.password));
  } catch (err) {
    if (err instanceof AdminAuthError) return { error: "Λάθος email ή κωδικός πρόσβασης." };
    return { error: "Κάτι πήγε στραβά. Δοκίμασε ξανά." };
  }

  // Outside the try: redirect() signals by throwing, so catching it here would
  // swallow the navigation and report a fake error.
  redirect("/admin");
}
