import Link from "next/link";
import { PlaceholderTile } from "@/components/ui/PlaceholderTile";

export function EditorialBanner() {
  return (
    <section className="container-shell mt-16 md:mt-24">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <div className="rounded-lg bg-surface p-8 md:p-12 flex flex-col justify-center order-2 md:order-1">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-accent">Οδηγός Αγοράς</p>
          <h2 className="mt-3 text-2xl text-ink md:text-3xl">
            Πώς να διαλέξεις το σωστό αντικολλητικό τηγάνι
          </h2>
          <p className="mt-3 text-sm text-ink-muted md:text-base">
            Υλικό, μέγεθος, συμβατότητα με εστίες — ό,τι χρειάζεται να ξέρεις πριν αγοράσεις.
          </p>
          <Link href="/odigoi-agoron/tigania" className="mt-6 text-sm font-medium text-ink underline underline-offset-4">
            Διάβασε τον οδηγό
          </Link>
        </div>
        <div className="order-1 md:order-2">
          <PlaceholderTile label="Οδηγός Αγοράς" tone="sage" className="aspect-square md:aspect-auto md:h-full" />
        </div>
      </div>
    </section>
  );
}
