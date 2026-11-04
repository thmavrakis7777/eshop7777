import { describe, expect, it } from "vitest";
import { mediaKey, referencedKeys } from "./media-paths";

describe("mediaKey", () => {
  it("groups an upload's WebP, AVIF and JPEG under one key", () => {
    const stem = "products/etazera-metalliki.1oudh46jr0";
    expect(mediaKey(`${stem}.webp`)).toBe(stem);
    expect(mediaKey(`${stem}.avif`)).toBe(stem);
    expect(mediaKey(`${stem}.jpg`)).toBe(stem);
  });

  it("keeps the random part and ignores a leading slash", () => {
    expect(mediaKey("/categories/banio.ab12cd34.webp")).toBe("categories/banio.ab12cd34");
  });
});

describe("referencedKeys", () => {
  it("reads a bare stored path", () => {
    expect(referencedKeys("products/etazera.1oudh46jr0.webp")).toEqual(["products/etazera.1oudh46jr0"]);
  });

  it("reads the bucket path out of a full public URL", () => {
    const url =
      "https://x.supabase.co/storage/v1/object/public/product-images/homepage/hero.k3j4h5g6.avif";
    expect(referencedKeys(url)).toEqual(["homepage/hero.k3j4h5g6"]);
  });

  it("finds every image inside an article body or a JSON config", () => {
    const body = `Δείτε ![σόμπα](journal/somba.aaaaaa11.webp) και <img src="journal/fiali.bbbbbb22.jpg">.`;
    expect(referencedKeys(body)).toEqual(["journal/somba.aaaaaa11", "journal/fiali.bbbbbb22"]);
    expect(referencedKeys(JSON.stringify({ image: "homepage/x.cccccc33.webp" }))).toEqual(["homepage/x.cccccc33"]);
  });

  it("returns nothing for empty text or text without images", () => {
    expect(referencedKeys(null)).toEqual([]);
    expect(referencedKeys("/kouzina/tigania")).toEqual([]);
  });
});
