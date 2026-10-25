import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSitePath,
  lastShoppingPage,
  markScrollRestore,
  rememberShoppingPage,
  rememberShoppingPosition,
  takeScrollRestore,
} from "./last-shopping-page";

describe("last shopping page", () => {
  beforeEach(() => {
    const fakeStorage = () => {
      const store = new Map<string, string>();
      return {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      };
    };
    vi.stubGlobal("localStorage", fakeStorage());
    vi.stubGlobal("sessionStorage", fakeStorage());
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

  it("restores the saved position once, and only when «Συνέχεια αγορών» opened the page", () => {
    const url = "/filtra/ygraerio?sale=1";
    rememberShoppingPage(url);
    rememberShoppingPosition(url, { y: 1840, anchor: { href: "/proionta/kamineto-ygraerioy-plastiko", top: 210 } });
    // A plain visit: no mark, no restore.
    expect(takeScrollRestore(url)).toBeNull();
    markScrollRestore(url);
    expect(takeScrollRestore(url)).toEqual({ y: 1840, anchor: { href: "/proionta/kamineto-ygraerioy-plastiko", top: 210 } });
    expect(takeScrollRestore(url)).toBeNull();
  });

  it("keeps the position when the same page is remembered again, drops it for a new page", () => {
    rememberShoppingPage("/ygraerio");
    rememberShoppingPosition("/ygraerio", { y: 900 });
    rememberShoppingPage("/ygraerio");
    markScrollRestore("/ygraerio");
    expect(takeScrollRestore("/ygraerio")).toEqual({ y: 900 });

    rememberShoppingPage("/proionta/kamineto-ygraerioy-plastiko");
    rememberShoppingPosition("/ygraerio", { y: 500 }); // a late save for the old page is ignored
    markScrollRestore("/proionta/kamineto-ygraerioy-plastiko");
    expect(takeScrollRestore("/proionta/kamineto-ygraerioy-plastiko")).toBeNull();
    expect(lastShoppingPage()).toBe("/proionta/kamineto-ygraerioy-plastiko");
  });
});
