import { describe, it, expect } from "vitest";
import { isSafeRedirectPath } from "./checkout-validation";

// QA-013: a logged-out deep link (e.g. /logariasmos/parangelies) must
// redirect through login and land back on that same page — but the
// `?redirectTo=` query param that carries the destination is attacker
// reachable (a crafted /logariasmos/eisodos?redirectTo=... link), so it must
// never be handed to redirect()/router.push() unvalidated.
describe("isSafeRedirectPath", () => {
  it("accepts a plain internal path", () => {
    expect(isSafeRedirectPath("/logariasmos/parangelies")).toBe(true);
  });

  it("accepts an internal path with a query string", () => {
    expect(isSafeRedirectPath("/logariasmos/parangelies?page=2")).toBe(true);
  });

  it("accepts the root path", () => {
    expect(isSafeRedirectPath("/")).toBe(true);
  });

  it("rejects an absolute http(s) URL", () => {
    expect(isSafeRedirectPath("https://evil.example.com")).toBe(false);
    expect(isSafeRedirectPath("http://evil.example.com")).toBe(false);
  });

  it("rejects a protocol-relative URL — starts with '/' but browsers resolve it cross-origin", () => {
    expect(isSafeRedirectPath("//evil.example.com")).toBe(false);
  });

  it("rejects a path with no leading slash", () => {
    expect(isSafeRedirectPath("logariasmos")).toBe(false);
  });

  it("rejects a javascript: URL", () => {
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
  });

  it("rejects empty, null and undefined", () => {
    expect(isSafeRedirectPath("")).toBe(false);
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
  });
});
