import type { GameId } from "./catalog";

export type Point = { x: number; y: number };
export type Direction = "N" | "E" | "S" | "W";

function rng(seed: number) {
  let value = (seed >>> 0) || 1;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const indexFor = (seed: number, salt: number, length: number) => Math.abs(Math.imul(seed + salt, 1103515245)) % length;

export function masteryBand(score: number) {
  if (score >= 1_800) return 4;
  if (score >= 1_000) return 3;
  if (score >= 420) return 2;
  return 1;
}

export function personalSeed(seed: number, gameId: GameId, mastery: number, attempt: number) {
  const source = `${seed}:${gameId}:${mastery}:${attempt}`;
  let hash = 2166136261;
  for (const char of source) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function runInstanceKey(gameId: GameId, source: "daily" | "personal", attempt: number, seed: number) {
  return `${gameId}:${source}:${attempt}:${seed}`;
}

function pointKey(point: Point) { return `${point.x}-${point.y}`; }

export type HaneLevel = {
  digits: number;
  maxGuesses: number;
  target: string;
  allowsRepeats: boolean;
  lesson: string;
};

export type HaneFeedback = { locks: number; traces: number };
export type HaneMode = "number" | "word";
export type HaneWordMark = "exact" | "present" | "absent";
export type HaneWordFeedback = { marks: HaneWordMark[]; exact: number; present: number };
export type HaneWordLevel = { length: number; maxGuesses: number; target: string; category: string; categoryEn: string; lesson: string };

type HaneWordEntry = { word: string; category: string; categoryEn: string };
const HANE_WORD_SOLUTIONS: HaneWordEntry[] = [
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
const HANE_WORD_EXTRA_GUESSES = ["resim", "süreç", "sesli", "izler", "bölüm", "plaka", "merak", "oymak", "güneş"];

// 5 harf dışındaki uzunluklar için ayrı havuzlar — kelime uzunluğu artık güne (seed'e) göre
// değişiyor, her uzunluğun kendi geçerli kelime listesi olması gerekiyor.
const HANE_WORD_POOL_4: HaneWordEntry[] = [
  { word: "araç", category: "Yol", categoryEn: "Journey" }, { word: "izin", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "konu", category: "Bilgi", categoryEn: "Knowledge" }, { word: "süre", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "oyun", category: "Kültür", categoryEn: "Culture" }, { word: "akıl", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "şans", category: "Gündelik", categoryEn: "Everyday" }, { word: "kira", category: "Gündelik", categoryEn: "Everyday" },
  { word: "peri", category: "Kültür", categoryEn: "Culture" }, { word: "kule", category: "Keşif", categoryEn: "Discovery" },
  { word: "nota", category: "Kültür", categoryEn: "Culture" }, { word: "kupa", category: "Kültür", categoryEn: "Culture" },
];
const HANE_WORD_POOL_6: HaneWordEntry[] = [
  { word: "kelime", category: "Bilgi", categoryEn: "Knowledge" }, { word: "hayvan", category: "Doğa", categoryEn: "Nature" },
  { word: "kumsal", category: "Doğa", categoryEn: "Nature" }, { word: "market", category: "Gündelik", categoryEn: "Everyday" },
  { word: "yaprak", category: "Doğa", categoryEn: "Nature" }, { word: "kaptan", category: "Yol", categoryEn: "Journey" },
  { word: "yıldız", category: "Keşif", categoryEn: "Discovery" }, { word: "merkez", category: "Yol", categoryEn: "Journey" },
  { word: "dükkan", category: "Gündelik", categoryEn: "Everyday" }, { word: "kanepe", category: "Gündelik", categoryEn: "Everyday" },
  { word: "otobüs", category: "Yol", categoryEn: "Journey" }, { word: "sinema", category: "Kültür", categoryEn: "Culture" },
  { word: "yağmur", category: "Doğa", categoryEn: "Nature" }, { word: "gazete", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "terazi", category: "Atölye", categoryEn: "Workshop" }, { word: "sözlük", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "defter", category: "Atölye", categoryEn: "Workshop" },
];
const HANE_WORD_POOL_7: HaneWordEntry[] = [
  { word: "kelebek", category: "Doğa", categoryEn: "Nature" }, { word: "pencere", category: "Gündelik", categoryEn: "Everyday" },
  { word: "şemsiye", category: "Gündelik", categoryEn: "Everyday" }, { word: "gökyüzü", category: "Doğa", categoryEn: "Nature" },
  { word: "telefon", category: "Gündelik", categoryEn: "Everyday" }, { word: "bilezik", category: "Kültür", categoryEn: "Culture" },
  { word: "koridor", category: "Keşif", categoryEn: "Discovery" }, { word: "anahtar", category: "Keşif", categoryEn: "Discovery" },
];
const HANE_WORD_POOL_8: HaneWordEntry[] = [
  { word: "kitaplık", category: "Bilgi", categoryEn: "Knowledge" }, { word: "öğretmen", category: "Bilgi", categoryEn: "Knowledge" },
  { word: "kahvaltı", category: "Gündelik", categoryEn: "Everyday" }, { word: "merdiven", category: "Keşif", categoryEn: "Discovery" },
  { word: "yolculuk", category: "Yol", categoryEn: "Journey" }, { word: "kalemlik", category: "Atölye", categoryEn: "Workshop" },
  { word: "gazeteci", category: "Kültür", categoryEn: "Culture" }, { word: "toplantı", category: "Kültür", categoryEn: "Culture" },
];
const HANE_WORD_LENGTHS = [4, 5, 6, 7, 8] as const;
const HANE_WORD_POOLS: Record<number, HaneWordEntry[]> = {
  4: HANE_WORD_POOL_4,
  5: HANE_WORD_SOLUTIONS,
  6: HANE_WORD_POOL_6,
  7: HANE_WORD_POOL_7,
  8: HANE_WORD_POOL_8,
};
const haneLetters = (value: string) => Array.from(value.trim().toLocaleUpperCase("tr-TR"));
const HANE_WORD_GUESSES = new Set(
  [...Object.values(HANE_WORD_POOLS).flatMap(pool => pool.map(entry => entry.word)), ...HANE_WORD_EXTRA_GUESSES]
    .map(word => haneLetters(word).join(""))
);

export function generateHaneLevel(seed: number, mastery: number): HaneLevel {
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
    lesson: allowsRepeats ? "Kilit doğru hane ve doğru sırayı; iz doğru haneyi ama başka sırayı gösterir. Aynı hane birden fazla kez sayılabilir." : "Kilit doğru hane ve doğru sırayı; iz doğru haneyi ama başka sırayı gösterir. Günün kaydında haneler tekrar etmez.",
  };
}

export function isHaneGuessValid(guess: string, level: Pick<HaneLevel, "digits">) {
  return new RegExp(`^[1-9][0-9]{${level.digits - 1}}$`).test(guess);
}

export function compareHaneGuess(target: string, guess: string): HaneFeedback {
  const targetDigits = target.split("");
  const guessDigits = guess.split("");
  let locks = 0;
  const remainingTarget: string[] = [];
  const remainingGuess: string[] = [];
  for (let index = 0; index < targetDigits.length; index += 1) {
    if (targetDigits[index] === guessDigits[index]) locks += 1;
    else { remainingTarget.push(targetDigits[index]); remainingGuess.push(guessDigits[index]); }
  }
  let traces = 0;
  for (const digit of remainingGuess) {
    const location = remainingTarget.indexOf(digit);
    if (location >= 0) { traces += 1; remainingTarget.splice(location, 1); }
  }
  return { locks, traces };
}

export function generateHaneWordLevel(seed: number, mastery: number): HaneWordLevel {
  // Uzunluk sadece güne (ham seed'e) bağlı — mastery'den bağımsız, aynı gün herkes aynı
  // uzunlukla oynar. Kelime seçimi ayrıca mastery'yi de karıştırır (pratik modda farklılaşsın).
  const length = HANE_WORD_LENGTHS[indexFor(seed, 991, HANE_WORD_LENGTHS.length)];
  const pool = HANE_WORD_POOLS[length];
  const entry = pool[indexFor(seed ^ Math.imul(mastery + 31, 0x27d4eb2d), 71 + mastery * 19, pool.length)];
  return {
    length,
    maxGuesses: Math.max(4, 7 - mastery),
    target: haneLetters(entry.word).join(""),
    category: entry.category,
    categoryEn: entry.categoryEn,
    lesson: "Her işareti tek başına değil, önceki fişlerle birlikte oku. Aynı harf hedefte bulunduğu kadar iz bırakır.",
  };
}

export function isHaneWordGuessValid(guess: string, level: Pick<HaneWordLevel, "length">) {
  const normalized = haneLetters(guess);
  return normalized.length === level.length && HANE_WORD_GUESSES.has(normalized.join(""));
}

export function compareHaneWordGuess(target: string, guess: string): HaneWordFeedback {
  const targetLetters = haneLetters(target);
  const guessLetters = haneLetters(guess);
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

export type EchoLevel = {
  cols: number;
  rows: number;
  key: Point | null;
  exit: Point;
  checkpoints: Point[];
  listenerRoute: Point[];
  walls: Point[];
  fractures: Point[];
  viewport: { cols: number; rows: number };
  pulseBudget: number;
  noiseLimit: number;
  lesson: string;
};

export function generateEchoLevel(seed: number, mastery: number): EchoLevel {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = buildEchoLevelCandidate(seed + attempt * 4111, mastery);
    if (isEchoLevelSolvable(candidate)) return candidate;
  }
  // Güvenlik ağı: yukarıdaki döngü pratikte hep bir denemede başarılı olur (geniş açık ızgara,
  // cömert gürültü bütçesi); teorik bir tükenme durumunda son denemeyi olduğu gibi döndür.
  return buildEchoLevelCandidate(seed, mastery);
}

function buildEchoLevelCandidate(seed: number, mastery: number): EchoLevel {
  const cols = mastery >= 3 ? 21 : 19;
  const rows = mastery >= 3 ? 15 : 13;
  const barriers = [4, 8, 12, 16];
  // Her bariyer için bağımsız, seed'e bağlı iki açıklık (kenarlara çok yakın olmasın, birbirinden farklı olsun)
  const openingAt = (barrierIndex: number, slot: number) => 2 + indexFor(seed, 401 + barrierIndex * 53 + slot * 11, rows - 4);
  const openings = barriers.map((_, barrierIndex) => {
    const first = openingAt(barrierIndex, 0);
    const second = ((openingAt(barrierIndex, 1) + 1) % (rows - 4)) + 2; // first'ten garanti farklı
    return [first, second];
  });
  const walls = barriers.flatMap((x, barrierIndex) => Array.from({ length: rows }, (_, y) => ({ x, y })).filter(point => !openings[barrierIndex].includes(point.y)));
  const listenerRoute = [{ x: 9, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 2 }, { x: 9, y: 2 }];
  const checkpointY = (salt: number) => 1 + indexFor(seed, salt, rows - 2);
  const checkpoints = [{ x: 2, y: checkpointY(457) }, { x: 6, y: checkpointY(461) }, { x: 10, y: checkpointY(463) }];
  const fractureAt = (salt: number) => ({ x: [2, 6, 10, 14, 18][indexFor(seed, salt, 5)], y: 1 + indexFor(seed, salt + 5, rows - 2) });
  return {
    cols,
    rows,
    key: mastery >= 2 ? { x: 14, y: 5 } : null,
    exit: { x: cols - 1, y: rows - 2 },
    checkpoints,
    listenerRoute,
    walls,
    fractures: [fractureAt(509), fractureAt(521), ...(mastery >= 3 ? [fractureAt(541), fractureAt(557)] : [])],
    viewport: { cols: 9, rows: 7 },
    pulseBudget: clamp(7 - mastery, 3, 6),
    noiseLimit: 44 + mastery * 4,
    lesson: mastery >= 3 ? "İzleri oda oda kaydet; kırılgan zeminin gürültüsünü dinleyicinin devriyesinden uzakta yönet." : "Harita aklında kalır. Uzun koridor karardığında yankıyı, kırılgan zemin gelmeden önce kullan.",
  };
}

export function isEchoLevelSolvable(level: EchoLevel) {
  type State = { point: Point; hasKey: boolean; noise: number; checkpointMask: number };
  const queue: State[] = [{ point: { x: 0, y: 0 }, hasKey: !level.key, noise: 0, checkpointMask: 0 }];
  const seen = new Set([`0-0-${!level.key ? 1 : 0}-0-0`]);
  const listener = level.listenerRoute[0];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.hasKey && current.checkpointMask === (1 << level.checkpoints.length) - 1 && current.point.x === level.exit.x && current.point.y === level.exit.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const point = { x: current.point.x + dx, y: current.point.y + dy };
      if (point.x < 0 || point.y < 0 || point.x >= level.cols || point.y >= level.rows || level.walls.some(wall => wall.x === point.x && wall.y === point.y) || (point.x === listener.x && point.y === listener.y)) continue;
      const noise = current.noise + 1 + (level.fractures.some(fracture => fracture.x === point.x && fracture.y === point.y) ? 2 : 0); if (noise > level.noiseLimit) continue;
      const hasKey = current.hasKey || Boolean(level.key && point.x === level.key.x && point.y === level.key.y);
      const checkpointIndex = level.checkpoints.findIndex(checkpoint => checkpoint.x === point.x && checkpoint.y === point.y);
      const checkpointMask = checkpointIndex >= 0 ? current.checkpointMask | (1 << checkpointIndex) : current.checkpointMask;
      const key = `${point.x}-${point.y}-${hasKey ? 1 : 0}-${checkpointMask}-${noise}`;
      if (!seen.has(key)) { seen.add(key); queue.push({ point, hasKey, noise, checkpointMask }); }
    }
  }
  return false;
}

