import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { optimizeImage } from "@/lib/images/optimize";
import { IMAGE_SLOTS, storedSize } from "@/lib/images/slots";

/**
 * The pipeline's promises, checked on generated images (no fixtures, no
 * network): the slot's size and formats, nothing enlarged or cropped, no
 * phone metadata left in what visitors download, bytes kept when re-encoding
 * would only lose detail, and an honest "over budget" instead of a smeared
 * photo.
 */

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } } });

// Random pixels: as detailed as an image gets, so no budget can be met.
const noise = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#808080", noise: { type: "gaussian", mean: 128, sigma: 60 } } });

describe("optimizeImage", { timeout: 60_000 }, () => {
  it("shrinks a large photo only until it still covers the slot, in the slot's formats", async () => {
    const input = await photo(3000, 2000).jpeg().toBuffer();
    const out = await optimizeImage(input, "promo");
    // Covers the 1200×1200 box: height 1200, width in proportion — the
    // square crop the site shows keeps 1200 real pixels each way.
    expect([out.width, out.height]).toEqual([1800, 1200]);
    expect(out.files.map((f) => f.format)).toEqual(["webp", "avif"]);
    expect((await sharp(out.files[0].data).metadata()).format).toBe("webp");
    expect((await sharp(out.files[1].data).metadata()).format).toBe("heif");
    expect(out.overBudget).toBe(false);
  });

  it("keeps a portrait photo wide enough for a landscape box", async () => {
    // The live «ΠΡΟΣΦΟΡΕΣ» Hero: a 1280×1920 portrait shown as a 1425×512
    // strip on desktop. Fitting it *inside* 1920×1080 would leave 720 px of
    // width for that strip; covering the box keeps all 1280.
    const out = await optimizeImage(await photo(1280, 1920).jpeg().toBuffer(), "hero-desktop");
    expect([out.width, out.height]).toEqual([1280, 1920]);
  });

  it("caps the long side however extreme the shape", () => {
    expect(storedSize(IMAGE_SLOTS.promo, 9000, 1500)).toEqual({ width: 2560, height: 427 });
  });

  it("never enlarges a small image", async () => {
    const out = await optimizeImage(await photo(400, 300).png().toBuffer(), "hero-desktop");
    expect([out.width, out.height]).toEqual([400, 300]);
  });

  it("applies the phone's rotation, then drops EXIF and GPS", async () => {
    // Stored landscape with "rotate 90°" in EXIF — a portrait phone shot.
    // (sharp writes Orientation itself, from withMetadata; an Orientation
    // inside withExif is overwritten.)
    const input = await photo(1600, 1200)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "N" } })
      .toBuffer();
    expect((await sharp(input).metadata()).orientation).toBe(6);
    const out = await optimizeImage(input, "category");
    expect([out.width, out.height]).toEqual([1000, 1333]);
    for (const f of out.files) {
      const meta = await sharp(f.data).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
    }
  });

  it("keeps an already optimised WebP byte for byte, adding only the AVIF", async () => {
    // High quality, so a re-encode would come out smaller — kept anyway:
    // compressing it again would only lose detail.
    const input = await photo(800, 600).webp({ quality: 95 }).toBuffer();
    const out = await optimizeImage(input, "promo");
    expect(out.files[0].quality).toBeNull();
    expect(out.files[0].data.equals(input)).toBe(true);
    expect(out.files[1].format).toBe("avif");
  });

  it("re-encodes a WebP that carries metadata or needs shrinking", async () => {
    const withExif = await photo(800, 600).webp({ quality: 95 }).withExif({ IFD0: { Make: "Phone" } }).toBuffer();
    expect((await optimizeImage(withExif, "promo")).files[0].quality).toBe(82);
    const tooBig = await photo(3000, 3000).webp({ quality: 95 }).toBuffer();
    expect((await optimizeImage(tooBig, "promo")).files[0].quality).not.toBeNull();
  });

  it("stores product photos as WebP plus a JPEG copy for Meta, social images as JPEG only", async () => {
    const transparent = await sharp({
      create: { width: 600, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const product = await optimizeImage(transparent, "product");
    expect(product.files.map((f) => f.format)).toEqual(["webp", "jpg"]);
    // Transparency becomes white in the JPEG, not black.
    const { data } = await sharp(product.files[1].data).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240);

    const social = await optimizeImage(await photo(2400, 1260).png().toBuffer(), "journal-social");
    expect(social.files.map((f) => f.format)).toEqual(["jpg"]);
    expect([social.width, social.height]).toEqual([1200, 630]);
  });

  it("steps quality down for the budget, stops at the floor and says so", async () => {
    const slot = IMAGE_SLOTS["mega-menu"];
    const out = await optimizeImage(await noise(slot.width, slot.height).png().toBuffer(), "mega-menu");
    expect(out.overBudget).toBe(true);
    expect(out.files.find((f) => f.format === "webp")?.quality).toBe(70);
    expect(out.files.find((f) => f.format === "avif")?.quality).toBe(46);
  });
});
