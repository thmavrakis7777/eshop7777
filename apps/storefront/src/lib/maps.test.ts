import { describe, expect, it } from "vitest";
import { storeLocationJsonLd, storeMapsUrl } from "./maps";

describe("storeLocationJsonLd", () => {
  it("splits a readable address and adds the listing's pin and link", () => {
    expect(storeLocationJsonLd("ΣΦΑΚΙΑΝΑΚΗ 4, 71201, Ηράκλειο Κρήτης")).toEqual({
      address: {
        "@type": "PostalAddress",
        streetAddress: "ΣΦΑΚΙΑΝΑΚΗ 4",
        postalCode: "71201",
        addressLocality: "Ηράκλειο Κρήτης",
        addressCountry: "GR",
      },
      geo: { "@type": "GeoCoordinates", latitude: 35.3378602, longitude: 25.1302297 },
      hasMap: storeMapsUrl("ΣΦΑΚΙΑΝΑΚΗ 4, 71201, Ηράκλειο Κρήτης"),
    });
  });

  it("keeps an address it can't read as one line, line breaks joined", () => {
    expect(storeLocationJsonLd("Πλατεία Ελευθερίας\nΗράκλειο Κρήτης").address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Πλατεία Ελευθερίας, Ηράκλειο Κρήτης",
      addressCountry: "GR",
    });
  });

  it("drops address, pin and link together when no address is set", () => {
    expect(storeLocationJsonLd(null)).toEqual({});
    expect(storeLocationJsonLd("   ")).toEqual({});
  });
});
