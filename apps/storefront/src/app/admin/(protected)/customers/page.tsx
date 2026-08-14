import Link from "next/link";
import { getMarketingConsentCount, listCustomers } from "@/lib/admin/customers";
import {
  Badge,
  EmptyState,
  LinkedRow,
  PageHeader,
  Table,
  Td,
  Th,
  formatDate,
  money,
} from "@/components/admin/ui/primitives";

export const metadata = { title: "Πελάτες" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const page = Math.max(1, Number(one(sp.page) ?? 1) || 1);

  const [{ customers, total, perPage }, consent] = await Promise.all([
    listCustomers({ q, page }),
    getMarketingConsentCount(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <>
      <PageHeader
        title="Πελάτες"
        description={`${total} ${total === 1 ? "πελάτης" : "πελάτες"} · ${consent.consented} με συγκατάθεση marketing`}
      />

      <form method="get" className="mb-5 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Email, όνομα ή τηλέφωνο…"
          aria-label="Αναζήτηση πελατών"
          className="min-w-[16rem] flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <button type="submit" className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface">
          Αναζήτηση
        </button>
        {q && (
          <Link href="/admin/customers" className="px-2 py-2 text-sm text-ink-muted hover:text-ink">
            Καθαρισμός
          </Link>
        )}
      </form>

      {customers.length === 0 ? (
        <EmptyState
          title={q ? "Κανένας πελάτης δεν ταιριάζει" : "Δεν υπάρχουν πελάτες ακόμα"}
          description={
            q
              ? "Δοκίμασε διαφορετική αναζήτηση."
              : "Οι πελάτες εμφανίζονται εδώ μόλις κάνουν την πρώτη τους παραγγελία ή δημιουργήσουν λογαριασμό."
          }
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Πελάτης</Th>
                <Th>Τύπος</Th>
                <Th align="right">Παραγγελίες</Th>
                <Th align="right">Σύνολο αγορών</Th>
                <Th>Εγγραφή</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <LinkedRow key={c.id} href={`/admin/customers/${c.id}`}>
                  <Td>
                    <div className="font-medium text-ink">{c.name || "—"}</div>
                    <div className="text-xs text-ink-muted">{c.email}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {c.hasAccount ? <Badge tone="info">Λογαριασμός</Badge> : <Badge>Επισκέπτης</Badge>}
                      {!c.isActive && <Badge tone="danger">Ανενεργός</Badge>}
                      {c.marketingConsent && <Badge tone="success">Marketing</Badge>}
                    </div>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {c.orderCount}
                  </Td>
                  <Td align="right" className="font-medium tabular-nums">
                    {money(c.totalSpentCents)}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-muted">{formatDate(c.createdAt)}</Td>
                </LinkedRow>
              ))}
            </tbody>
          </Table>
          {totalPages > 1 && (
            <nav className="mt-5 flex items-center justify-between text-sm" aria-label="Σελιδοποίηση">
              <span className="text-ink-muted">
                Σελίδα {page} από {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/admin/customers?page=${page - 1}`}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-surface"
                  >
                    Προηγούμενη
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/admin/customers?page=${page + 1}`}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-surface"
                  >
                    Επόμενη
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}
