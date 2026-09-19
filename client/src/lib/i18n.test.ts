import { describe, expect, it } from "vitest";
import { localeFromLanguages, localePath } from "./i18n";

describe("locale selection", () => {
  it("resolves browser locale and isolates /en localized paths", () => {
    // Turkish & Azerbaijani fallback
    expect(localeFromLanguages(["tr-TR"])).toBe("tr");
    expect(localeFromLanguages(["az-Latn-AZ", "en-US"])).toBe("tr");

    // English & other language routing
    expect(localeFromLanguages(["en-US", "de-DE"])).toBe("en");
    expect(localePath("en")).toBe("/en");
    expect(localePath("en", "/accessibility")).toBe("/en/accessibility");
    expect(localePath("tr", "/accessibility")).toBe("/accessibility");
  });
});
