/** Shared 2D geometry helpers used by the Cut game's slice-line logic. */
import { isWasmReady, wasm_segment_distance } from "./wasmBridge";

/** Shortest distance from `point` to the line segment a-b (Rust WASM accelerated). */
export function segmentDistance(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  if (isWasmReady()) {
    try {
      return wasm_segment_distance(point.x, point.y, a.x, a.y, b.x, b.y);
    } catch {
      // Fallback below
    }
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}
