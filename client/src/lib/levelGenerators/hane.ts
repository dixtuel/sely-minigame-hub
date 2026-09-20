import type { SiteLocale } from "../i18n";
import { indexFor } from "./shared";
import { mulberry32 as rng } from "../rng";
import { isWasmReady, wasm_generate_hane_level, wasm_compare_hane_number_guess } from "../wasmBridge";

export type HaneLevel = {
  digits: number;
  maxGuesses: number;
  target: string;
  allowsRepeats: boolean;
  lesson: string;
};

export type HaneNumberMark = "exact" | "present" | "absent";
export type HaneFeedback = { marks: HaneNumberMark[]; exact: number; present: number };
export type HaneMode = "number" | "word";
export type HaneWordMark = "exact" | "present" | "absent";
export type HaneWordFeedback = { marks: HaneWordMark[]; exact: number; present: number };
export type HaneWordLevel = { length: number; maxGuesses: number; target: string; category: string; categoryEn: string; lesson: string };

type HaneWordEntry = { word: string; category: string; categoryEn: string };

const HANE_WORD_POOL_TR_4: HaneWordEntry[] = [
  { word: "boya", category: "Atölye", categoryEn: "Workshop" }, { word: "çivi", category: "Atölye", categoryEn: "Workshop" },
  { word: "harç", category: "Atölye", categoryEn: "Workshop" }, { word: "deri", category: "Atölye", categoryEn: "Workshop" },
  { word: "keçe", category: "Atölye", categoryEn: "Workshop" }, { word: "kutu", category: "Atölye", categoryEn: "Workshop" },
  { word: "ağaç", category: "Doğa", categoryEn: "Nature" }, { word: "kaya", category: "Doğa", categoryEn: "Nature" },
  { word: "tepe", category: "Doğa", categoryEn: "Nature" }, { word: "vadi", category: "Doğa", categoryEn: "Nature" },
  { word: "dere", category: "Doğa", categoryEn: "Nature" }, { word: "hava", category: "Doğa", categoryEn: "Nature" },
  { word: "yurt", category: "Doğa", categoryEn: "Nature" }, { word: "kıyı", category: "Doğa", categoryEn: "Nature" },
  { word: "araç", category: "Yol", categoryEn: "Journey" }, { word: "rota", category: "Yol", categoryEn: "Journey" },
  { word: "adım", category: "Yol", categoryEn: "Journey" }, { word: "tren", category: "Yol", categoryEn: "Journey" },
  { word: "gemi", category: "Yol", categoryEn: "Journey" }, { word: "yaya", category: "Yol", categoryEn: "Journey" },
  { word: "akış", category: "Yol", categoryEn: "Journey" }, { word: "kapı", category: "Yol", categoryEn: "Journey" },
  { word: "kule", category: "Keşif", categoryEn: "Discovery" }, { word: "plan", category: "Keşif", categoryEn: "Discovery" },
  { word: "ışık", category: "Keşif", categoryEn: "Discovery" }, { word: "koku", category: "Keşif", categoryEn: "Discovery" },
  { word: "ufuk", category: "Keşif", categoryEn: "Discovery" }, { word: "akıl", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "izin", category: "Bilgi", categoryEn: "Knowledge" }, { word: "konu", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "süre", category: "Bilgi", categoryEn: "Knowledge" }, { word: "soru", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "yazı", category: "Bilgi", categoryEn: "Knowledge" }, { word: "veri", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "ders", category: "Bilgi", categoryEn: "Knowledge" }, { word: "oyun", category: "Kültür", categoryEn: "Culture" },
  { word: "nota", category: "Kültür", categoryEn: "Culture" }, { word: "dans", category: "Kültür", categoryEn: "Culture" },
  { word: "film", category: "Kültür", categoryEn: "Culture" }, { word: "kupa", category: "Kültür", categoryEn: "Culture" },
  { word: "şiir", category: "Kültür", categoryEn: "Culture" }, { word: "peri", category: "Kültür", categoryEn: "Culture" },
  { word: "eser", category: "Kültür", categoryEn: "Culture" }, { word: "şans", category: "Gündelik", categoryEn: "Everyday" },
  { word: "kira", category: "Gündelik", categoryEn: "Everyday" }, { word: "masa", category: "Gündelik", categoryEn: "Everyday" },
  { word: "saat", category: "Gündelik", categoryEn: "Everyday" }, { word: "ayna", category: "Gündelik", categoryEn: "Everyday" },
  { word: "çatı", category: "Gündelik", categoryEn: "Everyday" }, { word: "tava", category: "Gündelik", categoryEn: "Everyday" },
];