/**
 * Düğüm tahtası her seviyede YENİDEN üretilir: rastgele bir kapsayan ağaç (spanning tree)
 * üzerinden kaynaktan (0) hedefe (15) giden GERÇEK yol her seed'de değişir — yalnız karoların
 * dönüşü değil, akışın izlediği hücreler de farklılaşır. Karo geometrisi (`tileShapes`) ve
 * kritik yol (`targetPath`/`bonusPath`) artık `KnotLevel`'in bir parçası; tek doğruluk kaynağı
 * burası, GameStudio.tsx bu alanları seviyeden okur (sabit dizi içe aktarmaz).
 */
export type KnotLevel = {
  tileShapes: Direction[][];
  rotations: number[];
  sourceIndex: number;
  targetIndex: number;
  targetPath: number[];
  bonusIndex: number;
  bonusPath: number[];
  heatLimit: number;
  lesson: string;
};

const KNOT_COLS = 4;
const KNOT_ROWS = 4;
const KNOT_DIRECTION_ORDER: Direction[] = ["N", "E", "S", "W"];
const KNOT_STEP: Record<Direction, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const KNOT_OPPOSITE: Record<Direction, Direction> = { N: "S", E: "W", S: "N", W: "E" };
export const KNOT_SOURCE_INDEX = 0;
export const KNOT_TARGET_INDEX = 15;

