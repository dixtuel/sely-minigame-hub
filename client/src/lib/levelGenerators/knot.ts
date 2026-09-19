import { Direction } from "./shared";
import { mulberry32 as rng } from "../rng";

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
