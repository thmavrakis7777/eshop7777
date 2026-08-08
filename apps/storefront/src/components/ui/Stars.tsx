export function Stars({ rating, count }: { rating: number; count?: number }) {
  const full = Math.round(rating);
  return (
    // role="img" is load-bearing: aria-label on a bare <div> has no role to
    // attach to and is ignored by most screen readers.
    <div className="flex items-center gap-1" role="img" aria-label={`Βαθμολογία ${rating} από 5`}>
      <div className="flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={`h-3.5 w-3.5 ${i < full ? "fill-accent" : "fill-border"}`}
          >
            <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1 1 5.79L10 14.9l-5.21 2.61 1-5.79-4.21-4.1 5.82-.85z" />
          </svg>
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-ink-muted">({count})</span>
      )}
    </div>
  );
}