function knotNeighbors(index: number): { dir: Direction; index: number }[] {
  const r = Math.floor(index / KNOT_COLS);
  const c = index % KNOT_COLS;
  const out: { dir: Direction; index: number }[] = [];
  for (const dir of KNOT_DIRECTION_ORDER) {
    const [dr, dc] = KNOT_STEP[dir];
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < KNOT_ROWS && nc >= 0 && nc < KNOT_COLS) out.push({ dir, index: nr * KNOT_COLS + nc });
  }
  return out;
}

function knotDirectionBetween(from: number, to: number): Direction {
  const match = knotNeighbors(from).find(neighbor => neighbor.index === to);
  if (!match) throw new Error("Knot: bitişik olmayan hücreler arasında yön aranıyor");
  return match.dir;
}

function buildKnotSpanningTree(random: () => number): Map<number, number[]> {
  const adjacency = new Map<number, number[]>();
  for (let i = 0; i < KNOT_COLS * KNOT_ROWS; i += 1) adjacency.set(i, []);
  const visited = new Set<number>([KNOT_SOURCE_INDEX]);
  const stack = [KNOT_SOURCE_INDEX];
  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = knotNeighbors(current).filter(neighbor => !visited.has(neighbor.index));
    if (!options.length) { stack.pop(); continue; }
    const pick = options[Math.floor(random() * options.length)];
    visited.add(pick.index);
    adjacency.get(current)!.push(pick.index);
    adjacency.get(pick.index)!.push(current);
    stack.push(pick.index);
  }
  return adjacency;
}

function knotTreePath(adjacency: Map<number, number[]>, from: number, to: number): number[] {
  const parent = new Map<number, number>();
  const visited = new Set<number>([from]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) break;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      parent.set(next, current);
      queue.push(next);
    }
  }
  const path = [to];
  let cursor = to;
  while (cursor !== from) {
    const prev = parent.get(cursor);
    if (prev === undefined) return [];
    path.push(prev);
    cursor = prev;
  }
  return path.reverse();
}

const KNOT_DECOY_SHAPES: Direction[][] = [
  ["N"], ["E"], ["S"], ["W"],
  ["N", "S"], ["E", "W"],
  ["N", "E"], ["E", "S"], ["S", "W"], ["W", "N"],
];

