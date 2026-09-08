import { describe, it, expect } from "vitest";
import { sniffImageType } from "@/lib/storage/upload";

/**
 * The signature table in sniffImageType is exactly the kind of code that is
 * both trivial to get wrong (one transposed hex byte silently rejects an
 * entire format) and invisible when wrong — a broken PNG constant looks like
 * "uploads are failing", not like a typo. These tests are the cheap check
 * that every allowed format is genuinely recognised and that the payloads the
 * sniffer exists to stop are genuinely refused.
 */

const bytes = (...b: number[]) => new Uint8Array(b);

/** Real leading bytes for each allowed format. */
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
const GIF87A = bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00);
const GIF89A = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00);
// "RIFF" + 4 length bytes + "WEBP".
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);

/** Turns an ASCII string into the leading bytes a file of it would have. */
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("sniffImageType", () => {
  it("recognises every format the upload allowlist accepts", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(GIF87A)).toBe("image/gif");
    expect(sniffImageType(GIF89A)).toBe("image/gif");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("rejects the payloads a declared-type-only check would have let through", () => {
    // The actual attack: a script wearing an image/* label. Before the
    // signature check these reached Storage and were served back under the
    // Content-Type the client claimed.
    expect(sniffImageType(ascii("<script>alert(1)</script>"))).toBeNull();
    expect(sniffImageType(ascii('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffImageType(ascii("<!DOCTYPE html><html><body>"))).toBeNull();
    // A PDF and a ZIP are both real binary formats, and both still not images.
    expect(sniffImageType(ascii("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0))).toBeNull();
  });

  it("does not mistake a near-miss signature for the real thing", () => {
    // RIFF, but a WAV rather than a WebP — the form type at bytes 8–11 is
    // the only thing separating them, so this is the case that proves those
    // four bytes are actually being checked.
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45))).toBeNull();
    // "GIF8" followed by neither 7a nor 9a.
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x35, 0x61, 0, 0, 0, 0, 0, 0))).toBeNull();
    // PNG signature with one byte wrong — the exact typo this test exists for.
    expect(sniffImageType(bytes(0x89, 0x50, 0x47, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0))).toBeNull();
  });

  it("never throws or false-positives on input shorter than a signature", () => {
    // uploadImage slices only the first 12 bytes, so a 2-byte file reaches
    // here as a 2-byte array. Every signature check must bounds-check rather
    // than read past the end and compare against undefined.
    expect(sniffImageType(bytes())).toBeNull();
    expect(sniffImageType(bytes(0xff))).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39))).toBeNull();
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00))).toBeNull();
  });
});
