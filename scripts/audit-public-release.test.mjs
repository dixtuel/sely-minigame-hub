import { describe, expect, it } from "vitest";
import { containsPrivateIdentity, decodeCharacterArrays, decodeEscapedText, isMetadataAttribution, stripApprovedPublicIdentity } from "./audit-public-release.mjs";

describe("public release audit decoders", () => {
  it("decodes common JavaScript and HTML character escapes", () => {
    expect(decodeEscapedText("\\u0053\\x45&#76;&#x59;")).toBe("SELY");
  });

  it("recognizes numeric character arrays without accepting unrelated arrays", () => {
    expect(decodeCharacterArrays("const label = [83, 69, 76, 89];")).toContain("SELY");
    expect(decodeCharacterArrays("const values = [1, 2];")).toEqual([]);
    const syntheticName = "Ada Lovelace";
    const encoded = Array.from(syntheticName, character => character.codePointAt(0)).join(", ");
    expect(containsPrivateIdentity(`const display = [${encoded}];`, [], [syntheticName])).toBe("plaintext or encoded personal name");
  });

  it("matches assembled private markers in decoded content", () => {
    expect(containsPrivateIdentity("contact: private@example.invalid", ["private@example.invalid"], [])).toBe("real contact address");
    expect(containsPrivateIdentity("operator: Ada Lovelace", [], ["Ada Lovelace"])).toBe("plaintext or encoded personal name");
    expect(containsPrivateIdentity("operator: Generic Maintainer", [], ["Ada Lovelace"])).toBeUndefined();
  });

  it("limits the identity exception to project metadata and attribution files", () => {
    expect(isMetadataAttribution("SECURITY.md")).toBe(true);
    expect(isMetadataAttribution("README.md")).toBe(true);
    expect(isMetadataAttribution("client/src/wasm/package.json")).toBe(true);
    expect(isMetadataAttribution("client/src/lib/contact.ts")).toBe(false);
  });

  it("allows one explicit public identity definition only in its designated source file", () => {
    const email = "public@example.invalid";
    const name = "Ada Lovelace";
    const allowed = stripApprovedPublicIdentity(
      "client/src/lib/contact.ts",
      `const email = "${email}"; const name = "${name}";`,
      [email],
      [name],
    );
    expect(containsPrivateIdentity(allowed, [email], [name])).toBeUndefined();

    const copiedElsewhere = stripApprovedPublicIdentity(
      "client/src/components/ProtectedIdentity.tsx",
      `aria-label="${email}"`,
      [email],
      [name],
    );
    expect(containsPrivateIdentity(copiedElsewhere, [email], [name])).toBe("real contact address");

    const duplicate = stripApprovedPublicIdentity(
      "client/src/lib/contact.ts",
      `const email = "${email}"; const backup = "${email}";`,
      [email],
      [name],
    );
    expect(containsPrivateIdentity(duplicate, [email], [name])).toBe("real contact address");
  });
});