const HANE_WORD_POOL_TR_5: HaneWordEntry[] = [
  { word: "baskı", category: "Atölye", categoryEn: "Workshop" }, { word: "kağıt", category: "Atölye", categoryEn: "Workshop" },
  { word: "damga", category: "Atölye", categoryEn: "Workshop" }, { word: "çizgi", category: "Atölye", categoryEn: "Workshop" },
  { word: "kalem", category: "Atölye", categoryEn: "Workshop" }, { word: "fırça", category: "Atölye", categoryEn: "Workshop" },
  { word: "bahçe", category: "Doğa", categoryEn: "Nature" }, { word: "çiçek", category: "Doğa", categoryEn: "Nature" },
  { word: "deniz", category: "Doğa", categoryEn: "Nature" }, { word: "nehir", category: "Doğa", categoryEn: "Nature" },
  { word: "bulut", category: "Doğa", categoryEn: "Nature" }, { word: "bahar", category: "Doğa", categoryEn: "Nature" },
  { word: "şafak", category: "Doğa", categoryEn: "Nature" }, { word: "çınar", category: "Doğa", categoryEn: "Nature" },
  { word: "köprü", category: "Yol", categoryEn: "Journey" }, { word: "durak", category: "Yol", categoryEn: "Journey" },
  { word: "yolcu", category: "Yol", categoryEn: "Journey" }, { word: "vapur", category: "Yol", categoryEn: "Journey" },
  { word: "tünel", category: "Yol", categoryEn: "Journey" }, { word: "geçit", category: "Yol", categoryEn: "Journey" },
  { word: "mühür", category: "Keşif", categoryEn: "Discovery" }, { word: "yankı", category: "Keşif", categoryEn: "Discovery" },
  { word: "gölge", category: "Keşif", categoryEn: "Discovery" }, { word: "fener", category: "Keşif", categoryEn: "Discovery" },
  { word: "izlek", category: "Keşif", categoryEn: "Discovery" }, { word: "bilet", category: "Keşif", categoryEn: "Discovery" },
  { word: "çözüm", category: "Bilgi", categoryEn: "Knowledge" }, { word: "cevap", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "neden", category: "Bilgi", categoryEn: "Knowledge" }, { word: "anlam", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "işlem", category: "Bilgi", categoryEn: "Knowledge" }, { word: "metin", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "bilim", category: "Bilgi", categoryEn: "Knowledge" }, { word: "radyo", category: "Kültür", categoryEn: "Culture" },
  { word: "müzik", category: "Kültür", categoryEn: "Culture" }, { word: "sahne", category: "Kültür", categoryEn: "Culture" },
  { word: "takım", category: "Kültür", categoryEn: "Culture" }, { word: "kitap", category: "Kültür", categoryEn: "Culture" },
  { word: "kahve", category: "Gündelik", categoryEn: "Everyday" }, { word: "limon", category: "Gündelik", categoryEn: "Everyday" },
  { word: "şeker", category: "Gündelik", categoryEn: "Everyday" }, { word: "ekmek", category: "Gündelik", categoryEn: "Everyday" },
  { word: "tatlı", category: "Gündelik", categoryEn: "Everyday" }, { word: "sayfa", category: "Gündelik", categoryEn: "Everyday" },
];

