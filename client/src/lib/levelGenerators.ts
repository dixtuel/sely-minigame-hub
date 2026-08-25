import type { GameId } from "./catalog";

export type Point = { x: number; y: number };

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
const haneLetters = (value: string) => Array.from(value.trim().toLocaleUpperCase("tr-TR"));
const HANE_WORD_GUESSES = new Set([...HANE_WORD_SOLUTIONS.map(entry => entry.word), ...HANE_WORD_EXTRA_GUESSES].map(word => haneLetters(word).join("")));

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
  const entry = HANE_WORD_SOLUTIONS[indexFor(seed ^ Math.imul(mastery + 31, 0x27d4eb2d), 71 + mastery * 19, HANE_WORD_SOLUTIONS.length)];
  return {
    length: 5,
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
  const variation = indexFor(seed, 17, 3);
  const cols = mastery >= 3 ? 21 : 19;
  const rows = mastery >= 3 ? 15 : 13;
  const barriers = [4, 8, 12, 16];
  const openings = [[2 + variation, rows - 3], [4, rows - 4], [3 + variation, rows - 5], [5, rows - 3]];
  const walls = barriers.flatMap((x, barrierIndex) => Array.from({ length: rows }, (_, y) => ({ x, y })).filter(point => !openings[barrierIndex].includes(point.y)));
  const listenerRoute = [{ x: 9, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 2 }, { x: 9, y: 2 }];
  const checkpoints = [{ x: 2, y: rows - 3 }, { x: 6, y: 3 + variation }, { x: 10, y: rows - 3 }];
  return {
    cols,
    rows,
    key: mastery >= 2 ? { x: 14, y: 5 } : null,
    exit: { x: cols - 1, y: rows - 2 },
    checkpoints,
    listenerRoute,
    walls,
    fractures: [{ x: 6, y: rows - 5 }, { x: 14, y: rows - 4 }, ...(mastery >= 3 ? [{ x: 10, y: 6 }, { x: 18, y: 4 }] : [])],
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

export type KnotLevel = { rotations: number[]; bonusIndex: number; heatLimit: number; lesson: string };

export function generateKnotLevel(seed: number, mastery: number): KnotLevel {
  const rotations = Array.from({ length: 16 }, () => 0);
  const coreScramble = [1, 2, 5, 6, 10];
  const sideCandidates = [3, 4, 7, 8, 9, 12, 13, 14, 15];
  for (const index of coreScramble) rotations[index] = 3;
  const extraCount = Math.min(3, Math.max(0, mastery - 1));
  for (let offset = 0; offset < extraCount; offset += 1) rotations[sideCandidates[indexFor(seed, 211 + offset * 13, sideCandidates.length)]] = 3;
  return {
    rotations,
    bonusIndex: mastery >= 2 ? 5 : -1,
    heatLimit: 7 + mastery * 2,
    lesson: mastery >= 3 ? "Hedefe giden yolu kur; sonra fazla akışı bonus düğüme taşı." : "Her dönüş, akışın nereye kaçtığını değiştirir.",
  };
}

export function isKnotLevelSolvable(level: KnotLevel) {
  const targetPath = [0, 1, 2, 6, 10, 11];
  const bonusPath = level.bonusIndex >= 0 ? [1, 5] : [];
  const requiredRotations = Array.from(new Set([...targetPath, ...bonusPath]));
  const requiredTurns = requiredRotations.reduce((total, index) => total + ((4 - level.rotations[index]) % 4), 0);
  return level.rotations.length === 16
    && level.rotations.every(rotation => rotation >= 0 && rotation <= 3)
    && targetPath.every(index => Number.isInteger(level.rotations[index]))
    && (level.bonusIndex < 0 || level.bonusIndex === 5)
    && requiredTurns <= level.heatLimit;
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
  const side = indexFor(seed, 79, 2) === 0 ? 1 : size - 2;
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

type MarkerRule = { text: string; accepts: (trail: string[]) => boolean };
const rulePool: MarkerRule[] = [
  { text: "Hedef, iki kez sağa hareket eden tek işarettir.", accepts: trail => trail.filter(value => value === "→").length === 2 },
  { text: "Hedefin son adımı dikeydir.", accepts: trail => ["↑", "↓"].includes(trail.at(-1) ?? "") },
  { text: "Hedef, başladığı yöne geri dönmez.", accepts: trail => !trail.some((step, index) => (step === "→" && trail[index + 1] === "←") || (step === "←" && trail[index + 1] === "→") || (step === "↑" && trail[index + 1] === "↓") || (step === "↓" && trail[index + 1] === "↑")) },
  { text: "Hedef tam iki yön değiştirir.", accepts: trail => trail.slice(1).filter((step, index) => step !== trail[index]).length === 2 },
  { text: "Hedef yalnız yatay izlerden oluşur.", accepts: trail => trail.every(step => step === "→" || step === "←") },
];
const trailPool = [
  ["→", "→", "↓"], ["↑", "→", "↓"], ["→", "←", "→"], ["↓", "→", "→"], ["←", "←", "↑"], ["→", "↓", "←"], ["↑", "↑", "→"],
];

export type MarkerCase = { rules: string[]; hint: string; options: string[]; correct: number; clueCost: number };

function hintFor(rule: MarkerRule) {
  if (rule.text.includes("son adımı")) return "Ek iz: Son sembole odaklan; diğer adımlar dikkat dağıtıcı olabilir.";
  if (rule.text.includes("iki kez sağa")) return "Ek iz: Sağa giden okları tek tek say.";
  if (rule.text.includes("geri dönmez")) return "Ek iz: Bir adımın hemen ardından ters yön geliyorsa o iz elenir.";
  if (rule.text.includes("iki yön değiştirir")) return "Ek iz: Aynı yönde peş peşe giden adımlar yön değişimi sayılmaz.";
  return "Ek iz: Dikey bir işaret görürsen o seçeneği yeniden kontrol et.";
}

export function generateMarkerCases(seed: number, mastery: number): MarkerCase[] {
  const random = rng(seed ^ 0x51ed270b);
  return Array.from({ length: 3 + mastery }, (_, caseIndex) => {
    const first = rulePool[indexFor(seed, caseIndex * 13 + 11, rulePool.length)];
    const second = mastery >= 2 ? rulePool[indexFor(seed, caseIndex * 29 + 19, rulePool.length)] : null;
    const rules = [first, second].filter((rule): rule is MarkerRule => Boolean(rule && rule !== first ? true : rule === first)).slice(0, second === first ? 1 : 2);
    const candidates = [...trailPool].sort(() => random() - .5);
    let selected = candidates.filter(trail => rules.every(rule => rule.accepts(trail)));
    if (selected.length !== 1) {
      const solo = candidates.find(trail => first.accepts(trail)) ?? candidates[0];
      const rest = candidates.filter(trail => trail !== solo && !first.accepts(trail)).slice(0, 3);
      selected = [solo];
      candidates.splice(0, candidates.length, solo, ...rest);
      rules.splice(1);
    }
    const correctTrail = selected[0];
    const distractors = candidates.filter(trail => trail !== correctTrail).slice(0, 3);
    const options = [correctTrail, ...distractors].sort(() => random() - .5).map(trail => trail.join(" "));
    return { rules: rules.map(rule => rule.text), hint: hintFor(rules[0]), options, correct: options.indexOf(correctTrail.join(" ")), clueCost: mastery >= 3 ? 45 : 25 };
  });
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
  return generateMarkerCases(seed, mastery).every(item => item.correct >= 0 && item.options.length === 4);
}

export { pointKey };
