// Hane kelime modu için geniş "tahmin sözlüğü" üretir — hem Türkçe hem İngilizce.
// Gerçek Wordle'ların solutions/allowed-guesses ayrımıyla aynı desen: bu liste
// yalnız TAHMİN DOĞRULAMA içindir, günün cevabı hâlâ levelGenerators.ts'teki
// küratörlü havuzlardan seçilir.
//
// Kaynaklar:
// 1. Türkçe: scripts/data/tdk-source.txt (TDK kamu sözlüğü, ncarkaci/TDKDictionaryCrawler)
// 2. İngilizce: scripts/data/enable-source.txt (ENABLE lexicon, Public Domain)
//               + scripts/data/wordle-source.txt (Wordle guess list, Public Domain)
//
// Çalıştırma: `node scripts/build-hane-word-lists.mjs`
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tdkPath = resolve(__dirname, "data/tdk-source.txt");
const enablePath = resolve(__dirname, "data/enable-source.txt");
const wordlePath = resolve(__dirname, "data/wordle-source.txt");
const outputPath = resolve(__dirname, "../client/src/lib/haneWordLists.ts");

const LENGTHS = [4, 5];
const TR_WORD = /^[a-zçğıöşü]+$/;
const EN_WORD = /^[a-z]+$/;

// 1. Türkçe Sözlük (TDK)
const tdkRaw = readFileSync(tdkPath, "utf-8").split("\n");
const trByLength = Object.fromEntries(LENGTHS.map(l => [l, new Set()]));

for (const line of tdkRaw) {
  const word = line.trim();
  if (!word) continue;
  if (word.includes(" ") || word.includes("/") || word.includes("-")) continue;
  if (word[0] !== word[0].toLocaleLowerCase("tr-TR")) continue; // özel isimleri atla
  const lower = word.toLocaleLowerCase("tr-TR");
  if (!TR_WORD.test(lower)) continue;
  const upper = Array.from(lower.toLocaleUpperCase("tr-TR")).join("");
  const length = Array.from(upper).length;
  if (trByLength[length]) trByLength[length].add(upper);
}

// 2. İngilizce Sözlük (ENABLE + Wordle)
const enByLength = Object.fromEntries(LENGTHS.map(l => [l, new Set()]));

function processEnglishSource(filePath) {
  const raw = readFileSync(filePath, "utf-8").split("\n");
  for (const line of raw) {
    const word = line.trim().toLowerCase();
    if (!word) continue;
    if (!EN_WORD.test(word)) continue;
    const length = word.length;
    if (enByLength[length]) {
      enByLength[length].add(word.toUpperCase());
    }
  }
}

processEnglishSource(enablePath);
processEnglishSource(wordlePath);

const lines = [
  "// AUTO-GENERATED — düzenlemeyin. Üretmek için: node scripts/build-hane-word-lists.mjs",
  "// Kaynaklar:",
  "// - Türkçe: TDK kamuya açık sözlük madde başları (scripts/data/tdk-source.txt)",
  "// - İngilizce: ENABLE Enhanced North American Benchmark Lexicon + Wordle guess list (Public Domain)",
  "// Yalnız TAHMİN DOĞRULAMA için kullanılır — günün cevabı burada değil, levelGenerators.ts'teki",
  "// küratörlü havuzlardan seçilir (gerçek Wordle'ların solutions/allowed-guesses mantığı).",
  "",
  "export const HANE_WORD_GUESS_LISTS_TR: Record<number, string[]> = {",
  ...LENGTHS.map(l => `  ${l}: [${Array.from(trByLength[l]).sort().map(w => JSON.stringify(w)).join(",")}],`),
  "};",
  "",
  "export const HANE_WORD_GUESS_LISTS_EN: Record<number, string[]> = {",
  ...LENGTHS.map(l => `  ${l}: [${Array.from(enByLength[l]).sort().map(w => JSON.stringify(w)).join(",")}],`),
  "};",
  "",
  "// Geriye dönük uyumluluk için varsayılan liste (TR)",
  "export const HANE_WORD_GUESS_LISTS = HANE_WORD_GUESS_LISTS_TR;",
  "",
];

writeFileSync(outputPath, lines.join("\n"));

console.log("=== Türkçe (TDK) ===");
for (const l of LENGTHS) console.log(`${l} harf: ${trByLength[l].size} kelime`);
console.log("=== İngilizce (ENABLE + Wordle) ===");
for (const l of LENGTHS) console.log(`${l} harf: ${enByLength[l].size} kelime`);
console.log("Yazıldı:", outputPath);