const HANE_WORD_POOL_EN_4: HaneWordEntry[] = [
  { word: "tool", category: "Atölye", categoryEn: "Workshop" }, { word: "gear", category: "Atölye", categoryEn: "Workshop" },
  { word: "iron", category: "Atölye", categoryEn: "Workshop" }, { word: "wood", category: "Atölye", categoryEn: "Workshop" },
  { word: "clay", category: "Atölye", categoryEn: "Workshop" }, { word: "wire", category: "Atölye", categoryEn: "Workshop" },
  { word: "rain", category: "Doğa", categoryEn: "Nature" }, { word: "wind", category: "Doğa", categoryEn: "Nature" },
  { word: "leaf", category: "Doğa", categoryEn: "Nature" }, { word: "tree", category: "Doğa", categoryEn: "Nature" },
  { word: "rock", category: "Doğa", categoryEn: "Nature" }, { word: "star", category: "Doğa", categoryEn: "Nature" },
  { word: "moon", category: "Doğa", categoryEn: "Nature" }, { word: "wave", category: "Doğa", categoryEn: "Nature" },
  { word: "path", category: "Yol", categoryEn: "Journey" }, { word: "road", category: "Yol", categoryEn: "Journey" },
  { word: "gate", category: "Yol", categoryEn: "Journey" }, { word: "port", category: "Yol", categoryEn: "Journey" },
  { word: "ship", category: "Yol", categoryEn: "Journey" }, { word: "lane", category: "Yol", categoryEn: "Journey" },
  { word: "walk", category: "Yol", categoryEn: "Journey" }, { word: "dock", category: "Yol", categoryEn: "Journey" },
  { word: "clue", category: "Keşif", categoryEn: "Discovery" }, { word: "mark", category: "Keşif", categoryEn: "Discovery" },
  { word: "code", category: "Keşif", categoryEn: "Discovery" }, { word: "lens", category: "Keşif", categoryEn: "Discovery" },
  { word: "mask", category: "Keşif", categoryEn: "Discovery" }, { word: "glow", category: "Keşif", categoryEn: "Discovery" },
  { word: "echo", category: "Keşif", categoryEn: "Discovery" }, { word: "sign", category: "Keşif", categoryEn: "Discovery" },
  { word: "word", category: "Bilgi", categoryEn: "Knowledge" }, { word: "page", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "idea", category: "Bilgi", categoryEn: "Knowledge" }, { word: "fact", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "mind", category: "Bilgi", categoryEn: "Knowledge" }, { word: "book", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "data", category: "Bilgi", categoryEn: "Knowledge" }, { word: "read", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "song", category: "Kültür", categoryEn: "Culture" }, { word: "poem", category: "Kültür", categoryEn: "Culture" },
  { word: "drum", category: "Kültür", categoryEn: "Culture" }, { word: "myth", category: "Kültür", categoryEn: "Culture" },
  { word: "epic", category: "Kültür", categoryEn: "Culture" }, { word: "tune", category: "Kültür", categoryEn: "Culture" },
  { word: "arts", category: "Kültür", categoryEn: "Culture" }, { word: "band", category: "Kültür", categoryEn: "Culture" },
  { word: "desk", category: "Gündelik", categoryEn: "Everyday" }, { word: "door", category: "Gündelik", categoryEn: "Everyday" },
  { word: "time", category: "Gündelik", categoryEn: "Everyday" }, { word: "bell", category: "Gündelik", categoryEn: "Everyday" },
  { word: "card", category: "Gündelik", categoryEn: "Everyday" }, { word: "lamp", category: "Gündelik", categoryEn: "Everyday" },
  { word: "soap", category: "Gündelik", categoryEn: "Everyday" }, { word: "home", category: "Gündelik", categoryEn: "Everyday" },
];

