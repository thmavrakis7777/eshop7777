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

/**
 * Gemini answers 503 ("This model is currently experiencing high demand")
 * or 429 during short load spikes on Google's side — confirmed live
 * 2026-09-28: three category generations failed in one afternoon, all 503
 * UNAVAILABLE, nothing wrong with the key, model or request. Those spikes
 * usually clear within seconds, so the exact same request is sent again up
 * to twice (after ~1s, then ~3s) before the admin sees an error. Every other
 * failure (400, 401/403, 404 for a retired model, network errors) still
 * fails on the first attempt exactly as before — retrying those would only
 * delay the same answer.
 */
const RETRYABLE_STATUSES = new Set([429, 503]);
const RETRY_DELAYS_MS = [1000, 3000];

/**
 * Time limits. During the same overload each 503 took 7–24 s to arrive, so
 * three tries kept the admin waiting ~48 s before the overload message. Now
 * a try Google hasn't answered within PER_TRY_MS is abandoned — that is
 * overload too, so it ends with the same "unavailable" message, and it is
 * NOT retried (only an actual 429/503 answer is) — and the whole call,
 * waits included, stays within TOTAL_MS: a retry only starts if at least
 * MIN_TRY_MS of the budget would be left for it.
 *
 * 20 s rather than a tighter 15 s: no successful generation's duration had
 * ever been measured (Google was overloaded the whole afternoon this was
 * written), and a limit shorter than a slow-but-successful answer would
 * break the button instead of fixing it. logGeminiSuccess records real
 * durations so these can be tightened from data.
 */
const PER_TRY_MS = 20_000;
const TOTAL_MS = 30_000;
const MIN_TRY_MS = 8_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// fetch rejects with a DOMException named "TimeoutError" when
// AbortSignal.timeout fires ("AbortError" on some runtimes).
const isTimeout = (err: unknown) =>
  typeof err === "object" && err !== null && ["TimeoutError", "AbortError"].includes((err as { name?: string }).name ?? "");

/**
 * Server-side-only diagnostic logging for a failed Gemini call. Deliberately
 * the only thing this change does — no prompt, model, endpoint, rate-limit,
 * or save-path logic is touched. Without this, a failure's real cause (HTTP
 * status, Gemini's own error body, or the actual network error) was
 * discarded the moment it was wrapped into the generic AIProviderError the
 * UI shows — confirmed live: a real production failure produced zero
 * matching entries in Vercel's runtime logs at any level, because nothing
 * here ever called console.error. This exact gap already cost one prior
 * debugging pass (see git history: temporary console.log added, root-caused
 * as model retirement, then removed) — this is the permanent version of
 * that, not a one-off.
 *
 * Never logs: the API key, request headers, cookies, or any prompt/product/
 * category content (title, description, admin notes) — only operational
 * metadata plus Gemini's own response, truncated.
 */
function logGeminiFailure(details: {
  kind: "network" | "http_error" | "timeout";
  model: string;
  requestType: string;
  attempt: number;
  status?: number;
  errorBody?: string;
  errorName?: string;
  errorMessage?: string;
}) {
  console.error("[gemini] request failed", {
    timestamp: new Date().toISOString(),
    ...details,
  });
}

/** Same privacy rules as logGeminiFailure — how long a good answer took, nothing else. */
function logGeminiSuccess(details: { model: string; requestType: string; attempt: number; ms: number }) {
  console.info("[gemini] ok", details);
}

export class GeminiProvider implements AIProvider {
  async generateSeoContent(input: SeoGenerationInput, fields: SeoField[] = ALL_FIELDS): Promise<SeoGenerationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AIProviderError("Gemini API key not configured", "not_configured");

    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const subject = input.subjectType ?? "product";
    // "category:description,seoTitle,metaDescription" / "product:description,seoTitle,...,imageAlt" —
    // which surface called this and which fields it asked for, nothing else.
    const requestType = `${subject}:${fields.join(",")}`;
    const prompt = buildUserPrompt(input, fields);

    const endpoint = `${API_BASE}/${model}:generateContent`;

    // Built once — a retry resends exactly this request, never a changed one.
    const request: RequestInit = {
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
    };

    const started = Date.now();
    const timedOut = (attempt: number, err: unknown) => {
      logGeminiFailure({ kind: "timeout", model, requestType, attempt, errorName: (err as { name?: string }).name });
      return new AIProviderError(`Gemini did not answer within the time limit (attempt ${attempt})`, "unavailable");
    };

    let res: Response;
    let attempt = 1;
    for (; ; attempt++) {
      try {
        // The same signal also bounds reading the response body below.
        const remaining = TOTAL_MS - (Date.now() - started);
        res = await fetch(endpoint, { ...request, signal: AbortSignal.timeout(Math.min(PER_TRY_MS, remaining)) });
      } catch (err) {
        if (isTimeout(err)) throw timedOut(attempt, err);
        logGeminiFailure({
          kind: "network",
          model,
          requestType,
          attempt,
          errorName: err instanceof Error ? err.name : typeof err,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        throw new AIProviderError(`Gemini request failed: ${String(err)}`, "request_failed");
      }

      if (res.ok) break;

      const body = await res.text().catch(() => "");
      logGeminiFailure({
        kind: "http_error",
        model,
        requestType,
        attempt,
        status: res.status,
        errorBody: body.slice(0, 500),
      });
      if (!RETRYABLE_STATUSES.has(res.status)) {
        throw new AIProviderError(`Gemini returned ${res.status}: ${body.slice(0, 300)}`, "request_failed");
      }
      const delay = RETRY_DELAYS_MS[attempt - 1];
      const leftForNextTry = TOTAL_MS - (Date.now() - started) - (delay ?? 0);
      if (delay === undefined || leftForNextTry < MIN_TRY_MS) {
        throw new AIProviderError(
          `Gemini returned ${res.status} after ${attempt} attempts: ${body.slice(0, 300)}`,
          "unavailable"
        );
      }
      await sleep(delay);
    }

    let data: GeminiResponse;
    try {
      data = await res.json();
    } catch (err) {
      if (isTimeout(err)) throw timedOut(attempt, err);
      throw new AIProviderError("Gemini returned malformed JSON", "invalid_response");
    }
    logGeminiSuccess({ model, requestType, attempt, ms: Date.now() - started });
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
