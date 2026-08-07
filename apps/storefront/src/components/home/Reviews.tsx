import { Stars } from "@/components/ui/Stars";

const reviews = [
  {
    name: "Ελένη Κ.",
    text: "Το σετ κατσαρόλες είναι εξαιρετικής ποιότητας, μοιάζει πολύ πιο ακριβό απ' όσο πλήρωσα. Γρήγορη παράδοση.",
    rating: 5,
  },
  {
    name: "Γιώργος Π.",
    text: "Παρήγγειλα οργάνωση ντουλάπας για το καινούριο σπίτι — εύκολη συναρμολόγηση, φαίνεται premium.",
    rating: 5,
  },
  {
    name: "Μαρία Δ.",
    text: "Το τηγάνι είναι το καλύτερο που έχω αγοράσει, τίποτα δεν κολλάει. Θα ξαναπαραγγείλω σίγουρα.",
    rating: 4,
  },
];

export function Reviews() {
  return (
    <section className="container-shell mt-16 md:mt-24">
      <h2 className="text-2xl text-ink md:text-3xl">Τι λένε οι πελάτες μας</h2>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {reviews.map((r) => (
          <figure key={r.name} className="rounded-lg border border-border p-6">
            <Stars rating={r.rating} />
            <blockquote className="mt-3 text-sm text-ink-muted">&ldquo;{r.text}&rdquo;</blockquote>
            <figcaption className="mt-4 text-sm font-medium text-ink">{r.name}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