function buildKnotCandidate(seed: number, mastery: number): KnotLevel {
  const random = rng(seed);
  const adjacency = buildKnotSpanningTree(random);
  const targetPath = knotTreePath(adjacency, KNOT_SOURCE_INDEX, KNOT_TARGET_INDEX);
  const pathSet = new Set(targetPath);

  const branchCandidates = targetPath.slice(1, -1).flatMap(cell =>
    (adjacency.get(cell) ?? []).filter(neighbor => !pathSet.has(neighbor)).map(neighbor => ({ branch: cell, bonus: neighbor })));
  const chosenBranch = mastery >= 2 && branchCandidates.length > 0
    ? branchCandidates[Math.floor(random() * branchCandidates.length)]
    : null;

  const tileShapes: Direction[][] = Array.from({ length: 16 }, () => [] as Direction[]);
  for (let i = 0; i < targetPath.length; i += 1) {
    const cell = targetPath[i];
    const dirs: Direction[] = [];
    if (i > 0) dirs.push(knotDirectionBetween(cell, targetPath[i - 1]));
    if (i < targetPath.length - 1) dirs.push(knotDirectionBetween(cell, targetPath[i + 1]));
    if (chosenBranch && chosenBranch.branch === cell) dirs.push(knotDirectionBetween(cell, chosenBranch.bonus));
    tileShapes[cell] = dirs;
  }
  if (chosenBranch) tileShapes[chosenBranch.bonus] = [knotDirectionBetween(chosenBranch.bonus, chosenBranch.branch)];

  const criticalSet = new Set([...targetPath, ...(chosenBranch ? [chosenBranch.bonus] : [])]);
  for (let i = 0; i < 16; i += 1) {
    if (criticalSet.has(i)) continue;
    tileShapes[i] = KNOT_DECOY_SHAPES[Math.floor(random() * KNOT_DECOY_SHAPES.length)];
  }

  const rotations = Array.from({ length: 16 }, (_, i) => {
    if (i === KNOT_SOURCE_INDEX || i === KNOT_TARGET_INDEX) return 0;
    if (criticalSet.has(i)) return 1 + Math.floor(random() * 3); // hiçbir zaman 0 — her kritik karo en az 1 tık ister
    return Math.floor(random() * 4);
  });

  const criticalNonLocked = Array.from(criticalSet).filter(cell => cell !== KNOT_SOURCE_INDEX && cell !== KNOT_TARGET_INDEX);
  const requiredTurns = criticalNonLocked.reduce((total, cell) => total + (4 - rotations[cell]) % 4, 0);
  const margin = 3 + Math.ceil(requiredTurns * 0.5);

  return {
    tileShapes,
    rotations,
    sourceIndex: KNOT_SOURCE_INDEX,
    targetIndex: KNOT_TARGET_INDEX,
    targetPath,
    bonusIndex: chosenBranch ? chosenBranch.bonus : -1,
    bonusPath: chosenBranch ? [chosenBranch.branch, chosenBranch.bonus] : [],
    heatLimit: requiredTurns + margin,
    lesson: mastery >= 3 ? "Hedefe giden yolu kur; sonra fazla akışı bonus düğüme taşı." : "Her dönüş, akışın nereye kaçtığını değiştirir.",
  };
}

export function generateKnotLevel(seed: number, mastery: number): KnotLevel {
  let fallback: KnotLevel | null = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = buildKnotCandidate(seed + attempt * 7919, mastery);
    if (!isKnotLevelSolvable(candidate)) continue;
    if (!fallback) fallback = candidate;
    if (mastery < 2 || candidate.bonusIndex >= 0) return candidate; // mastery>=2 için bonuslu bir dal bulunana kadar dene
  }
  return fallback ?? buildKnotCandidate(seed, mastery);
}

function knotRotatedDirs(base: Direction[], rot: number): Direction[] {
  return base.map(dir => KNOT_DIRECTION_ORDER[(KNOT_DIRECTION_ORDER.indexOf(dir) + rot) % 4]);
}

export function knotConnectivity(tileShapes: Direction[][], rotations: number[]): Set<number> {
  const visited = new Set<number>([KNOT_SOURCE_INDEX]);
  const queue = [KNOT_SOURCE_INDEX];
  while (queue.length) {
    const current = queue.shift()!;
    for (const dir of knotRotatedDirs(tileShapes[current], rotations[current])) {
      const [dr, dc] = KNOT_STEP[dir];
      const r = Math.floor(current / KNOT_COLS) + dr;
      const c = (current % KNOT_COLS) + dc;
      if (r < 0 || r >= KNOT_ROWS || c < 0 || c >= KNOT_COLS) continue;
      const neighbor = r * KNOT_COLS + c;
      if (!knotRotatedDirs(tileShapes[neighbor], rotations[neighbor]).includes(KNOT_OPPOSITE[dir])) continue;
      if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
    }
  }
  return visited;
}

export function isKnotLevelSolvable(level: KnotLevel) {
  if (level.rotations.length !== 16 || level.tileShapes.length !== 16) return false;
  if (level.targetPath[0] !== level.sourceIndex || level.targetPath[level.targetPath.length - 1] !== level.targetIndex) return false;
  // "Çözüldü" durumunu simüle et: kritik karolar rotasyon 0'da (tileShapes zaten o dönüşte gereken yönleri tutar).
  const solvedRotations = level.rotations.map((rotation, index) =>
    index === level.sourceIndex || index === level.targetIndex || level.targetPath.includes(index) || index === level.bonusIndex
      ? 0
      : rotation);
  const connected = knotConnectivity(level.tileShapes, solvedRotations);
  const targetOk = connected.has(level.targetIndex);
  const bonusOk = level.bonusIndex < 0 || connected.has(level.bonusIndex);
  const criticalNonLocked = Array.from(new Set([...level.targetPath, ...(level.bonusIndex >= 0 ? [level.bonusIndex] : [])]))
    .filter(cell => cell !== level.sourceIndex && cell !== level.targetIndex);
  const requiredTurns = criticalNonLocked.reduce((total, cell) => total + (4 - level.rotations[cell]) % 4, 0);
  return targetOk && bonusOk && requiredTurns <= level.heatLimit;
}

export type CutShapePlan = { id: number; x: number; y: number; size: number; color: string; target: boolean; linked: boolean };
export type CutLevel = { shapes: CutShapePlan[]; cuts: number; stainLimit: number; lesson: string };

export function generateCutLevel(seed: number, mastery: number): CutLevel {
  const random = rng(seed ^ 0x9e3779b9);
  const slots = [
    [18, 12], [35, 13], [53, 10], [74, 15], [24, 28], [47, 28], [66, 30], [15, 44], [38, 45], [57, 43], [79, 44],
  ] as const;
  const palette = ["#e9563f", "#e5b341", "#f6f0e3", "#66b8a0"];
  const desired = Math.min(4, 2 + mastery);
  const shapes = slots.slice(0, 7 + mastery).map(([baseX, baseY], id) => ({
    id,
    x: baseX + Math.round((random() - .5) * 6),
    y: baseY + Math.round((random() - .5) * 5),
    size: 3.5 + Math.round(random() * 2),
    color: palette[id % palette.length],
    target: id < desired,
    linked: mastery >= 3 && id > 0 && id < desired && id % 2 === 1,
  }));
  return { shapes, cuts: mastery >= 3 ? 3 : 4, stainLimit: 1 + Math.floor(mastery / 2), lesson: mastery >= 3 ? "Bağlı hedefleri aynı kesimde ayırırsan mürekkep zincirlenir." : "Hedef şekilleri tek, kararlı çizgide topla." };
}

function segmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x; const dy = b.y - a.y; const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function isCutLevelSolvable(level: CutLevel) {
  const targets = level.shapes.filter(shape => shape.target);
  const candidates: Array<{ a: Point; b: Point }> = [];
  for (const shape of targets) {
    candidates.push({ a: { x: shape.x - shape.size, y: shape.y }, b: { x: shape.x + shape.size, y: shape.y } });
    candidates.push({ a: { x: shape.x, y: shape.y - shape.size }, b: { x: shape.x, y: shape.y + shape.size } });
  }
  for (let left = 0; left < targets.length; left += 1) {
    for (let right = left + 1; right < targets.length; right += 1) candidates.push({ a: targets[left], b: targets[right] });
  }
  const effects = candidates.map(candidate => {
    const hit = level.shapes.filter(shape => segmentDistance(shape, candidate.a, candidate.b) < shape.size / 2 + 2);
    return { targetIds: hit.filter(shape => shape.target).map(shape => shape.id), stains: hit.filter(shape => !shape.target).length };
  }).filter(effect => effect.targetIds.length > 0 && effect.stains <= level.stainLimit);
  const targetKey = targets.map(shape => shape.id).sort((a, b) => a - b).join(",");
  const visited = new Set<string>();
  const search = (covered: number[], cuts: number, stains: number): boolean => {
    const unique = Array.from(new Set(covered)).sort((a, b) => a - b);
    if (unique.join(",") === targetKey) return true;
    if (cuts === 0) return false;
    const state = `${unique.join(",")}/${cuts}/${stains}`; if (visited.has(state)) return false; visited.add(state);
    return effects.some(effect => stains + effect.stains <= level.stainLimit && search([...unique, ...effect.targetIds], cuts - 1, stains + effect.stains));
  };
  return search([], level.cuts, 0);
}

export type ShadowLevel = { size: number; pads: Point[]; exit: Point; inverseTiles: Point[]; lag: number; lesson: string };

export function generateShadowLevel(seed: number, mastery: number): ShadowLevel {
  const size = mastery >= 3 ? 6 : 5;
  const side = 1 + indexFor(seed, 79, size - 2);
  return {
    size,
    pads: [{ x: side, y: 1 }, { x: side, y: size - 2 }],
    exit: { x: size - 1, y: size - 1 },
    inverseTiles: mastery >= 3 ? [{ x: Math.floor(size / 2), y: 1 + indexFor(seed, 103, size - 3) }] : [],
    lag: mastery >= 4 ? 3 : 2,
    lesson: mastery >= 3 ? "Işık plağından geçen gölge yön değiştirir; sonraki üç hamleni önceden düşün." : "Gölgen iki hamle geride. İki pedin üstünde aynı anda olman gerekmez." ,
  };
}

export function isShadowLevelSolvable(level: ShadowLevel) {
  type ShadowPosition = { r: number; c: number };
  type State = { player: ShadowPosition; shadow: ShadowPosition; history: Array<[number, number]>; open: boolean };
  const at = (position: ShadowPosition, point: Point) => position.c === point.x && position.r === point.y;
  const onPad = (position: ShadowPosition) => level.pads.some(point => at(position, point));
  const inverse = (position: ShadowPosition) => level.inverseTiles.some(point => at(position, point));
  const keyFor = (state: State) => `${state.player.r},${state.player.c}/${state.shadow.r},${state.shadow.c}/${state.history.map(move => move.join(":")).join("|")}/${state.open ? 1 : 0}`;
  const queue: Array<State & { steps: number }> = [{ player: { r: 0, c: 0 }, shadow: { r: 0, c: 0 }, history: [], open: false, steps: 0 }];
  const seen = new Set([keyFor(queue[0])]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.open && at(current.player, level.exit)) return true;
    if (current.steps >= 48) continue;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Array<[number, number]>) {
      const player = { r: clamp(current.player.r + dr, 0, level.size - 1), c: clamp(current.player.c + dc, 0, level.size - 1) };
      if (player.r === current.player.r && player.c === current.player.c) continue;
      let shadow = current.shadow;
      if (current.history.length >= level.lag) {
        const [lagDr, lagDc] = current.history[0]; const factor = inverse(current.shadow) ? -1 : 1;
        shadow = { r: clamp(current.shadow.r + lagDr * factor, 0, level.size - 1), c: clamp(current.shadow.c + lagDc * factor, 0, level.size - 1) };
      }
      const history = [...current.history, [dr, dc] as [number, number]].slice(-level.lag);
      const open = current.open || (onPad(player) && onPad(shadow) && (player.r !== shadow.r || player.c !== shadow.c));
      const next = { player, shadow, history, open, steps: current.steps + 1 }; const key = keyFor(next);
      if (!seen.has(key)) { seen.add(key); queue.push(next); }
    }
  }
  return false;
}

export type SuspectId = string;
export type ClueId = string;

export type Suspect = { id: SuspectId; name: string; statement: string };

export type VakaClue = {
  id: ClueId;
  label: string;
  detail: string;
  /** Sunulduğunda bu şüpheliyi suçlar (ifadesiyle çelişir). */
  contradicts?: SuspectId;
  /** Sunulduğunda bu şüpheliyi temizler (ifadesini doğrular). */
  clears?: SuspectId;
  /** contradicts/clears'ı yoksa true olmalı — nötr, yanıltıcı kart. */
  isRedHerring: boolean;
  /** Yalnız contradicts kanıtlarında dolu — çelişkinin türü (mekansal/nesne/sayısal). */
  contradictionType?: VakaContradictionType;
};

