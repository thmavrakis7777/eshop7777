import Link from "next/link";

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
}: {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Σελιδοποίηση">
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors"
        >
          Προηγούμενα
        </Link>
      ) : (
        <span className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-ink-muted opacity-50" aria-disabled="true">
          Προηγούμενα
        </span>
      )}
      <span className="text-sm text-ink-muted">
        Σελίδα {currentPage} από {totalPages}
      </span>
      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface transition-colors"
        >
          Επόμενα
        </Link>
      ) : (
        <span className="rounded-sm border border-border px-4 py-2 text-sm font-medium text-ink-muted opacity-50" aria-disabled="true">
          Επόμενα
        </span>
      )}
    </nav>
  );
}
