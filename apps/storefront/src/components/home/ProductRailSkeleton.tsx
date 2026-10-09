import { RAIL_CARD_WIDTH, type RailCardSize } from "@/components/home/rail-card-size";

// Suspense fallback for a ProductRail — same container/heading/card-track
// dimensions as the real thing so streaming it in doesn't shift layout.
// Title is real copy (not "Φόρτωση…"), since it's known before the
// products are: the rail's own title never depends on the fetch it's
// waiting on.
export function ProductRailSkeleton({ title, size = "default" }: { title: string; size?: RailCardSize }) {
  return (
    <section className="container-shell mt-16 md:mt-24" aria-hidden="true">
      <div className="flex items-end justify-between">
        <h2 className="text-2xl text-ink md:text-3xl">{title}</h2>
      </div>
      <div className="mt-6 flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square flex-none animate-pulse rounded-md bg-surface ${RAIL_CARD_WIDTH[size]}`}
          />
        ))}
      </div>
    </section>
  );
}
