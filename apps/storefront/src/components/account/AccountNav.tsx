import Link from "next/link";
import { logoutAction } from "@/lib/actions/customer";

const NAV_ITEMS = [
  { href: "/logariasmos", label: "Επισκόπηση" },
  { href: "/logariasmos/parangelies", label: "Παραγγελίες" },
  { href: "/logariasmos/diefthinseis", label: "Διευθύνσεις" },
  { href: "/lista-epithymion", label: "Λίστα επιθυμιών" },
  { href: "/logariasmos/allagi-kodikou", label: "Αλλαγή κωδικού" },
];

// Server Component — the logout button is a plain <form action={...}>
// calling the Server Action directly, no client-side handler needed.
export function AccountNav({ customerName }: { customerName: string }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Λογαριασμός">
      <p className="mb-2 truncate text-sm font-medium text-ink">{customerName}</p>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-sm px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          {item.label}
        </Link>
      ))}
      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-sm px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          Αποσύνδεση
        </button>
      </form>
    </nav>
  );
}
