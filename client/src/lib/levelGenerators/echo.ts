import { Point, clamp, indexFor } from "./shared";

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

/**
 * Tam-doğru rotanın (0 hata, hiç geri dönmeden, hedefe en az gürültüyle ulaşan yol) gerçek
 * gürültü maliyetini Dijkstra ile bulur — isEchoLevelSolvable'daki düz BFS yalnız "ulaşılabilir mi"
 * sorusuna cevap verir, en düşük maliyetli yolu GARANTİ etmez (kuyruk gürültüye göre sıralı değil).
 * Bulunamazsa (teorik olarak yol yoksa) Infinity döner.
 */
export function echoMinimalNoise(level: Omit<EchoLevel, "noiseLimit">): number {
  type State = { point: Point; hasKey: boolean; checkpointMask: number };
  const stateKey = (s: State) => `${s.point.x}-${s.point.y}-${s.hasKey ? 1 : 0}-${s.checkpointMask}`;
  const listener = level.listenerRoute[0];
  const targetMask = (1 << level.checkpoints.length) - 1;
  const start: State = { point: { x: 0, y: 0 }, hasKey: !level.key, checkpointMask: 0 };
  const dist = new Map<string, number>([[stateKey(start), 0]]);
  let frontier: { state: State; noise: number }[] = [{ state: start, noise: 0 }];
  while (frontier.length) {
    frontier.sort((a, b) => a.noise - b.noise);
    const { state: current, noise } = frontier.shift()!;
    if (dist.get(stateKey(current)) !== noise) continue; // eskimiş kayıt, daha iyisi zaten bulundu
    if (current.hasKey && current.checkpointMask === targetMask && current.point.x === level.exit.x && current.point.y === level.exit.y) return noise;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const point = { x: current.point.x + dx, y: current.point.y + dy };
      if (point.x < 0 || point.y < 0 || point.x >= level.cols || point.y >= level.rows) continue;
      if (level.walls.some(wall => wall.x === point.x && wall.y === point.y)) continue;
      if (point.x === listener.x && point.y === listener.y) continue;
      const stepNoise = 1 + (level.fractures.some(fracture => fracture.x === point.x && fracture.y === point.y) ? 2 : 0);
      const nextNoise = noise + stepNoise;
      const hasKey = current.hasKey || Boolean(level.key && point.x === level.key.x && point.y === level.key.y);
      const checkpointIndex = level.checkpoints.findIndex(checkpoint => checkpoint.x === point.x && checkpoint.y === point.y);
      const checkpointMask = checkpointIndex >= 0 ? current.checkpointMask | (1 << checkpointIndex) : current.checkpointMask;
      const next: State = { point, hasKey, checkpointMask };
      const key = stateKey(next);
      const known = dist.get(key);
      if (known === undefined || nextNoise < known) { dist.set(key, nextNoise); frontier.push({ state: next, noise: nextNoise }); }
    }
  }
  return Infinity;
}

function buildEchoLevelCandidate(seed: number, mastery: number): EchoLevel {
  const cols = mastery >= 3 ? 15 : 13;
  const rows = mastery >= 3 ? 11 : 9;
  // Oda küçüldüğü için sabit sütun indeksleri yerine ustalık seviyesine göre iki dar-boyut
  // düzeni kullanılıyor; sütunlar (bariyer/iz/dinleyici/anahtar) birbirinden ayrık tutuluyor ki
  // hiçbiri aynı duvar sütununda kaybolmasın.
  const layout = mastery >= 3
    ? { barriers: [4, 8, 11], checkpointXs: [2, 6, 10], fractureXs: [2, 5, 7, 9, 13], listenerX: 9, keyX: 13, keyY: 5 }
    : { barriers: [3, 7, 10], checkpointXs: [2, 5, 9], fractureXs: [2, 4, 6, 8, 11], listenerX: 8, keyX: 11, keyY: 4 };
  const { barriers, checkpointXs, fractureXs, listenerX, keyX, keyY } = layout;
  // Her bariyer için bağımsız, seed'e bağlı iki açıklık (kenarlara çok yakın olmasın, birbirinden farklı olsun)
  const openingAt = (barrierIndex: number, slot: number) => 2 + indexFor(seed, 401 + barrierIndex * 53 + slot * 11, rows - 4);
  const openings = barriers.map((_, barrierIndex) => {
    const first = openingAt(barrierIndex, 0);
    const second = ((openingAt(barrierIndex, 1) + 1) % (rows - 4)) + 2; // first'ten garanti farklı
    return [first, second];
  });
  const walls = barriers.flatMap((x, barrierIndex) => Array.from({ length: rows }, (_, y) => ({ x, y })).filter(point => !openings[barrierIndex].includes(point.y)));
  const listenerRoute = [{ x: listenerX, y: 1 }, { x: listenerX + 1, y: 1 }, { x: listenerX + 1, y: 2 }, { x: listenerX, y: 2 }];
  const checkpointY = (salt: number) => 1 + indexFor(seed, salt, rows - 2);
  const checkpoints = [{ x: checkpointXs[0], y: checkpointY(457) }, { x: checkpointXs[1], y: checkpointY(461) }, { x: checkpointXs[2], y: checkpointY(463) }];
  const fractureAt = (salt: number) => ({ x: fractureXs[indexFor(seed, salt, 5)], y: 1 + indexFor(seed, salt + 5, rows - 2) });
  const shape: Omit<EchoLevel, "noiseLimit"> = {
    cols,
    rows,
    key: mastery >= 2 ? { x: keyX, y: keyY } : null,
    exit: { x: cols - 1, y: rows - 2 },
    checkpoints,
    listenerRoute,
    walls,
    fractures: [fractureAt(509), fractureAt(521), ...(mastery >= 3 ? [fractureAt(541), fractureAt(557)] : [])],
    viewport: { cols: 9, rows: 7 },
    pulseBudget: clamp(7 - mastery, 3, 6),
    lesson: mastery >= 3 ? "İzleri oda oda kaydet; kırılgan zeminin gürültüsünü dinleyicinin devriyesinden uzakta yönet." : "Harita aklında kalır. Uzun koridor karardığında yankıyı, kırılgan zemin gelmeden önce kullan.",
  };
  // Ses hakkı, bu haritanın 0-hatalı en kısa (en az gürültülü) çözüm rotasının gerçek
  // maliyetinden türetiliyor — ama tam o sayı değil, üzerine küçük bir hata payı ekleniyor
  // (rotanın %20'si, en az 4 en çok 14 gürültü) ki bir-iki yanlış adım oyunu bitirmesin.
  const minimalNoise = echoMinimalNoise(shape);
  const margin = clamp(Math.round(minimalNoise * 0.2), 4, 14);
  const noiseLimit = Number.isFinite(minimalNoise) ? minimalNoise + margin : margin;
  return { ...shape, noiseLimit };
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
