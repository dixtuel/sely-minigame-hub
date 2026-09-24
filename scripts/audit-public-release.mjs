import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const forbiddenFile = /^(google.+\.html|BingSiteAuth\.xml|yandex_.+\.html)$/i;
const textFile = /\.(?:ts|tsx|js|mjs|cjs|json|html|xml|txt|css|md|rs|toml|ya?ml|example)$/i;

// Keep the values assembled from fragments so the audit itself never becomes a PII fixture.
const identityEmails = [
  ["asrinklcc", "@", "dixtuel", ".tr"].join(""),
  ["asrinklcc", "@", "sely", ".tr"].join(""),
];
const identityNames = [["Asr", "ın", " ", "K", "ıl", "ıç"].join("")];
const approvedPublicIdentityFile = "client/src/lib/contact.ts";
const forbiddenIdentityBinding = /["'](?:@id|sameAs|creator|author)["']\s*:/;

export function decodeEscapedText(content) {
  return content
    .replace(/\\u\{([\da-f]{1,6})\}/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\u([\da-f]{4})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([\da-f]{2})/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (_, hex, decimal) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "";
    });
}

export function decodeCharacterArrays(content) {
  const candidates = [];
  const patterns = [
    /\[((?:\s*\d{1,7}\s*,){2,}\s*\d{1,7}\s*)\]/g,
    /(?:fromCharCode|fromCodePoint)\(((?:\s*\d{1,7}\s*,){2,}\s*\d{1,7}\s*)\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const codes = match[1].split(",").map(value => Number(value.trim()));
      if (codes.some(value => !Number.isInteger(value) || value < 0 || value > 0x10ffff)) continue;
      try {
        candidates.push(String.fromCodePoint(...codes));
        // fromCharCode truncates to UTF-16 code units; inspect that common obfuscation too.
        candidates.push(String.fromCharCode(...codes));
      } catch {
        // Malformed arrays are ignored; the raw file remains covered by literal scans.
      }
    }
  }
  return candidates;
}

export function containsPrivateIdentity(content, emails = identityEmails, names = identityNames) {
  const candidates = [content, decodeEscapedText(content), ...decodeCharacterArrays(content)];
  const normalized = candidates
    .map(value => value.toLocaleLowerCase("tr-TR").replace(/\s+/g, " "))
    .join("\n");
  if (emails.some(email => normalized.includes(email.toLocaleLowerCase("en-US")))) return "real contact address";
  if (names.some(name => normalized.includes(name.toLocaleLowerCase("tr-TR")))) return "plaintext or encoded personal name";
  return undefined;
}

function removeSingleOccurrence(content, value) {
  const first = content.indexOf(value);
  if (first < 0 || content.indexOf(value, first + value.length) >= 0) return content;
  return content.slice(0, first) + content.slice(first + value.length);
}

export function stripApprovedPublicIdentity(path, content, emails = identityEmails, names = identityNames) {
  if (path !== approvedPublicIdentityFile) return content;
  return [...emails, ...names].reduce(removeSingleOccurrence, content);
}

function isUserFacing(path) {
  return path.startsWith("client/");
}

// The maintainer explicitly permits ordinary identity/contact attribution in these
// project metadata files. Keep the runtime-source scan strict; don't treat metadata
// attribution as an obfuscation or privacy leak.
export function isMetadataAttribution(path) {
  return /(?:^|\/)(?:README(?:\.[^/]+)?|SECURITY(?:\.[^/]+)?|LICENSE(?:\.[^/]+)?|package\.json|Cargo\.toml|ATTRIBUTION\.md)$/i.test(path);
}

async function audit() {
  let paths;
  try {
    paths = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root })
      .toString("utf8")
      .split("\0")
      .filter(Boolean);
  } catch {
    throw new Error("Public release audit must run inside the Git repository.");
  }

  const findings = [];
  for (const path of paths) {
    const fullPath = resolve(root, path);
    if (forbiddenFile.test(path.split("/").at(-1) || "")) findings.push(`${path}: search verification file`);
    if (!textFile.test(path)) continue;
    let content;
    try {
      content = await readFile(fullPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue; // A staged deletion is not part of the public output.
      throw error;
    }
    if (!isMetadataAttribution(path)) {
      const identityIssue = containsPrivateIdentity(stripApprovedPublicIdentity(path, content));
      if (identityIssue) findings.push(`${path}: ${identityIssue}`);
    }
    if (isUserFacing(path) && forbiddenIdentityBinding.test(content)) {
      findings.push(`${path}: structured identity binding`);
    }
  }

  if (findings.length) {
    console.error("Public release audit failed:\n" + findings.map(item => `- ${item}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Public release audit passed: no prohibited identity or verification artifacts found.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await audit();
}
