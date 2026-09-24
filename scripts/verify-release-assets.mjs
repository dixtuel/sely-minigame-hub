import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = resolve(root, "scripts/release-assets.list");
const manifest = (await readFile(manifestPath, "utf8"))
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith("#"));
const sourceFiles = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(?:[cm]?[jt]sx?|html|css)$/i.test(entry.name))
      sourceFiles.push(path);
  }
}

await walk(resolve(root, "client/src"));
sourceFiles.push(resolve(root, "client/index.html"));

const referenced = new Set();
for (const file of sourceFiles) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(
    /\/storage\/([\w.-]+\.(?:png|jpe?g|webp|avif))/gi
  )) {
    referenced.add(`client/public/storage/${match[1]}`);
  }
}

const allowed = new Set(manifest);
const missingFromManifest = [...referenced].filter(path => !allowed.has(path));
const unreferencedInManifest = manifest.filter(path => !referenced.has(path));
const ignoreExceptions = [];
for (const name of [".gitignore", ".dockerignore"]) {
  const text = await readFile(resolve(root, name), "utf8");
  const exceptions = new Set(
    [...text.matchAll(/^!(client\/public\/storage\/[^/\s]+)$/gm)].map(
      match => match[1]
    )
  );
  const mismatches = [
    ...manifest.filter(path => !exceptions.has(path)),
    ...[...exceptions].filter(path => !allowed.has(path)),
  ];
  if (mismatches.length) {
    ignoreExceptions.push(
      `${name} allowlist differs: ${[...new Set(mismatches)].join(", ")}`
    );
  }
}
const missingFiles = [];
for (const path of manifest) {
  try {
    if (!(await stat(resolve(root, path))).isFile()) missingFiles.push(path);
  } catch {
    missingFiles.push(path);
  }
}

const findings = [
  ...missingFromManifest.map(
    path => `runtime reference is not allowlisted: ${path}`
  ),
  ...unreferencedInManifest.map(
    path => `allowlisted artwork is not referenced: ${path}`
  ),
  ...ignoreExceptions,
  ...missingFiles.map(path => `allowlisted file is missing: ${path}`),
];

if (findings.length) {
  console.error(
    `Release asset verification failed:\n${findings.map(item => `- ${item}`).join("\n")}`
  );
  process.exitCode = 1;
} else {
  console.log(
    `Release asset verification passed (${manifest.length} referenced public images).`
  );
}