const HANE_WORD_POOL_EN_5: HaneWordEntry[] = [
  { word: "print", category: "Atölye", categoryEn: "Workshop" }, { word: "paper", category: "Atölye", categoryEn: "Workshop" },
  { word: "stamp", category: "Atölye", categoryEn: "Workshop" }, { word: "brush", category: "Atölye", categoryEn: "Workshop" },
  { word: "forge", category: "Atölye", categoryEn: "Workshop" }, { word: "craft", category: "Atölye", categoryEn: "Workshop" },
  { word: "anvil", category: "Atölye", categoryEn: "Workshop" }, { word: "blade", category: "Atölye", categoryEn: "Workshop" },
  { word: "river", category: "Doğa", categoryEn: "Nature" }, { word: "cloud", category: "Doğa", categoryEn: "Nature" },
  { word: "bloom", category: "Doğa", categoryEn: "Nature" }, { word: "ocean", category: "Doğa", categoryEn: "Nature" },
  { word: "grove", category: "Doğa", categoryEn: "Nature" }, { word: "frost", category: "Doğa", categoryEn: "Nature" },
  { word: "earth", category: "Doğa", categoryEn: "Nature" }, { word: "flame", category: "Doğa", categoryEn: "Nature" },
  { word: "trail", category: "Yol", categoryEn: "Journey" }, { word: "route", category: "Yol", categoryEn: "Journey" },
  { word: "track", category: "Yol", categoryEn: "Journey" }, { word: "ferry", category: "Yol", categoryEn: "Journey" },
  { word: "train", category: "Yol", categoryEn: "Journey" }, { word: "canal", category: "Yol", categoryEn: "Journey" },
  { word: "guide", category: "Yol", categoryEn: "Journey" }, { word: "cabin", category: "Yol", categoryEn: "Journey" },
  { word: "trace", category: "Keşif", categoryEn: "Discovery" }, { word: "crypt", category: "Keşif", categoryEn: "Discovery" },
  { word: "relic", category: "Keşif", categoryEn: "Discovery" }, { word: "torch", category: "Keşif", categoryEn: "Discovery" },
  { word: "spark", category: "Keşif", categoryEn: "Discovery" }, { word: "prism", category: "Keşif", categoryEn: "Discovery" },
  { word: "vault", category: "Keşif", categoryEn: "Discovery" }, { word: "quest", category: "Keşif", categoryEn: "Discovery" },
  { word: "logic", category: "Bilgi", categoryEn: "Knowledge" }, { word: "proof", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "truth", category: "Bilgi", categoryEn: "Knowledge" }, { word: "query", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "sense", category: "Bilgi", categoryEn: "Knowledge" }, { word: "study", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "brain", category: "Bilgi", categoryEn: "Knowledge" }, { word: "focus", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "music", category: "Kültür", categoryEn: "Culture" }, { word: "radio", category: "Kültür", categoryEn: "Culture" },
  { word: "stage", category: "Kültür", categoryEn: "Culture" }, { word: "novel", category: "Kültür", categoryEn: "Culture" },
  { word: "dance", category: "Kültür", categoryEn: "Culture" }, { word: "choir", category: "Kültür", categoryEn: "Culture" },
  { word: "story", category: "Kültür", categoryEn: "Culture" }, { word: "actor", category: "Kültür", categoryEn: "Culture" },
  { word: "bread", category: "Gündelik", categoryEn: "Everyday" }, { word: "sugar", category: "Gündelik", categoryEn: "Everyday" },
  { word: "lemon", category: "Gündelik", categoryEn: "Everyday" }, { word: "clock", category: "Gündelik", categoryEn: "Everyday" },
  { word: "water", category: "Gündelik", categoryEn: "Everyday" }, { word: "fruit", category: "Gündelik", categoryEn: "Everyday" },
  { word: "glass", category: "Gündelik", categoryEn: "Everyday" }, { word: "table", category: "Gündelik", categoryEn: "Everyday" },
];

const HANE_WORD_EXTRA_GUESSES_TR = ["resim", "süreç", "sesli", "izler", "bölüm", "plaka", "merak", "oymak", "güneş"];
const HANE_WORD_EXTRA_GUESSES_EN = ["apple", "crane", "slate", "adieu", "audio", "roast", "stare", "raise"];

