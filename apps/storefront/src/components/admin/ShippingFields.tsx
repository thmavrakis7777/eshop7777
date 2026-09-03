"use client";

import { useState } from "react";

/**
 * Per-product shipping override.
 *
 * Most products never touch this: "Κανονικό" means the product ships under
 * whichever method the customer picks at checkout, exactly as before. The
 * other classes exist for items that genuinely cost more to send.
 *
 * The class alone never changes what anyone is charged — the cost field does.
 * They are separate so the owner can label a group of products ("all our
 * heavy items") without a label silently becoming money, and so a class set
 * without a cost degrades to standard shipping rather than to a guess.
 *
 * The number here is only a hint to the server: the Server Action re-reads
 * both fields, checks the class against its own list and clamps the cost, so
 * a tampered form cannot set a negative or arbitrary shipping charge.
 */

const CLASSES = [
  { value: "standard", label: "Κανονικό", hint: "Χρησιμοποιεί τα κανονικά μεταφορικά του καταστήματος." },
  { value: "heavy", label: "Βαρύ", hint: "Π.χ. μεγάλες κατσαρόλες, σετ εργαλείων." },
  { value: "large", label: "Ογκώδες", hint: "Π.χ. έπιπλα, μεγάλα καλάθια." },
  { value: "custom", label: "Ειδικό", hint: "Ό,τι δεν ταιριάζει στις παραπάνω κατηγορίες." },
] as const;

const field =
  "w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-ink";

export function ShippingFields({
  defaultClass,
  defaultCostCents,
}: {
  defaultClass: string;
  defaultCostCents: number | null;
}) {
  const [cls, setCls] = useState(defaultClass || "standard");
  const isStandard = cls === "standard";

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 block text-xs font-medium text-ink-muted">Τύπος αποστολής</legend>
        <div className="flex flex-col gap-2">
          {CLASSES.map((c) => (
            <label key={c.value} className="flex items-start gap-2 text-sm text-ink">
              <input
                type="radio"
                name="shippingClass"
                value={c.value}
                checked={cls === c.value}
                onChange={() => setCls(c.value)}
                className="mt-0.5 h-4 w-4 accent-ink"
              />
              <span className="flex flex-col">
                <span>{c.label}</span>
                <span className="text-xs text-ink-muted">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="shippingCost">
          Κόστος αποστολής (€)
        </label>
        <input
          id="shippingCost"
          name="shippingCost"
          type="text"
          inputMode="decimal"
          disabled={isStandard}
          defaultValue={defaultCostCents != null ? (defaultCostCents / 100).toFixed(2) : ""}
          placeholder={isStandard ? "Κανονικά μεταφορικά" : "8.00"}
          className={`${field} disabled:opacity-50`}
        />
        <p className="mt-1 text-xs text-ink-muted">
          {isStandard
            ? "Διάλεξε άλλον τύπο για να ορίσεις δικό σου κόστος."
            : "Κενό = χρησιμοποιούνται τα κανονικά μεταφορικά παρά τον τύπο."}
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface p-3">
        <p className="text-xs font-medium text-ink">Πώς υπολογίζεται στο καλάθι</p>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-xs text-ink-muted">
          <li>Αν το καλάθι έχει έστω ένα μη κανονικό προϊόν, χρεώνεται μόνο το υψηλότερο κόστος από αυτά — όχι το άθροισμά τους.</li>
          <li>Δεν πολλαπλασιάζεται με την ποσότητα.</li>
          <li>Τα κανονικά προϊόντα ταξιδεύουν μαζί χωρίς επιπλέον χρέωση.</li>
          <li>Τα κανονικά μεταφορικά χρεώνονται μόνο αν το καλάθι δεν έχει κανένα ειδικό προϊόν.</li>
          <li>
            Π.χ. 1 βαρύ (7€) + 1 βαρύ (12€) = <strong className="text-ink">12€</strong>, όχι 19€. 3 τεμάχια του ίδιου
            βαριού (7€) = <strong className="text-ink">7€</strong>, όχι 21€.
          </li>
          <li>Στο Ηράκλειο, το όριο δωρεάν μεταφορικών καλύπτει και τα ειδικά κόστη. Στην υπόλοιπη Ελλάδα, όχι.</li>
        </ul>
      </div>
    </div>
  );
}
