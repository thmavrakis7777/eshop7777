import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSitePath, lastShoppingPage, rememberShoppingPage } from "./last-shopping-page";

describe("last shopping page", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("returns the remembered page, filters and all", () => {
    rememberShoppingPage("/filtra/ygraerio?sale=1&cat=kamineta-ygraeriou");
    expect(lastShoppingPage()).toBe("/filtra/ygraerio?sale=1&cat=kamineta-ygraeriou");
  });

  it("goes home when nothing is stored", () => {
    expect(lastShoppingPage()).toBe("/");
  });

  it("goes home after 30 days", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"));
    rememberShoppingPage("/proionta/kamineto-ygraerioy-plastiko");
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    expect(lastShoppingPage()).toBe("/");
  });

  it("never stores or returns another site", () => {
    rememberShoppingPage("//evil.example/x");
    expect(lastShoppingPage()).toBe("/");
    localStorage.setItem("mh:last-shopping-page", JSON.stringify({ url: "https://evil.example", at: Date.now() }));
    expect(lastShoppingPage()).toBe("/");
    expect(isSitePath("/\\evil.example")).toBe(false);
    expect(isSitePath("/ygraerio")).toBe(true);
  });
});
