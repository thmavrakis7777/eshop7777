import { describe, expect, it } from "vitest";
import { photosPrimaryFirst, primaryPhotoUrl } from "@/lib/product-photos";
import type { ProductVariant } from "@/lib/types";

function colour(id: string, isAvailable: boolean, imageUrl?: string): ProductVariant {
  return { id, swatchHex: "#000000", isAvailable, imageUrl } as unknown as ProductVariant;
}

describe("primaryPhotoUrl", () => {
  it("is the first photo of a product without colours", () => {
    expect(primaryPhotoUrl({ imageUrl: "main.webp", variants: [] })).toBe("main.webp");
  });

  it("skips a sold-out colour, like the page does", () => {
    const variants = [colour("red", false, "red.webp"), colour("green", true, "green.webp")];
    expect(primaryPhotoUrl({ imageUrl: "red.webp", variants })).toBe("green.webp");
  });

  it("is the first colour when every colour is sold out", () => {
    const variants = [colour("red", false, "red.webp"), colour("green", false, "green.webp")];
    expect(primaryPhotoUrl({ imageUrl: "red.webp", variants })).toBe("red.webp");
  });

  it("falls back to the first photo when the colour has none of its own", () => {
    const variants = [colour("red", true), colour("green", true, "green.webp")];
    expect(primaryPhotoUrl({ imageUrl: "main.webp", variants })).toBe("main.webp");
  });

  it("is nothing for a product with no photo", () => {
    expect(primaryPhotoUrl({ imageUrl: null, variants: [] })).toBeNull();
  });
});

describe("photosPrimaryFirst", () => {
  it("moves the main photo first and keeps the others in order", () => {
    expect(photosPrimaryFirst(["red", "green", "orange", "blue"], "green")).toEqual(["green", "red", "orange", "blue"]);
  });

  it("drops and adds nothing", () => {
    expect(photosPrimaryFirst(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(photosPrimaryFirst(["a", "b"], "elsewhere")).toEqual(["a", "b"]);
    expect(photosPrimaryFirst(["a", "b"], null)).toEqual(["a", "b"]);
  });
});
