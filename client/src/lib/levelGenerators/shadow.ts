import { Point, clamp, indexFor } from "./shared";
import { mulberry32 as rng } from "../rng";

export type ShadowLevel = {
  size: number;
  pads: Point[];
  exit: Point;
  inverseTiles: Point[];
  lag: number;
  lesson: string;
  lessonEn?: string;
};

/**
 * Gölge Payı (Shadow) seviye üreteci:
 * Oyuncu ile gecikmeli gölge (lag: 2 veya 3 adım) koordineli olarak tahtadaki iki baskı pedine
 * aynı anda basmalıdır. Ped B, Ped A'dan tam olarak `lag` adımda erişilebilecek konumlara
 * yerleştirilir. Böylece oyuncu bir pedden diğerine kesintisiz yürüdüğünde gölge ilk pede varır
 * ve kapı doğal olarak açılır (yapay bekleme hamlesi gerekmez). Çözücü (BFS) 4 yönde seviyenin
 * 12 denemede kesinlikle kazanılabilir olduğunu doğrular.
 */
function buildShadowLevelCandidate(seed: number, mastery: number): ShadowLevel {
  const size = mastery >= 3 ? 6 : 5;
  const random = rng(seed ^ 0x5bd1e995);
  const lag = mastery >= 4 ? 3 : 2;

  // Çıkış noktası kenar boyunca seçilir
  const exitCandidates: Point[] = [];
  for (let i = 1; i < size; i += 1) {
    exitCandidates.push({ x: size - 1, y: i });
    exitCandidates.push({ x: i, y: size - 1 });
  }
  const exit = exitCandidates[indexFor(seed, 211, exitCandidates.length)];

  const inner = () => 1 + Math.floor(random() * (size - 2));
  const colA = inner();
  const rowA = inner();

  // Ped B: lag mesafesinde erişilebilir noktalar
  let offsets: Array<{ dx: number; dy: number }> = [];
  if (lag === 2) {
    offsets = [
      { dx: 2, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 0, dy: -2 },
      { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
    ];
  } else {
    // lag === 3
    offsets = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 3, dy: 0 }, { dx: -3, dy: 0 }, { dx: 0, dy: 3 }, { dx: 0, dy: -3 },
      { dx: 2, dy: 1 }, { dx: 2, dy: -1 }, { dx: -2, dy: 1 }, { dx: -2, dy: -1 },
      { dx: 1, dy: 2 }, { dx: 1, dy: -2 }, { dx: -1, dy: 2 }, { dx: -1, dy: -2 },
    ];
  }

  const validPadsB: Point[] = [];
  for (const off of offsets) {
    const bx = colA + off.dx;
    const by = rowA + off.dy;
    if (bx >= 0 && bx < size && by >= 0 && by < size) {
      if ((bx !== 0 || by !== 0) && (bx !== exit.x || by !== exit.y) && (bx !== colA || by !== rowA)) {
        validPadsB.push({ x: bx, y: by });
      }
    }
  }

  const padB = validPadsB.length > 0
    ? validPadsB[indexFor(seed, 937, validPadsB.length)]
    : { x: colA, y: clamp(rowA + (lag === 2 ? 2 : 1), 0, size - 1) };

  const inverseTiles: Point[] = mastery >= 3 ? [{ x: inner(), y: inner() }] : [];

  const lesson = mastery >= 3
    ? "Işık prizmasından geçen gölgenin yönü tersine döner. Gecikmeli gölgeni arkandan sürükleyerek iki pedi aynı anda aktif et."
    : `Gölgen ${lag} hamle geriden gelir. İki pedi eşleştirmek için bir pedden diğerine ${lag} adımda kesintisiz geç.`;

  const lessonEn = mastery >= 3
    ? "Crossing light prisms inverts the shadow's direction. Trace your steps so your delayed shadow matches both pads."
    : `Your shadow follows ${lag} steps behind. Walk from one pad to the other in exactly ${lag} steps to match both.`;

  return {
    size,
    pads: [{ x: colA, y: rowA }, padB],
    exit,
    inverseTiles,
    lag,
    lesson,
    lessonEn,
  };
}

export function generateShadowLevel(seed: number, mastery: number): ShadowLevel {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = buildShadowLevelCandidate(seed + attempt * 7331, mastery);
    if (isShadowLevelSolvable(candidate)) return candidate;
  }
  return buildShadowLevelCandidate(seed, mastery);
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

  // Sadece 4 yön (doğal ızgara hareketi, bekleme yok)
  const moves: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (queue.length) {
    const current = queue.shift()!;
    if (current.open && at(current.player, level.exit)) return true;
    if (current.steps >= 36) continue;

    for (const [dr, dc] of moves) {
      const player = {
        r: clamp(current.player.r + dr, 0, level.size - 1),
        c: clamp(current.player.c + dc, 0, level.size - 1),
      };

      if (player.r === current.player.r && player.c === current.player.c) continue;

      let shadow = current.shadow;
      if (current.history.length >= level.lag) {
        const [lagDr, lagDc] = current.history[0];
        const factor = inverse(current.shadow) ? -1 : 1;
        shadow = {
          r: clamp(current.shadow.r + lagDr * factor, 0, level.size - 1),
          c: clamp(current.shadow.c + lagDc * factor, 0, level.size - 1),
        };
      }

      const history = [...current.history, [dr, dc] as [number, number]].slice(-level.lag);
      const open = current.open || (onPad(player) && onPad(shadow) && (player.r !== shadow.r || player.c !== shadow.c));
      const next = { player, shadow, history, open, steps: current.steps + 1 };
      const key = keyFor(next);
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return false;
}
