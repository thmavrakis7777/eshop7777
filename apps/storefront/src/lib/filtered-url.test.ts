import { describe, expect, it } from "vitest";
import { categoryListingUrl, categoryPathOf } from "./filtered-url";

describe("categoryListingUrl", () => {
  it("sends any query to the uncached /filtra copy, so the client router fetches it", () => {
    expect(categoryListingUrl("/ygraerio", "sale=1")).toBe("/filtra/ygraerio?sale=1");
    expect(categoryListingUrl("/ygraerio/kamineta-ygraeriou", new URLSearchParams("sort=price-asc"))).toBe(
      "/filtra/ygraerio/kamineta-ygraeriou?sort=price-asc"
    );
  });

  it("keeps the plain cached URL when there is no query", () => {
    expect(categoryListingUrl("/ygraerio", new URLSearchParams())).toBe("/ygraerio");
  });
});

describe("categoryPathOf", () => {
  it("strips /filtra and leaves a plain path alone", () => {
    expect(categoryPathOf("/filtra/ygraerio/kamineta-ygraeriou")).toBe("/ygraerio/kamineta-ygraeriou");
    expect(categoryPathOf("/ygraerio")).toBe("/ygraerio");
    expect(categoryPathOf("/filtrakia")).toBe("/filtrakia");
  });
});
