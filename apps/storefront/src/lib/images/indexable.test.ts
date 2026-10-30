// What next/image's getImageProps is built from; next/image itself needs React
// in a form this test environment doesn't load.
import { getImgProps } from "next/dist/shared/lib/get-img-props";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import defaultLoader from "next/dist/shared/lib/image-loader";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { indexableImageUrl } from "@/lib/images/indexable";
import { siteUrl } from "@/lib/site-config";

const PHOTO = "https://abc.supabase.co/storage/v1/object/public/product-images/products/kamineto.e5pdpql7lz.webp";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co\n");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("indexableImageUrl", () => {
  it("is the same URL next/image renders as the photo's src", () => {
    const { props } = getImgProps(
      { src: PHOTO, alt: "", fill: true, sizes: "50vw" },
      { defaultLoader, imgConf: imageConfigDefault }
    );
    expect(indexableImageUrl(PHOTO)).toBe(`${siteUrl}${props.src}`);
  });

  it("stays on this site, with the file's address encoded", () => {
    const url = new URL(indexableImageUrl(PHOTO));
    expect(url.origin).toBe(new URL(siteUrl).origin);
    expect(url.pathname).toBe("/_next/image");
    expect(url.searchParams.get("url")).toBe(PHOTO);
  });

  it("leaves alone what the optimizer would refuse", () => {
    for (const other of [
      "https://example.com/photo.webp",
      "https://abc.supabase.co/storage/v1/object/sign/product-images/a.webp",
      "not a url",
    ]) {
      expect(indexableImageUrl(other)).toBe(other);
    }
  });

  it("leaves the URL alone when storage isn't configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(indexableImageUrl(PHOTO)).toBe(PHOTO);
  });
});
