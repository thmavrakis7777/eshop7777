// Same centered card shell as the (auth) group, deliberately NOT inside it.
//
// That group's layout redirects anyone already logged in to the dashboard,
// which silently breaks a real flow: request a reset on desktop while signed
// in on your phone, open the emailed link on the phone, and you are bounced
// to the dashboard with no way to set the new password. Flagged in
// PROJECT_MEMORY.md as a known issue; it became reachable the moment this
// app started sending its own reset emails, so it is fixed here rather than
// carried forward.
export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-shell flex justify-center py-12 md:py-20">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
