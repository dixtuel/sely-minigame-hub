import { describe, expect, it } from "vitest";
import { getProtectedContactLabel, getPublicContactEmail, getPublicOperatorName } from "./contact";

describe("public identity", () => {
  it("provides valid plain-text contact values to the protected presentation", () => {
    expect(getPublicContactEmail()).toMatch(/^[^\s@]+@[^\s@]+$/);
    expect(getPublicOperatorName()).toMatch(/^\S+(?:\s+\S+)+$/);
  });

  it("uses generic accessible labels instead of exposing the configured email address", () => {
    expect(getProtectedContactLabel("tr")).toBe("E-posta ile iletişim");
    expect(getProtectedContactLabel("en")).toBe("Open email contact");
    expect(getProtectedContactLabel("en")).not.toContain("@");
  });
});
