import Link from "next/link";
import { listInventory } from "@/lib/admin/taxonomy";
import { InventoryTable } from "@/components/admin/InventoryTable";
import { EmptyState, PageHeader } from "@/components/admin/ui/primitives";

export const metadata = { title: "Απόθεμα" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const view = (one(sp.view) ?? "all") as "all" | "low" | "out";
  const rows = await listInventory({ q, view });

  const tabs = [
    { key: "all", label: "Όλα" },
    { key: "low", label: "Χαμηλό (≤5)" },
    { key: "out", label: "Εξαντλημένα" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Απόθεμα"
        description="Γρήγορη επεξεργασία αποθέματος για κάθε παραλλαγή, χωρίς να ανοίξεις το προϊόν."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/admin/inventory${t.key === "all" ? "" : `?view=${t.key}`}`}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                view === t.key ? "bg-surface-strong font-medium text-ink" : "text-ink-muted hover:bg-surface"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form method="get" className="ml-auto flex gap-2">
          {view !== "all" && <input type="hidden" name="view" value={view} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Αναζήτηση προϊόντος ή SKU…"
            aria-label="Αναζήτηση αποθέματος"
            className="w-56 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-ink"
          />
          <button type="submit" className="rounded-md border border-border px-3.5 py-2 text-sm hover:bg-surface">
            Αναζήτηση
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={view === "out" ? "Κανένα εξαντλημένο προϊόν" : view === "low" ? "Κανένα προϊόν με χαμηλό απόθεμα" : "Δεν βρέθηκαν προϊόντα"}
          description={view === "all" ? "Δοκίμασε διαφορετική αναζήτηση." : "Καλά νέα."}
        />
      ) : (
        <InventoryTable rows={rows} />
      )}
    </>
  );
}
