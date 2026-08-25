import { readdir, readFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoots = ["client", "server", "shared", "drizzle", "db"];
const ignoredDirectories = new Set(["node_modules", "dist", ".git", "prod-overlay.example"]);
const forbiddenFile = /^(google.+\.html|BingSiteAuth\.xml|yandex_.+\.html)$/i;
const forbiddenLiteral = /asrinklcc@dixtuel\.tr/i;
const forbiddenIdentityBinding = /["'](?:@id|sameAs|creator|author)["']\s*:/;
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) { await walk(fullPath); continue; }
    const pathFromRoot = relative(root, fullPath).split(sep).join("/");
    if (forbiddenFile.test(entry.name)) findings.push(`${pathFromRoot}: search verification file`);
    if (/\.(?:ts|tsx|js|mjs|json|html|xml|txt|css)$/i.test(entry.name)) {
      const content = await readFile(fullPath, "utf8");
      if (forbiddenLiteral.test(content)) findings.push(`${pathFromRoot}: real contact address`);
      if (forbiddenIdentityBinding.test(content)) findings.push(`${pathFromRoot}: structured identity binding`);
    }
  }
}

for (const sourceRoot of sourceRoots) await walk(resolve(root, sourceRoot));
if (findings.length) {
  console.error("Public release audit failed:\n" + findings.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Public release audit passed: no prohibited identity or verification artifacts found.");
