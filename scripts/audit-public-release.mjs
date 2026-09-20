import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoots = ["client", "server", "shared"];
const ignoredDirectories = new Set(["node_modules", "dist", ".git"]);
const forbiddenFile = /^(google.+\.html|BingSiteAuth\.xml|yandex_.+\.html)$/i;
const forbiddenLiteral = /asrinklcc@(?:dixtuel|sely)\.tr/i;
const forbiddenName = /Asr[ıi]n\s+K[ıi]l[ıi][çc]/i;
// Structured identity binding (schema.org/JSON-LD sameAs, @id, creator, author key) is what
// actually links this repo's real-world identity to search engines from user-facing pages —
// forbidden there, but a plain npm "author" field in a package manifest is normal attribution,
// not identity binding, so manifests are exempted below just like the name/email checks.
const forbiddenIdentityBinding = /["'](?:@id|sameAs|creator|author)["']\s*:/;
// Ordinary open-source attribution (package manifests, license, readme) is expected to name
// a real maintainer and is NOT a leak by itself — only Terms/Privacy/legal-facing content and
// other user-facing surfaces are checked for the real name/email/identity binding.
const attributionFile = /^(package\.json|LICENSE(?:\.md)?|README(?:\.md)?)$/i;
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) { await walk(fullPath); continue; }
    const pathFromRoot = relative(root, fullPath).split(sep).join("/");
    if (forbiddenFile.test(entry.name)) findings.push(`${pathFromRoot}: search verification file`);
    if (/\.(?:ts|tsx|js|mjs|json|html|xml|txt|css|md)$/i.test(entry.name)) {
      const content = await readFile(fullPath, "utf8");
      const isAttributionFile = attributionFile.test(entry.name);
      if (!isAttributionFile && forbiddenLiteral.test(content)) findings.push(`${pathFromRoot}: real contact address`);
      if (!isAttributionFile && forbiddenName.test(content)) findings.push(`${pathFromRoot}: plaintext personal name`);
      if (!isAttributionFile && forbiddenIdentityBinding.test(content)) findings.push(`${pathFromRoot}: structured identity binding`);
    }
  }
}

for (const sourceRoot of sourceRoots) await walk(resolve(root, sourceRoot));
if (findings.length) {
  console.error("Public release audit failed:\n" + findings.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Public release audit passed: no prohibited identity or verification artifacts found.");
