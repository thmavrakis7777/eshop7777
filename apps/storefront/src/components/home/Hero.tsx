import Link from "next/link";

export function Hero() {
  return (
    <section className="container-shell pt-6 md:pt-10">
      <div className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-lg bg-surface-strong p-8 md:min-h-[32rem] md:p-14">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #e9d9cf 25%, transparent 25%), linear-gradient(315deg, #e9d9cf 25%, transparent 25%)",
            backgroundSize: "22px 22px",
            opacity: 0.6,
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-xl">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-accent">Νέα Συλλογή</p>
          <h1 className="mt-3 text-4xl text-ink md:text-6xl">
            Το σπίτι σου, <br className="hidden md:block" /> αναβαθμισμένο.
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-muted md:text-lg">
            Ποιοτικά είδη κουζίνας, μπάνιου και οργάνωσης — σχεδιασμένα να διαρκούν χρόνια, όχι σεζόν.
          </p>
          <Link
            href="/kouzina"
            className="mt-8 inline-flex items-center rounded-sm bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent"
          >
            Ανακάλυψε τη συλλογή
          </Link>
        </div>
      </div>
    </section>
  );
}
