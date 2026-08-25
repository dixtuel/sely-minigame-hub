import { describe, expect, it } from "vitest";
import { localeFromLanguages, localePath } from "./i18n";

describe("locale selection", () => {
  it("keeps Turkish and Azerbaijani browser languages on the Turkish route", () => {
    expect(localeFromLanguages(["tr-TR"])).toBe("tr");
    expect(localeFromLanguages(["az-Latn-AZ", "en-US"])).toBe("tr");
  });

  it("routes other browser-language lists to English and keeps `/en` paths isolated", () => {
    expect(localeFromLanguages(["en-US", "de-DE"])).toBe("en");
    expect(localePath("en")).toBe("/en");
    expect(localePath("en", "/accessibility")).toBe("/en/accessibility");
    expect(localePath("tr", "/accessibility")).toBe("/accessibility");
  });
});