export type VakaCase = {
  id: string;
  /** Vakanın açılışında gösterilen olay özeti (mağdur/mekân/zaman) — oyuncu şüpheli kartlarını görmeden önce ne olduğunu bilir. */
  briefing: string;
  briefingEn: string;
  suspects: Suspect[];
  clues: VakaClue[];
  culpritId: SuspectId;
  hint: string;
  clueCost: number;
  /** Kaç kanıt kartı başlangıçta açık gösterilir — kalanı "ipucu iste" ile açılır. */
  revealCount: number;
};

export type VakaVerdict = "correct" | "wrong-suspect" | "no-contradiction";

const VAKA_NAMES = ["K. Demir", "A. Sarı", "M. Ekin", "R. Toprak", "S. Yıldız", "N. Aksoy", "B. Kaya", "E. Çelik"];
const VAKA_INCIDENTS = [
  { tr: "kasadan bir yüzük çalındı", en: "a ring was stolen from the safe" },
  { tr: "arşivdeki imzalı bir belge tahrif edildi", en: "a signed document in the archive was forged" },
  { tr: "vitrin camı kırılıp içindeki saat alındı", en: "the display case was broken and the watch inside was taken" },
  { tr: "kilitli çekmeceden nakit para kayboldu", en: "cash went missing from a locked drawer" },
  { tr: "duvardaki tablo yerinden sökülüp götürüldü", en: "a painting was taken off the wall" },
];
const VAKA_LOCATIONS = ["atölye", "depo", "sahne arkası", "arşiv odası", "bahçe", "kütüphane", "mutfak"];
const VAKA_TIMES = ["18:00", "18:20", "18:40", "19:00", "19:20", "19:40"];
const VAKA_OBJECTS = ["ıslak boya lekesi", "kırık düğme", "toz izi", "özel bir anahtar", "imzalı bir not", "yırtık bir kumaş parçası"];
const VAKA_WITNESS_ROLES = ["Kapıcı", "Komşu dükkân sahibi", "Güvenlik görevlisi", "Bir müşteri", "Temizlikçi"];
const VAKA_MARKS = ["kendine özgü bir mühür izi", "tanınabilir bir el yazısı notu", "ayırt edici bir düğme deseni", "kendine özgü bir parfüm kokusu"];
export type VakaContradictionType = "spatial" | "object" | "numerical";
const VAKA_CONTRADICTION_TYPES: VakaContradictionType[] = ["spatial", "object", "numerical"];

type VakaScene = { location: string; timeslot: string };
type VakaClaim = { location: string; timeslot: string };

function pickN<T>(pool: T[], count: number, seed: number, salt: number) {
  const indices = new Set<number>();
  let attempt = 0;
  while (indices.size < count && attempt < count * 20) {
    indices.add(indexFor(seed, salt + attempt * 31, pool.length));
    attempt += 1;
  }
  // Havuz sayısı yetersizse (mastery çok yüksek/pool küçükse) kalanları sırayla tamamla
  for (let index = 0; indices.size < count && index < pool.length; index += 1) indices.add(index);
  return Array.from(indices).slice(0, count).map(index => pool[index]);
}

function claimFor(scene: VakaScene, seed: number, salt: number): VakaClaim {
  const otherLocations = VAKA_LOCATIONS.filter(location => location !== scene.location);
  const otherTimes = VAKA_TIMES.filter(timeslot => timeslot !== scene.timeslot);
  return {
    location: otherLocations[indexFor(seed, salt, otherLocations.length)],
    timeslot: otherTimes[indexFor(seed, salt + 7, otherTimes.length)],
  };
}

function difficultyFor(mastery: number) {
  const table = [
    { suspectCount: 3, redHerrings: 1, revealCount: 3, clueCost: 25, extraContradictions: 0 },
    { suspectCount: 4, redHerrings: 1, revealCount: 3, clueCost: 25, extraContradictions: 0 },
    { suspectCount: 4, redHerrings: 2, revealCount: 4, clueCost: 30, extraContradictions: 0 },
    { suspectCount: 5, redHerrings: 2, revealCount: 4, clueCost: 45, extraContradictions: 1 },
    { suspectCount: 6, redHerrings: 3, revealCount: 5, clueCost: 45, extraContradictions: 1 },
  ];
  return table[clamp(mastery, 0, table.length - 1)];
}

function contradictionFor(type: VakaContradictionType, seed: number, salt: number, culprit: Suspect, claim: VakaClaim, scene: VakaScene): { label: string; detail: string } {
  if (type === "object") {
    const mark = VAKA_MARKS[indexFor(seed, salt, VAKA_MARKS.length)];
    return {
      label: mark[0].toUpperCase() + mark.slice(1),
      detail: `${scene.location}'da bulunan eşyada ${mark} tespit edildi — bu iz yalnız ${culprit.name}'e ait, oysa kendisi "${claim.location}'daydım" diyor.`,
    };
  }
  if (type === "numerical") {
    const minutesOff = 15 + indexFor(seed, salt + 3, 4) * 10;
    return {
      label: "Giriş-çıkış kaydı",
      detail: `Kayıt defteri, ${culprit.name}'in ${scene.location}'dan ${scene.timeslot}'ten ${minutesOff} dakika SONRA çıktığını gösteriyor — "${claim.timeslot} civarı ayrıldım" ifadesiyle uyuşmuyor.`,
    };
  }
  const object = VAKA_OBJECTS[indexFor(seed, salt, VAKA_OBJECTS.length)];
  return {
    label: object[0].toUpperCase() + object.slice(1),
    detail: `${object[0].toUpperCase()}${object.slice(1)}, ${scene.location}'da ${scene.timeslot} civarında bulundu — bu, ${culprit.name}'in iddia ettiği ${claim.location} ile bağdaşmıyor.`,
  };
}

