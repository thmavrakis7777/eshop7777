import Link from "next/link";
import type { NavCategory } from "@/lib/types";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";

const TONES = ["clay", "sage", "stone", "linen"] as const;

export function CategoryGrid({ categories }: { categories: NavCategory[] }) {
  return (
    <section className="container-shell mt-16 md:mt-24">
      <h2 className="text-2xl text-ink md:text-3xl">Ψώνισε κατά κατηγορία</h2>
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {categories.map((cat, i) => (
          <Link key={cat.handle} href={`/${cat.handle}`} className="group flex flex-col gap-2">
            <PlaceholderTile
              label={cat.name}
              tone={TONES[i % TONES.length]}
              className="transition-transform duration-200 ease-out group-hover:scale-[1.02]"
            />
            <span className="text-sm font-medium text-ink">{cat.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
