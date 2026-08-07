"use client";

export function Newsletter() {
  return (
    <section className="container-shell mt-16 md:mt-24">
      <div className="rounded-lg bg-ink px-6 py-12 text-center md:px-12 md:py-16">
        <h2 className="font-display text-2xl text-white md:text-3xl">Μείνε ενημερωμένος</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
          Νέες αφίξεις, οδηγοί αγορών και αποκλειστικές προσφορές, απευθείας στο inbox σου.
        </p>
        <form className="mx-auto mt-6 flex max-w-sm gap-2" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="newsletter-email" className="sr-only">
            Email
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            placeholder="Το email σου"
            className="w-full rounded-sm border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/50 outline-none focus-visible:border-white"
          />
          <button
            type="submit"
            className="shrink-0 rounded-sm bg-white px-5 py-2.5 text-sm font-medium text-ink hover:bg-white/90 transition-colors"
          >
            Εγγραφή
          </button>
        </form>
      </div>
    </section>
  );
}
