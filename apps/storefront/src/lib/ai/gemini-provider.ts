import "server-only";
import {
  AIProviderError,
  type AIProvider,
  type SeoField,
  type SeoGenerationInput,
  type SeoGenerationResult,
} from "@/lib/ai/provider";

/**
 * Gemini implementation of AIProvider. Direct REST call, no SDK — same
 * shape as every other third-party integration in this codebase (Resend,
 * Google Places, ΓΕΜΗ): one fetch, a server-only key, no new dependency.
 *
 * Uses Gemini's native structured output (`responseSchema`) rather than
 * asking for JSON in the prompt and hoping — the model is constrained to
 * return exactly the requested shape, so parsing never has to guess at
 * markdown fences or trailing prose.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const FIELD_DESCRIPTIONS: Record<SeoField, string> = {
  description: "Πρωτότυπη περιγραφή προϊόντος, 2-4 προτάσεις φυσικού, χρήσιμου ελληνικού κειμένου.",
  seoTitle: "Σύντομος, φυσικός τίτλος SEO (έως ~60 χαρακτήρες) όπως θα αναζητούσε το προϊόν ένας πελάτης.",
  metaDescription: "Meta description (έως ~155 χαρακτήρες), εξηγεί το προϊόν, χωρίς clickbait.",
  h1: "Καθαρός H1 — συνήθως πολύ κοντά στο πραγματικό όνομα του προϊόντος.",
  slug: "URL slug: πεζά λατινικά, αριθμοί και παύλες μόνο, σύντομο και περιγραφικό.",
  imageAlt: "Σύντομο, περιγραφικό alt text για την κύρια φωτογραφία (όχι λέξεις-κλειδιά).",
};

const ALL_FIELDS: SeoField[] = ["description", "seoTitle", "metaDescription", "h1", "slug", "imageAlt"];

// The Greek search-intent methodology — static rules written once, never a
// live lookup (explicit requirement: no Google Search call per product, no
// fabricated search-volume claims). The model applies these as reasoning
// guidance, not as literal keywords to insert.
const SYSTEM_PROMPT = `Είσαι έμπειρος συντάκτης περιεχομένου e-commerce για ένα σοβαρό ελληνικό κατάστημα οικιακών ειδών (MAVRAKIS HOME). Γράφεις πρωτότυπο, φυσικό ελληνικό κείμενο — ποτέ δεν αντιγράφεις τις σημειώσεις του διαχειριστή αυτούσιες.

ΜΕΘΟΔΟΛΟΓΙΑ ΑΝΑΖΗΤΗΣΗΣ (εσωτερική, μην την εμφανίζεις): Οι Έλληνες καταναλωτές αναζητούν προϊόντα συνήθως ως "τύπος προϊόντος + μέγεθος", "τύπος + χρώμα", "τύπος + μάρκα", "τύπος + βασικό χαρακτηριστικό" ή "τύπος + χρήση". ΔΕΝ έχεις πρόσβαση σε πραγματικά δεδομένα όγκου αναζήτησης — μην ισχυριστείς ποτέ ότι κάτι είναι "το πιο δημοφιλές" ή βασισμένο σε πραγματικά στατιστικά αναζήτησης. Χρησιμοποίησε τη φυσική ορολογία που θα χρησιμοποιούσε ένας πελάτης, όχι λίστα λέξεων-κλειδιών.

ΑΥΣΤΗΡΟΙ ΚΑΝΟΝΕΣ:
1. Μην εφευρίσκεις ΠΟΤΕ χαρακτηριστικά, υλικά, διαστάσεις, συμβατότητα, πιστοποιήσεις ή εγγυήσεις που δεν σου δόθηκαν ρητά. Αν κάτι λείπει, απλά μην το αναφέρεις.
2. Μην κάνεις keyword stuffing — μία φυσική, ρέουσα πρόταση, όχι λίστα όρων.
3. Απόφυγε υπερβολικούς ισχυρισμούς ("το καλύτερο", "νούμερο ένα", "απίστευτο") εκτός αν υποστηρίζονται ρητά από τα δεδομένα.
4. Κάθε προϊόν πρέπει να έχει πραγματικά μοναδικό κείμενο — ποίκιλλε δομή πρότασης, σειρά πληροφοριών και εισαγωγή, μην ξεκινάς πάντα με το ίδιο μοτίβο.
5. Το slug είναι πεζά λατινικά, αριθμοί και παύλες μόνο — ποτέ ελληνικοί χαρακτήρες, ποτέ κενά.
6. Το H1 πρέπει να είναι κοντά στο πραγματικό όνομα προϊόντος, όχι γεμάτο keywords.
7. Έξοδος πάντα στα ελληνικά, εκτός από το slug.`;

function buildUserPrompt(input: SeoGenerationInput, fields: SeoField[]): string {
  const facts: string[] = [`Τίτλος: ${input.title}`];
  if (input.categoryName) {
    facts.push(`Κατηγορία: ${input.parentCategoryName ? `${input.parentCategoryName} > ` : ""}${input.categoryName}`);
  }
  if (input.collectionTitles.length > 0) facts.push(`Συλλογές: ${input.collectionTitles.join(", ")}`);
  if (input.sku) facts.push(`SKU: ${input.sku}`);
  if (input.variantTitle) facts.push(`Παραλλαγή: ${input.variantTitle}`);
  if (input.material) facts.push(`Υλικό: ${input.material}`);
  if (input.weightGrams) facts.push(`Βάρος: ${input.weightGrams}g`);
  if (input.lengthCm || input.widthCm || input.heightCm) {
    facts.push(
      `Διαστάσεις: ${[input.lengthCm && `Μ${input.lengthCm}`, input.widthCm && `Π${input.widthCm}`, input.heightCm && `Υ${input.heightCm}`]
        .filter(Boolean)
        .join(" x ")} εκ.`
    );
  }
  if (input.originCountry) facts.push(`Χώρα προέλευσης: ${input.originCountry}`);
  if (input.priceCents != null) facts.push(`Τιμή: ${(input.priceCents / 100).toFixed(2)} EUR`);
  if (input.description) facts.push(`Υπάρχουσα περιγραφή (πλαίσιο, όχι για αντιγραφή): ${input.description}`);
  if (input.adminNotes) {
    facts.push(
      `Σημειώσεις διαχειριστή (ΠΛΑΙΣΙΟ ΜΟΝΟ — μην τις αντιγράψεις αυτούσιες, χρησιμοποίησέ τες για να καταλάβεις το προϊόν): ${input.adminNotes}`
    );
  }
  facts.push(`Τρέχον slug: ${input.existingSlug}${input.isPublished ? " (ΔΗΜΟΣΙΕΥΜΕΝΟ — πρότεινε αλλαγή μόνο αν είναι πραγματικά απαραίτητο)" : ""}`);

  const wanted = fields.map((f) => `- ${f}: ${FIELD_DESCRIPTIONS[f]}`).join("\n");

  return `Δεδομένα προϊόντος:\n${facts.map((f) => `- ${f}`).join("\n")}\n\nΔημιούργησε ΜΟΝΟ τα παρακάτω πεδία, σύμφωνα με το json schema:\n${wanted}`;
}

function buildResponseSchema(fields: SeoField[]) {
  const properties: Record<string, { type: string; description: string }> = {};
  for (const f of fields) properties[f] = { type: "string", description: FIELD_DESCRIPTIONS[f] };
  return { type: "OBJECT", properties, required: fields };
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export class GeminiProvider implements AIProvider {
  async generateSeoContent(input: SeoGenerationInput, fields: SeoField[] = ALL_FIELDS): Promise<SeoGenerationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AIProviderError("Gemini API key not configured", "not_configured");

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = buildUserPrompt(input, fields);

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: buildResponseSchema(fields),
            temperature: 0.9, // higher than default — instruction §12 wants genuine variety across products, not a fixed template
          },
        }),
      });
    } catch (err) {
      throw new AIProviderError(`Gemini request failed: ${String(err)}`, "request_failed");
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AIProviderError(`Gemini returned ${res.status}: ${body.slice(0, 300)}`, "request_failed");
    }

    const data: GeminiResponse = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AIProviderError("Gemini returned no content", "invalid_response");

    let parsed: Partial<SeoGenerationResult>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AIProviderError("Gemini returned malformed JSON", "invalid_response");
    }

    // Fields not requested come back empty rather than undefined, so callers
    // that only persist `fields` never accidentally treat a missing key as
    // "clear this value".
    const result = {} as SeoGenerationResult;
    for (const f of ALL_FIELDS) result[f] = parsed[f] ?? "";
    return result;
  }
}
