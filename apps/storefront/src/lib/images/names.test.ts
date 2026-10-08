import { describe, it, expect } from "vitest";
import { imageVariant, optimizedStem, randomNamePart } from "@/lib/images/names";

/**
 * The storefront offers an AVIF (and the Meta feed a JPEG) for an image only
 * because its name says the pipeline made one — so a name rule that matched
 * an older upload or a pasted URL would point visitors at a missing file.
 * These pin the rule from both sides.
 */

const BUCKET = "https://tuvbesrqizixqrunvlnt.supabase.co/storage/v1/object/public/product-images";

describe("optimizedStem", () => {
  it("names the file after the label in Latin letters", () => {
    expect(optimizedStem("Είδη Υγραερίου", "abcdefghij")).toBe("eidi-ygraerioy.abcdefghij");
  });

  it("drops a file extension and keeps only safe characters", () => {
    expect(optimizedStem("IMG_1234.JPG", "abcdefghij")).toBe("img-1234.abcdefghij");
    expect(optimizedStem("../../etc/passwd", "abcdefghij")).toBe("etc-passwd.abcdefghij");
  });

  it("falls back to a generic name when nothing readable is left", () => {
    expect(optimizedStem("—!!—", "abcdefghij")).toBe("eikona.abcdefghij");
  });

  it("caps the readable part at 60 characters", () => {
    const stem = optimizedStem("α".repeat(200), "abcdefghij");
    expect(stem.split(".")[0].length).toBeLessThanOrEqual(60);
  });

  it("uses a fresh 10-character random part by default", () => {
    const part = randomNamePart();
    expect(part).toMatch(/^[a-z0-9]{10}$/);
    expect(randomNamePart()).not.toBe(part);
  });
});

describe("imageVariant", () => {
  const path = "homepage/eidi-ygraerioy.k3j9x2m1qz.webp";

  it("finds the AVIF and JPEG beside a pipeline WebP, path or full URL", () => {
    expect(imageVariant(path, "avif")).toBe("homepage/eidi-ygraerioy.k3j9x2m1qz.avif");
    expect(imageVariant(`${BUCKET}/${path}`, "avif")).toBe(`${BUCKET}/homepage/eidi-ygraerioy.k3j9x2m1qz.avif`);
    expect(imageVariant(`products/kamineto.a1b2c3d4e5.webp`, "jpg")).toBe("products/kamineto.a1b2c3d4e5.jpg");
  });

  it("never invents a variant for images the pipeline didn't make", () => {
    // Uploads from before the pipeline: UUID names, any format.
    expect(imageVariant("homepage/550a132e-3d47-4242-bd29-906aba4438b9.webp", "avif")).toBeNull();
    expect(imageVariant(`${BUCKET}/homepage/326a8628-8cdd-4f1e-b967-c85aa0abeb8a.jpg`, "avif")).toBeNull();
    // A pasted image from another site that happens to look alike.
    expect(imageVariant(`https://example.com/x/${path}`, "avif")).toBeNull();
    // Only the main WebP has variants; a GIF is stored alone.
    expect(imageVariant("homepage/eidi-ygraerioy.k3j9x2m1qz.avif", "avif")).toBeNull();
    expect(imageVariant("homepage/banner.k3j9x2m1qz.gif", "avif")).toBeNull();
    expect(imageVariant(null, "avif")).toBeNull();
    expect(imageVariant("", "avif")).toBeNull();
  });
});
