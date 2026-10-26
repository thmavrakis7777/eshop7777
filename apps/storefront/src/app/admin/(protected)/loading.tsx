/**
 * Shown the moment an admin link is clicked, inside the shell (sidebar and
 * header stay put), until the next page has rendered. Every admin page is
 * rendered fresh from the database, so without this a click — «Επόμενη» on
 * the products list, a sidebar item — showed nothing for a second or more
 * and looked like it hadn't worked.
 */
export default function AdminLoading() {
  return (
    <div role="status" className="flex items-center gap-3 py-16 text-sm text-ink-muted">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-ink"
      />
      Φόρτωση…
    </div>
  );
}