function buildCandidateCase(localSeed: number, caseIndex: number, diff: ReturnType<typeof difficultyFor>): VakaCase {
  const names = pickN(VAKA_NAMES, diff.suspectCount, localSeed, 3);
  const scene: VakaScene = {
    location: VAKA_LOCATIONS[indexFor(localSeed, 11, VAKA_LOCATIONS.length)],
    timeslot: VAKA_TIMES[indexFor(localSeed, 17, VAKA_TIMES.length)],
  };
  const culpritIndex = indexFor(localSeed, caseIndex * 13 + 7, names.length);

  const claims = names.map((_, i) => claimFor(scene, localSeed, 23 + i * 41));
  const suspects: Suspect[] = names.map((name, i) => ({
    id: `s${i}`,
    name,
    statement: `"O saatte ${claims[i].location}'daydım, ${claims[i].timeslot} civarı."`,
  }));

  const culpritId = suspects[culpritIndex].id;
  const culprit = suspects[culpritIndex];
  const culpritClaim = claims[culpritIndex];
  const incident = VAKA_INCIDENTS[indexFor(localSeed, 5, VAKA_INCIDENTS.length)];
  const briefing = `${scene.location}'da, ${scene.timeslot} civarında ${incident.tr}. O sırada binada ${suspects.length} kişi vardı; her birinin bir ifadesi var, ama yalnız biri yalan söylüyor.`;
  const briefingEn = `At the ${scene.location}, around ${scene.timeslot}, ${incident.en}. ${suspects.length} people were in the building at the time; each gave a statement, but only one of them is lying.`;

  // Ana çelişki kanıtı + (yüksek mastery'de) failin kendi özniteliklerinden türeyen bağımsız
  // ikinci bir çelişki noktası — alibi.holes[] deseni: fail birden fazla bağımsız kanıtla suçlanabilir.
  const contradictionCount = 1 + diff.extraContradictions;
  const usedTypes: VakaContradictionType[] = [];
  const contradictingClues: VakaClue[] = Array.from({ length: contradictionCount }, (_, i) => {
    const type = VAKA_CONTRADICTION_TYPES.filter(candidate => !usedTypes.includes(candidate))[
      indexFor(localSeed, 233 + i * 19, VAKA_CONTRADICTION_TYPES.length - usedTypes.length)
    ] ?? VAKA_CONTRADICTION_TYPES[0];
    usedTypes.push(type);
    const { label, detail } = contradictionFor(type, localSeed, 71 + i * 53, culprit, culpritClaim, scene);
    return { id: `c${i}`, label, detail, contradicts: culpritId, isRedHerring: false, contradictionType: type };
  });

  const clearingClues: VakaClue[] = suspects
    .filter(suspect => suspect.id !== culpritId)
    .map((suspect, i) => {
      const claim = claims[names.findIndex(name => name === suspect.name)];
      const witness = VAKA_WITNESS_ROLES[indexFor(localSeed, 89 + i * 13, VAKA_WITNESS_ROLES.length)];
      return {
        id: `g${i}`,
        label: "Tanık ifadesi",
        detail: `${witness}, ${suspect.name}'i ${claim.location}'da ${claim.timeslot} civarında gördüğünü doğruladı.`,
        clears: suspect.id,
        isRedHerring: false,
      };
    });

  const herrings: VakaClue[] = Array.from({ length: diff.redHerrings }, (_, i) => ({
    id: `h${i}`,
    label: "Olay yeri notu",
    detail: herringDetailFor(localSeed, i, scene),
    isRedHerring: true,
  }));

  const clueOrder = [...clearingClues.map((_, i) => i), ...Array.from({ length: diff.redHerrings }, (_, i) => diff.suspectCount - 1 + i)];
  const shuffledOrder = [...clueOrder].sort((a, b) => indexFor(localSeed, 131 + a, 997) - indexFor(localSeed, 131 + b, 997));
  const rest = [...clearingClues, ...herrings];
  const clues = [...contradictingClues, ...shuffledOrder.map(index => rest[index])];

  return {
    id: `${localSeed}:${caseIndex}`,
    briefing,
    briefingEn,
    suspects,
    clues,
    culpritId,
    hint: `Ek iz: ${suspects[culpritIndex].name}'in ifadesiyle olay yerindeki kanıtı karşılaştır.`,
    clueCost: diff.clueCost,
    revealCount: clamp(diff.revealCount, 1, clues.length),
  };
}

function herringDetailFor(seed: number, index: number, scene: VakaScene) {
  const filler = [
    `${scene.location} o akşam her zamankinden daha kalabalıktı.`,
    `Kapı kilidinde zorlanma izi yok — anahtarla girilmiş.`,
    `Aynı gece hava yağışlıydı, dış zeminde çamur izleri karışmış.`,
    `Güvenlik kamerası o gece bakımdaydı, görüntü yok.`,
  ];
  return filler[indexFor(seed, 191 + index * 17, filler.length)];
}

/**
 * Bağımsız solver: culpritId'yi BİLMEDEN, yalnız kanıt grafiğinden (contradicts/clears
 * bağlantılarından) failin kim olduğunu türetmeye çalışır — ai-murder-mystery-v2'nin
 * `culprit_score > rival_score` deseninden uyarlandı. Skor = şüpheliyi suçlayan (contradicts)
 * bağımsız kanıt sayısı; fail bu skorda HERKESTEN kesin olarak daha yüksek olmalı (eşitlik de
 * belirsizlik sayılır — "tam 1 kanıt" kuralından daha sağlam, çoklu çelişki kanıtına izin verir).
 * Çözülemezse veya belirsizse null döner.
 */
export function solveVakaCase(vakaCase: Pick<VakaCase, "suspects" | "clues">): SuspectId | null {
  const { suspects, clues } = vakaCase;
  const scoreOf = (suspectId: SuspectId) => clues.filter(clue => clue.contradicts === suspectId).length;
  const ranked = suspects.map(suspect => ({ id: suspect.id, score: scoreOf(suspect.id) }));
  const top = ranked.reduce((best, entry) => (entry.score > best.score ? entry : best), ranked[0]);
  if (!top || top.score === 0) return null;
  if (ranked.some(entry => entry.id !== top.id && entry.score >= top.score)) return null; // tekillik yok

  const others = suspects.filter(suspect => suspect.id !== top.id);
  if (!others.every(suspect => clues.some(clue => clue.clears === suspect.id))) return null; // her masumun doğrulanmış alibisi olmalı
  if (clues.some(clue => clue.clears === top.id)) return null; // fail'in kendisi temizlenmiş olamaz

  return top.id;
}

