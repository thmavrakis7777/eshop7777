import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiProvider } from "@/lib/ai/gemini-provider";
import { AIProviderError, type SeoGenerationInput } from "@/lib/ai/provider";

/**
 * The retry path only ever runs while Google is overloaded — exactly when
 * nobody is watching it — and both ways of getting it wrong are costly:
 * retrying the wrong statuses delays every real error (a bad key, a retired
 * model), and not retrying 429/503 is the bug this exists to fix. Fetch is
 * mocked; no real Gemini call is ever made.
 */

const INPUT: SeoGenerationInput = {
  title: "Ψεκαστήρες",
  description: null,
  sku: null,
  categoryName: "Κήπος",
  parentCategoryName: null,
  collectionTitles: [],
  material: null,
  weightGrams: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  originCountry: null,
  variantTitle: null,
  priceCents: null,
  adminNotes: null,
  existingSlug: "psekastires",
  isPublished: true,
  subjectType: "category",
};
const FIELDS = ["description", "seoTitle", "metaDescription"] as const;

const ok = () =>
  new Response(
    JSON.stringify({
      candidates: [
        { content: { parts: [{ text: JSON.stringify({ description: "d", seoTitle: "t", metaDescription: "m" }) }] } },
      ],
    }),
    { status: 200 }
  );
const fail = (status: number) => new Response(JSON.stringify({ error: { code: status } }), { status });

let fetchMock: ReturnType<typeof vi.fn>;

/** Each call answers with the next response in line (fresh objects — a body can only be read once). */
function answerWith(...responses: Array<() => Response>) {
  for (const r of responses) fetchMock.mockImplementationOnce(async () => r());
}

function generate() {
  return new GeminiProvider().generateSeoContent(INPUT, [...FIELDS]);
}

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  // Date too: the 30 s budget is measured with Date.now().
  vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("GeminiProvider retry on 429/503", () => {
  it("succeeds on the first attempt without waiting when Gemini answers 200", async () => {
    answerWith(ok);
    await expect(generate()).resolves.toMatchObject({ description: "d", seoTitle: "t", metaDescription: "m" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries after ~1s then ~3s and returns the result once Gemini recovers", async () => {
    answerWith(() => fail(503), () => fail(503), ok);
    const result = generate();

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2999);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(result).resolves.toMatchObject({ description: "d", seoTitle: "t", metaDescription: "m" });
  });

  it("retries a 429 the same way", async () => {
    answerWith(() => fail(429), ok);
    const result = generate();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toMatchObject({ seoTitle: "t" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("resends exactly the same request on every attempt", async () => {
    answerWith(() => fail(503), () => fail(503), ok);
    const result = generate();
    await vi.advanceTimersByTimeAsync(4000);
    await result;

    const [first, ...rest] = fetchMock.mock.calls as Array<[string, RequestInit]>;
    for (const [url, init] of rest) {
      expect(url).toBe(first[0]);
      expect(init.body).toBe(first[1].body);
    }
  });

  it("gives up after 2 retries (3 attempts total) with the 'unavailable' code", async () => {
    answerWith(() => fail(503), () => fail(503), () => fail(503));
    const result = generate();
    const assertion = expect(result).rejects.toSatisfy(
      (err) => err instanceof AIProviderError && err.code === "unavailable"
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([400, 401, 403, 404, 500])("does not retry a %i — fails at once as 'request_failed'", async (status) => {
    answerWith(() => fail(status));
    await expect(generate()).rejects.toSatisfy(
      (err) => err instanceof AIProviderError && err.code === "request_failed"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a network error", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(generate()).rejects.toSatisfy(
      (err) => err instanceof AIProviderError && err.code === "request_failed"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("GeminiProvider time limits", () => {
  it("gives every try a time limit", async () => {
    answerWith(ok);
    await generate();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("ends a try Google hasn't answered in time with 'unavailable', without retrying it", async () => {
    fetchMock.mockImplementationOnce(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    await expect(generate()).rejects.toSatisfy((err) => err instanceof AIProviderError && err.code === "unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't start a retry the 30 s budget has no room for", async () => {
    // The 503 arrives 23 s in: after the 1 s wait only 6 s would be left.
    fetchMock.mockImplementationOnce(async () => {
      vi.advanceTimersByTime(23_000);
      return fail(503);
    });
    await expect(generate()).rejects.toSatisfy((err) => err instanceof AIProviderError && err.code === "unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still retries a slow 503 when the budget has room", async () => {
    // 503 at 20 s: 30 − 20 − 1 = 9 s left, enough for another try.
    fetchMock.mockImplementationOnce(async () => {
      vi.advanceTimersByTime(20_000);
      return fail(503);
    });
    answerWith(ok);
    const result = generate();
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toMatchObject({ seoTitle: "t" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("logs how long a good answer took, and nothing about the content", async () => {
    answerWith(ok);
    await generate();
    expect(console.info).toHaveBeenCalledWith(
      "[gemini] ok",
      expect.objectContaining({ requestType: "category:description,seoTitle,metaDescription", attempt: 1 })
    );
    expect(JSON.stringify((console.info as ReturnType<typeof vi.fn>).mock.calls)).not.toContain("Ψεκαστήρες");
  });
});
