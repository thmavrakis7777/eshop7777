import "server-only";
import {
  AIProviderError,
  type AIProvider,
  type SeoField,
  type SeoGenerationInput,
  type SeoGenerationResult,
  type SeoSubjectType,
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

/**
 * Per-field instructions sent to Gemini, both in the prompt text and as the
 * structured-output schema's own field descriptions. Only the 3 fields a
 * category ever requests (description/seoTitle/metaDescription — see
 * ai-category-seo-actions.ts) have a "category" variant; h1/slug/imageAlt
 * are never requested for a category, so their (product-only) wording is
 * harmless to leave as-is rather than writing text nothing will read.
 */
function fieldDescriptions(subject: SeoSubjectType): Record<SeoField, string> {
  const forCategory = subject === "category";
  return {
    description: forCategory
      ? "Πρωτότυπη περιγραφή κατηγορίας προϊόντων, 2-4 προτάσεις φυσικού, χρήσιμου ελληνικού κειμένου — για σελίδα-λίστα πολλών προϊόντων, όχι για ένα μεμονωμένο προϊόν."
      : "Πρωτότυπη περιγραφή προϊόντος, 2-4 προτάσεις φυσικού, χρήσιμου ελληνικού κειμένου.",
    seoTitle: forCategory
      ? "Σύντομος, φυσικός τίτλος SEO (έως ~60 χαρακτήρες) όπως θα αναζητούσε την κατηγορία ένας πελάτης."
      : "Σύντομος, φυσικός τίτλος SEO (έως ~60 χαρακτήρες) όπως θα αναζητούσε το προϊόν ένας πελάτης.",
    metaDescription: forCategory
      ? "Meta description (έως ~155 χαρακτήρες), εξηγεί τι θα βρει ο πελάτης σε αυτή την κατηγορία, χωρίς clickbait."
      : "Meta description (έως ~155 χαρακτήρες), εξηγεί το προϊόν, χωρίς clickbait.",
    h1: "Καθαρός H1 — συνήθως πολύ κοντά στο πραγματικό όνομα του προϊόντος.",
    slug: "URL slug: πεζά λατινικά, αριθμοί και παύλες μόνο, σύντομο και περιγραφικό.",
    imageAlt: "Σύντομο, περιγραφικό alt text για την κύρια φωτογραφία (όχι λέξεις-κλειδιά).",
  };
}

const ALL_FIELDS: SeoField[] = ["description", "seoTitle", "metaDescription", "h1", "slug", "imageAlt"];

// The Greek search-intent methodology — static rules written once, never a
// live lookup (explicit requirement: no Google Search call per product, no
// fabricated search-volume claims). The model applies these as reasoning
// guidance, not as literal keywords to insert.
function systemPrompt(subject: SeoSubjectType): string {
  const categoryNote =
    subject === "category"
      ? "\n\nΣΗΜΑΝΤΙΚΟ: Αυτή τη φορά γράφεις για μια ΚΑΤΗΓΟΡΙΑ προϊόντων — μια σελίδα-λίστα με πολλά διαφορετικά προϊόντα μέσα, όχι ένα συγκεκριμένο προϊόν. Γράψε σαν να καλωσορίζεις τον πελάτη σε αυτό το τμήμα του καταστήματος (π.χ. \"Στα Χ θα βρεις...\", \"Η κατηγορία Χ περιλαμβάνει...\"), ποτέ σαν να περιγράφεις τα χαρακτηριστικά ενός μεμονωμένου αντικειμένου."
      : "";
  return `Είσαι έμπειρος συντάκτης περιεχομένου e-commerce για ένα σοβαρό ελληνικό κατάστημα οικιακών ειδών (MAVRAKIS HOME). Γράφεις πρωτότυπο, φυσικό ελληνικό κείμενο — ποτέ δεν αντιγράφεις αυτούσια την περιγραφή ή τις σημειώσεις του διαχειριστή.${categoryNote}

ΙΕΡΑΡΧΙΑ ΠΗΓΩΝ (εφάρμοσέ την με αυτή τη σειρά):
1. Τα δομημένα στοιχεία προϊόντος (κατηγορία, υλικό, διαστάσεις, βάρος, SKU, παραλλαγή, τιμή κ.λπ.) είναι η πηγή αλήθειας.
2. Η περιγραφή/σημειώσεις του διαχειριστή είναι ΠΕΡΙΕΧΟΜΕΝΟ-ΟΔΗΓΟΣ (content brief): συχνά περιέχει σκόπιμα συγκεκριμένους όρους, χαρακτηριστικά ή σημεία πώλησης που θέλει να αντικατοπτρίζονται στο κείμενο (π.χ. "wok 30cm, μαύρο, αλουμίνιο, αντικολλητικό, λαβή βακελίτη"). Αντιμετώπισέ τη ως σημαντική είσοδο — όχι ως κείμενο προς αντιγραφή, ούτε ως κάτι που αγνοείς.
3. Αν κάτι στην περιγραφή/σημείωση του διαχειριστή έρχεται σε αντίθεση με τα δομημένα στοιχεία, ΜΗΝ ακολουθήσεις τυφλά τον αντικρουόμενο ισχυρισμό — προτίμησε πάντα τα δομημένα στοιχεία.
4. Αν ένα στοιχείο εμφανίζεται ΜΟΝΟ στην περιγραφή/σημείωση του διαχειριστή και δεν έρχεται σε αντίθεση με τα δομημένα δεδομένα, μπορείς να το χρησιμοποιήσεις — αλλά μην εφευρίσκεις επιπλέον λεπτομέρειες γύρω από αυτό.
5. Εσύ είσαι η τελευταία βαθμίδα: αναδιατύπωση, οργάνωση και φυσική, SEO/GEO-φιλική διατύπωση — όχι νέα δεδομένα.

ΔΙΑΤΗΡΗΣΗ ΟΡΟΛΟΓΙΑΣ: Σημαντικοί όροι που έγραψε σκόπιμα ο διαχειριστής (τύπος προϊόντος, μέγεθος, χρώμα, υλικό, βασικά χαρακτηριστικά) πρέπει κανονικά να διατηρούνται στο τελικό κείμενο σε φυσική μορφή, όταν υποστηρίζονται από τα δεδομένα — αλλά ΟΧΙ ως μηχανική λίστα λέξεων-κλειδιών και ΟΧΙ με κατά λέξη επανάληψη. Εντάσσονται μέσα σε φυσικές, ρέουσες προτάσεις με φυσική γραμματική παραλλαγή.

ΠΑΡΑΔΕΙΓΜΑ ΥΦΟΥΣ (μόνο για καθοδήγηση, όχι για αντιγραφή):
Σημείωση διαχειριστή: "Τηγάνι wok 30cm, μαύρο, αλουμίνιο, αντικολλητικό, λαβή βακελίτη."
ΛΑΘΟΣ (αυτούσια αντιγραφή): "Τηγάνι wok 30cm, μαύρο, αλουμίνιο, αντικολλητικό, λαβή βακελίτη."
ΣΩΣΤΟ (γνήσια αναδιατύπωση): "Το τηγάνι wok 30cm συνδυάζει κατασκευή από αλουμίνιο με αντικολλητική επίστρωση για πρακτικό καθημερινό μαγείρεμα. Σε μαύρο χρώμα και με λαβή από βακελίτη, αποτελεί μια λειτουργική επιλογή για την κουζίνα."

ΜΕΘΟΔΟΛΟΓΙΑ ΑΝΑΖΗΤΗΣΗΣ (εσωτερική, μην την εμφανίζεις): Οι Έλληνες καταναλωτές αναζητούν προϊόντα συνήθως ως "τύπος προϊόντος + μέγεθος", "τύπος + χρώμα", "τύπος + μάρκα", "τύπος + βασικό χαρακτηριστικό" ή "τύπος + χρήση". ΔΕΝ έχεις πρόσβαση σε πραγματικά δεδομένα όγκου αναζήτησης — μην ισχυριστείς ποτέ ότι κάτι είναι "το πιο δημοφιλές" ή βασισμένο σε πραγματικά στατιστικά αναζήτησης, ούτε ότι κάποιος όρος του διαχειριστή είναι υψηλού όγκου αναζήτησης. Χρησιμοποίησε τη φυσική ορολογία που θα χρησιμοποιούσε ένας πελάτης, όχι λίστα λέξεων-κλειδιών.

ΑΥΣΤΗΡΟΙ ΚΑΝΟΝΕΣ:
1. Μην εφευρίσκεις ΠΟΤΕ χαρακτηριστικά, υλικά, διαστάσεις, συμβατότητα, πιστοποιήσεις ή εγγυήσεις που δεν σου δόθηκαν ρητά. Αν κάτι λείπει, απλά μην το αναφέρεις.
2. Μην κάνεις keyword stuffing — μία φυσική, ρέουσα πρόταση, όχι λίστα όρων.
3. Απόφυγε υπερβολικούς ισχυρισμούς ("το καλύτερο", "νούμερο ένα", "απίστευτο") εκτός αν υποστηρίζονται ρητά από τα δεδομένα.
4. Κάθε προϊόν πρέπει να έχει πραγματικά μοναδικό κείμενο — ποίκιλλε δομή πρότασης, σειρά πληροφοριών και εισαγωγή, μην ξεκινάς πάντα με το ίδιο μοτίβο.
5. Το slug είναι πεζά λατινικά, αριθμοί και παύλες μόνο — ποτέ ελληνικοί χαρακτήρες, ποτέ κενά.
6. Το H1 πρέπει να είναι κοντά στο πραγματικό όνομα προϊόντος, όχι γεμάτο keywords.
7. Έξοδος πάντα στα ελληνικά, εκτός από το slug.
8. Μην αντιγράφεις ΠΟΤΕ αυτούσια ή σχεδόν αυτούσια την περιγραφή ή τις σημειώσεις του διαχειριστή — το τελικό κείμενο πρέπει να είναι γνήσια αναδιατυπωμένο, όπως στο ΠΑΡΑΔΕΙΓΜΑ ΥΦΟΥΣ παραπάνω.`;
}

function buildUserPrompt(input: SeoGenerationInput, fields: SeoField[]): string {
  const subject = input.subjectType ?? "product";
  const forCategory = subject === "category";
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
  facts.push(`Τρέχον slug: ${input.existingSlug}${input.isPublished ? " (ΔΗΜΟΣΙΕΥΜΕΝΟ — πρότεινε αλλαγή μόνο αν είναι πραγματικά απαραίτητο)" : ""}`);

  // Kept separate from `facts` on purpose — these are the content brief
  // (source-priority tier 2), never the structured source of truth (tier 1).
  const brief: string[] = [];
  if (input.description) {
    brief.push(`Υπάρχουσα περιγραφή ${forCategory ? "κατηγορίας" : "προϊόντος"}: ${input.description}`);
  }
  if (input.adminNotes) brief.push(`Σημειώσεις διαχειριστή: ${input.adminNotes}`);

  const descriptions = fieldDescriptions(subject);
  const wanted = fields.map((f) => `- ${f}: ${descriptions[f]}`).join("\n");

  const sections = [
    `ΔΟΜΗΜΕΝΑ ΣΤΟΙΧΕΙΑ ${forCategory ? "ΚΑΤΗΓΟΡΙΑΣ" : "ΠΡΟΪΟΝΤΟΣ"} (πηγή αλήθειας):\n${facts.map((f) => `- ${f}`).join("\n")}`,
  ];
  if (brief.length > 0) {
    sections.push(
      `ΠΕΡΙΓΡΑΦΗ / ΣΗΜΕΙΩΣΕΙΣ ΔΙΑΧΕΙΡΙΣΤΗ (content brief — χρησιμοποίησέ τες για όρους και χαρακτηριστικά που δεν έρχονται σε αντίθεση με τα παραπάνω δομημένα στοιχεία· ΜΗΝ τις αντιγράψεις αυτούσιες):\n${brief.map((f) => `- ${f}`).join("\n")}`
    );
  }
  sections.push(`Δημιούργησε ΜΟΝΟ τα παρακάτω πεδία, σύμφωνα με το json schema:\n${wanted}`);

  return sections.join("\n\n");
}

function buildResponseSchema(fields: SeoField[], subject: SeoSubjectType) {
  const descriptions = fieldDescriptions(subject);
  const properties: Record<string, { type: string; description: string }> = {};
  for (const f of fields) properties[f] = { type: "string", description: descriptions[f] };
  return { type: "OBJECT", properties, required: fields };
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
};

export class GeminiProvider implements AIProvider {
  async generateSeoContent(input: SeoGenerationInput, fields: SeoField[] = ALL_FIELDS): Promise<SeoGenerationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AIProviderError("Gemini API key not configured", "not_configured");

    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const subject = input.subjectType ?? "product";
    const prompt = buildUserPrompt(input, fields);

    const endpoint = `${API_BASE}/${model}:generateContent`;

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt(subject) }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: buildResponseSchema(fields, subject),
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
