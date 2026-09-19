import { Point } from "./shared";
import { mulberry32 as rng } from "../rng";
import { segmentDistance } from "../geometry";

export type CutShapePlan = { id: number; x: number; y: number; size: number; color: string; target: boolean; linked: boolean };
export type CutLevel = { shapes: CutShapePlan[]; cuts: number; stainLimit: number; lesson: string };

/**
 * Şekillerin yerleşimi ve HANGİ şekillerin hedef olduğu artık gerçekten seed'e göre değişiyor —
 * eskiden `slots` sabit bir 11-konumluk diziydi, yalnız ±3/±2.5 birimlik önemsiz bir titreşim
 * uygulanıyordu ve hedefler her zaman dizideki İLK N eleman oluyordu (seed'in gerçek etkisi yoktu,
 * "hep aynı yerlerde" şikayeti buradan geliyordu). Şimdi konumlar reddetme-örneklemeyle (rejection
 * sampling, minimum aralıkla) tuvale rastgele yerleştiriliyor, hedef kümesi seed'e göre karıştırılan
 * bir sıradan seçiliyor, ve tüm aday sonuç generateCutLevel'da isCutLevelSolvable ile doğrulanıp
 * gerekirse yeni bir seed ofsetiyle yeniden üretiliyor (Echo/Knot/Vaka'daki "üret→doğrula→tekrar
 * dene" deseniyle aynı).
 */
function buildCutLevelCandidate(seed: number, mastery: number): CutLevel {
  const random = rng(seed ^ 0x9e3779b9);
  const palette = ["#e9563f", "#e5b341", "#f6f0e3", "#66b8a0"];
  const count = 7 + mastery;
  const desired = Math.min(4, 2 + mastery);
  const minGap = 13;
  const points: Point[] = [];
  for (let index = 0; index < count; index += 1) {
    let placed: Point | null = null;
    for (let tries = 0; tries < 40 && !placed; tries += 1) {
      const candidate = { x: 10 + random() * 80, y: 8 + random() * 40 };
      if (points.every(existing => Math.hypot(existing.x - candidate.x, existing.y - candidate.y) >= minGap)) placed = candidate;
    }
    // 40 denemede boşluk bulunamazsa (çok yoğun tuval) ızgaraya düş — asla çakışma riski kalmaz.
    points.push(placed ?? { x: 12 + (index % 6) * 13, y: 10 + Math.floor(index / 6) * 18 });
  }
  const order = points.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const targetIds = new Set(order.slice(0, desired));
  const linkedIds = new Set(mastery >= 3 ? order.slice(0, desired).filter((_, index) => index % 2 === 1) : []);
  const shapes = points.map((point, id) => ({
    id,
    x: Math.round(point.x),
    y: Math.round(point.y),
    size: 3.5 + Math.round(random() * 2),
    color: palette[id % palette.length],
    target: targetIds.has(id),
    linked: linkedIds.has(id),
  }));
  return { shapes, cuts: mastery >= 3 ? 3 : 4, stainLimit: 1 + Math.floor(mastery / 2), lesson: mastery >= 3 ? "Bağlı hedefleri aynı kesimde ayırırsan mürekkep zincirlenir." : "Hedef şekilleri tek, kararlı çizgide topla." };
}

export function generateCutLevel(seed: number, mastery: number): CutLevel {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = buildCutLevelCandidate(seed + attempt * 6229, mastery);
    if (isCutLevelSolvable(candidate)) return candidate;
  }
  return buildCutLevelCandidate(seed, mastery);
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
