import type { GameId } from "../catalog";

export type Point = { x: number; y: number };
export type Direction = "N" | "E" | "S" | "W";

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const indexFor = (seed: number, salt: number, length: number) => Math.abs(Math.imul(seed + salt, 1103515245)) % length;

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

export function pointKey(point: Point) { return `${point.x}-${point.y}`; }