export function isVakaCaseSolvable(vakaCase: VakaCase): boolean {
  if (!vakaCase.clues.filter(clue => clue.isRedHerring).every(clue => !clue.contradicts && !clue.clears)) return false;
  return solveVakaCase(vakaCase) === vakaCase.culpritId;
}

function fallbackGuaranteedCase(seed: number, caseIndex: number, diff: ReturnType<typeof difficultyFor>): VakaCase {
  // Güvenlik ağı: buildCandidateCase kendi kuruluşu gereği zaten her zaman çözülebilir
  // üretmeli (bkz. levelGenerators.test.ts), bu yalnız beklenmeyen bir regresyona karşı düşer.
  return buildCandidateCase(seed + caseIndex * 9973, caseIndex, diff);
}

export function generateVakaCases(seed: number, mastery: number): VakaCase[] {
  const diff = difficultyFor(mastery);
  return Array.from({ length: 3 + mastery }, (_, caseIndex) => {
    let attempt = 0;
    let built: VakaCase | null = null;
    while (!built && attempt < 12) {
      const localSeed = seed + caseIndex * 97 + attempt * 131;
      const candidate = buildCandidateCase(localSeed, caseIndex, diff);
      if (isVakaCaseSolvable(candidate)) built = candidate;
      attempt += 1;
    }
    return built ?? fallbackGuaranteedCase(seed, caseIndex, diff);
  });
}

export function evaluateVakaAttempt(vakaCase: VakaCase, accusedId: SuspectId, presentedClueId: ClueId): VakaVerdict {
  const clue = vakaCase.clues.find(item => item.id === presentedClueId);
  if (!clue || clue.contradicts !== accusedId) return clue?.clears === accusedId ? "wrong-suspect" : "no-contradiction";
  return accusedId === vakaCase.culpritId ? "correct" : "wrong-suspect";
}

export type SparkEventType = "stamp" | "barrier" | "drop" | "gate";
export type SparkEvent = { id: number; at: number; drift: number; type: SparkEventType };
export type SparkLevel = { chapterDuration: number; speed: number; focus: number; events: SparkEvent[]; lesson: string };
export type SparkWorldSegment = { index: number; wind: number; events: SparkEvent[] };

export function generateSparkLevel(seed: number, mastery: number): SparkLevel {
  const random = rng(seed ^ 0x2f6e2b1);
  const chapterDuration = 20 + mastery * 2;
  const speed = 2.8 + mastery * .26;
  const focus = Math.max(2, 5 - Math.floor(mastery / 2));
  const events: SparkEvent[] = [];
  let at = 2.4;
  let id = 0;
  while (at < chapterDuration - 1.6) {
    const drift = Number((.14 + random() * .72).toFixed(2));
    const type: SparkEventType = id % 5 === 0 ? "stamp" : id % 4 === 0 ? "gate" : id % 3 === 0 ? "drop" : "barrier";
    events.push({ id, at: Number(at.toFixed(2)), drift, type });
    if (type !== "stamp" && random() > .48) events.push({ id: id + 100, at: Number((at + .46).toFixed(2)), drift: Number(Math.max(.1, Math.min(.9, drift + (random() > .5 ? .18 : -.18))).toFixed(2)), type: "stamp" });
    at += 1.16 - Math.min(.22, mastery * .04) + random() * .3;
    id += 1;
  }
  return { chapterDuration, speed, focus, events, lesson: mastery >= 3 ? "Her baskı sayfası yeniden döner: boşluğu önce gör, damgayı yalnız güvenli çizgide al." : "Koridor döngüsel akar: engeli erken oku, sonra serbest boşluğa süzül." };
}

export function sparkEscalationFor(segmentIndex: number) {
  return Number(clamp(1 + Math.max(0, segmentIndex) * .06, 1, 2.4).toFixed(3));
}

export function generateSparkWorldSegment(level: SparkLevel, index: number): SparkWorldSegment {
  const wind = Number(((((index * 7 + level.events.length) % 5) - 2) * .035).toFixed(3));
  const baseEvents = level.events.map(event => {
    const oscillation = (((index + event.id * 3) % 7) - 3) * .035;
    const drift = Number(clamp(event.drift + wind + oscillation, .08, .92).toFixed(2));
    return { ...event, drift };
  });
  // Mesafeye göre gerçek zorluk artışı: derindeki bölümlere deterministik ekstra tehlike enjekte edilir
  // (isSparkLevelFair yalnız temel generateSparkLevel çıktısını doğrular, bu ek akış ondan bağımsızdır).
  const escalation = sparkEscalationFor(index);
  const extraCount = Math.floor((escalation - 1) * 5);
  const extraEvents: SparkEvent[] = Array.from({ length: extraCount }, (_, slot) => {
    const t = ((index * 13 + slot * 37) % 97) / 97;
    const at = Number((level.chapterDuration * (.18 + t * .64)).toFixed(2));
    const drift = Number(clamp(.14 + ((index * 7 + slot * 19) % 71) / 71 * .72, .1, .9).toFixed(2));
    return { id: 900 + slot, at, drift, type: slot % 2 === 0 ? "barrier" : "gate" };
  });
  return { index, wind, events: [...baseEvents, ...extraEvents] };
}

export function isSparkLevelFair(level: SparkLevel) {
  const hazards = level.events.filter(event => event.type !== "stamp");
  return hazards.every((event, index) => (index === 0 || event.at - hazards[index - 1].at >= .82) && event.drift >= .1 && event.drift <= .9) && level.events.some(event => event.type === "stamp") && level.events.at(-1)!.at < level.chapterDuration;
}

export function validateDailySeed(seed: number, gameId: GameId) {
  const mastery = 2;
  if (gameId === "echo") return isEchoLevelSolvable(generateEchoLevel(seed, mastery));
  if (gameId === "knot") return isKnotLevelSolvable(generateKnotLevel(seed, mastery));
  if (gameId === "cut") return isCutLevelSolvable(generateCutLevel(seed, mastery));
  if (gameId === "shadow") return isShadowLevelSolvable(generateShadowLevel(seed, mastery));
  if (gameId === "spark") return isSparkLevelFair(generateSparkLevel(seed, mastery));
  if (gameId === "vaka") return generateVakaCases(seed, mastery).every(isVakaCaseSolvable);
  return true;
}

export { pointKey };
