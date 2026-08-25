// Hane kelime modu için geniş "tahmin sözlüğü" üretir — gerçek Wordle'ların
// solutions/allowed-guesses ayrımıyla aynı desen: bu liste yalnız TAHMİN DOĞRULAMA
// içindir, günün cevabı hâlâ levelGenerators.ts'teki küçük, elle-küratörlü
// HANE_WORD_POOLS'tan seçilir. Kaynak: scripts/data/tdk-source.txt (TDK'nin
// kamuya açık çevrimiçi sözlüğünden toplanmış madde başları, bkz.
// https://github.com/ncarkaci/TDKDictionaryCrawler). Tek seferlik/gerekince
// tekrar çalıştırılır: `node scripts/build-hane-word-lists.mjs`
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, "data/tdk-source.txt");
const outputPath = resolve(__dirname, "../client/src/lib/haneWordLists.ts");

const LENGTHS = [4, 5, 6, 7, 8];
const TR_WORD = /^[a-zçğıöşü]+$/;

const raw = readFileSync(sourcePath, "utf-8").split("\n");
const byLength = Object.fromEntries(LENGTHS.map(length => [length, new Set()]));

for (const line of raw) {
  const word = line.trim();
  if (!word) continue;
  if (word.includes(" ") || word.includes("/") || word.includes("-")) continue; // çok kelimeli/varyant maddeler
  if (word[0] !== word[0].toLocaleLowerCase("tr-TR")) continue; // büyük harfle başlayan özel isimler (Abana, Duma...)
  const lower = word.toLocaleLowerCase("tr-TR");
  if (!TR_WORD.test(lower)) continue;
  const upper = Array.from(lower.toLocaleUpperCase("tr-TR")).join("");
  const length = Array.from(upper).length;
  if (byLength[length]) byLength[length].add(upper);
}

const lines = [
  "// AUTO-GENERATED — düzenlemeyin. Üretmek için: node scripts/build-hane-word-lists.mjs",
  "// Kaynak: TDK'nin kamuya açık sözlük madde başları (scripts/data/tdk-source.txt,",
  "// bkz. https://github.com/ncarkaci/TDKDictionaryCrawler). Yalnız TAHMİN DOĞRULAMA",
  "// için kullanılır — günün cevabı burada değil, levelGenerators.ts'teki küçük",
  "// HANE_WORD_POOLS'tan seçilir (gerçek Wordle'ların solutions/allowed-guesses",
  "// ayrımıyla aynı mantık).",
  "export const HANE_WORD_GUESS_LISTS: Record<number, string[]> = {",
  ...LENGTHS.map(length => `  ${length}: [${Array.from(byLength[length]).sort().map(w => JSON.stringify(w)).join(",")}],`),
  "};",
  "",
];

writeFileSync(outputPath, lines.join("\n"));
for (const length of LENGTHS) console.log(`${length} harf: ${byLength[length].size} kelime`);
console.log("Yazıldı:", outputPath);
