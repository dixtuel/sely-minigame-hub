export type CoilSwipeDirection = "left" | "right" | "up" | "down";

export function directionFromCoilSwipe(dx: number, dy: number, threshold = 22): CoilSwipeDirection | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}