export const HANE_WORD_LENGTHS = [4, 5] as const;
const HANE_WORD_POOLS_TR: Record<number, HaneWordEntry[]> = {
  4: HANE_WORD_POOL_TR_4,
  5: HANE_WORD_POOL_TR_5,
};
const HANE_WORD_POOLS_EN: Record<number, HaneWordEntry[]> = {
  4: HANE_WORD_POOL_EN_4,
  5: HANE_WORD_POOL_EN_5,
};

export const haneLetters = (value: string, locale: SiteLocale = "tr") =>
  Array.from(value.trim().toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US"));

const HANE_WORD_GUESS_SET_CACHE_TR: Record<number, Set<string>> = {};
const HANE_WORD_GUESS_SET_CACHE_EN: Record<number, Set<string>> = {};
let haneWordGuessListsPromise: Promise<{
  HANE_WORD_GUESS_LISTS_TR: Record<number, string[]>;
  HANE_WORD_GUESS_LISTS_EN: Record<number, string[]>;
}> | null = null;

function extraGuessesFor(length: number, locale: SiteLocale = "tr") {
  const pools = locale === "tr" ? HANE_WORD_POOLS_TR : HANE_WORD_POOLS_EN;
  const pool = pools[length] ?? [];
  const extras = locale === "tr" ? HANE_WORD_EXTRA_GUESSES_TR : HANE_WORD_EXTRA_GUESSES_EN;
  return [
    ...pool.map(entry => haneLetters(entry.word, locale).join("")),
    ...extras.filter(word => haneLetters(word, locale).length === length).map(word => haneLetters(word, locale).join("")),
  ];
}

export async function haneWordGuessSetFor(length: number, locale: SiteLocale = "tr"): Promise<Set<string>> {
  const isTr = locale === "tr";
  const cache = isTr ? HANE_WORD_GUESS_SET_CACHE_TR : HANE_WORD_GUESS_SET_CACHE_EN;
  if (cache[length]) return cache[length];
  if (!haneWordGuessListsPromise) {
    haneWordGuessListsPromise = import("../haneWordLists").then(module => ({
      HANE_WORD_GUESS_LISTS_TR: module.HANE_WORD_GUESS_LISTS_TR,
      HANE_WORD_GUESS_LISTS_EN: module.HANE_WORD_GUESS_LISTS_EN,
    }));
  }
  const lists = await haneWordGuessListsPromise;
  const list = (isTr ? lists.HANE_WORD_GUESS_LISTS_TR : lists.HANE_WORD_GUESS_LISTS_EN)[length] ?? [];
  const set = new Set([...list, ...extraGuessesFor(length, locale)]);
  cache[length] = set;
  return set;
}


export function generateHaneLevel(seed: number, mastery: number): HaneLevel {
  if (isWasmReady()) {
    try {
      return wasm_generate_hane_level(seed >>> 0, mastery >>> 0) as HaneLevel;
    } catch {
      // Fallback to JS implementation
    }
  }
  const random = rng(seed ^ Math.imul(mastery + 17, 0x45d9f3b));
  const digits = mastery >= 4 ? 5 : 4;
  const allowsRepeats = mastery >= 3;
  const values: string[] = [];
  while (values.length < digits) {
    const digit = String(Math.floor(random() * 10));
    if (values.length === 0 && digit === "0") continue;
    if (!allowsRepeats && values.includes(digit)) continue;
    values.push(digit);
  }
  return {
    digits,
    maxGuesses: Math.max(4, 7 - mastery),
    target: values.join(""),
    allowsRepeats,
    lesson: allowsRepeats ? "Yerinde işareti doğru hane ve doğru sırayı; izde işareti doğru haneyi ama başka sırayı gösterir. Aynı hane birden fazla kez sayılabilir." : "Yerinde işareti doğru hane ve doğru sırayı; izde işareti doğru haneyi ama başka sırayı gösterir. Günün kaydında haneler tekrar etmez.",
  };
}

export function isHaneGuessValid(guess: string, level: Pick<HaneLevel, "digits">) {
  return new RegExp(`^[1-9][0-9]{${level.digits - 1}}$`).test(guess);
}

/** Sayı modu artık kelime modundakiyle AYNI konum-bazlı gösterim kullanır — hane
 * bazında hangi rakamın doğru/yanlış olduğu (yalnız toplam kilit/iz sayısı değil)
 * net görünür. Algoritma compareHaneWordGuess ile birebir aynı iki-geçişli,
 * tekrarlı-rakam-güvenli mantık. */
export function compareHaneNumberGuess(target: string, guess: string): HaneFeedback {
  if (isWasmReady()) {
    try {
      return wasm_compare_hane_number_guess(target, guess) as HaneFeedback;
    } catch {
      // Fallback to JS implementation
    }
  }
  const targetDigits = target.split("");
  const guessDigits = guess.split("");
  const marks: HaneNumberMark[] = Array.from({ length: targetDigits.length }, () => "absent");
  const remainingTarget: string[] = [];
  const pending: number[] = [];
  let exact = 0;
  for (let index = 0; index < targetDigits.length; index += 1) {
    if (targetDigits[index] === guessDigits[index]) { marks[index] = "exact"; exact += 1; }
    else { remainingTarget.push(targetDigits[index]); pending.push(index); }
  }
  let present = 0;
  for (const index of pending) {
    const location = remainingTarget.indexOf(guessDigits[index]);
    if (location >= 0) { marks[index] = "present"; present += 1; remainingTarget.splice(location, 1); }
  }
  return { marks, exact, present };
}

export function generateHaneWordLevel(seed: number, mastery: number, locale: SiteLocale = "tr"): HaneWordLevel {
  // Uzunluk sadece güne (ham seed'e) bağlı — mastery'den ve dilden bağımsız, aynı gün herkes
  // aynı uzunlukla (4 veya 5) oynar. Kelime seçimi dile göre ilgili havuzdan yapılır.
  const length = HANE_WORD_LENGTHS[indexFor(seed, 991, HANE_WORD_LENGTHS.length)];
  const pools = locale === "en" ? HANE_WORD_POOLS_EN : HANE_WORD_POOLS_TR;
  const pool = pools[length];
  const entry = pool[indexFor(seed ^ Math.imul(mastery + 31, 0x27d4eb2d), 71 + mastery * 19, pool.length)];
  return {
    length,
    maxGuesses: Math.max(4, 7 - mastery),
    target: haneLetters(entry.word, locale).join(""),
    category: entry.category,
    categoryEn: entry.categoryEn,
    lesson: locale === "en"
      ? "Read each mark in context with previous slips. A letter leaves a trace only as many times as it appears in the target."
      : "Her işareti tek başına değil, önceki fişlerle birlikte oku. Aynı harf hedefte bulunduğu kadar iz bırakır.",
  };
}

export async function isHaneWordGuessValid(guess: string, level: Pick<HaneWordLevel, "length">, locale: SiteLocale = "tr") {
  const normalized = haneLetters(guess, locale);
  if (normalized.length !== level.length) return false;
  const set = await haneWordGuessSetFor(level.length, locale);
  return set.has(normalized.join(""));
}

export function compareHaneWordGuess(target: string, guess: string, locale: SiteLocale = "tr"): HaneWordFeedback {
  const targetLetters = haneLetters(target, locale);
  const guessLetters = haneLetters(guess, locale);
  const marks: HaneWordMark[] = Array.from({ length: targetLetters.length }, () => "absent");
  const remainingTarget: string[] = [];
  const pending: number[] = [];
  let exact = 0;
  for (let index = 0; index < targetLetters.length; index += 1) {
    if (targetLetters[index] === guessLetters[index]) { marks[index] = "exact"; exact += 1; }
    else { remainingTarget.push(targetLetters[index]); pending.push(index); }
  }
  let present = 0;
  for (const index of pending) {
    const location = remainingTarget.indexOf(guessLetters[index]);
    if (location >= 0) { marks[index] = "present"; present += 1; remainingTarget.splice(location, 1); }
  }
  return { marks, exact, present };
}
