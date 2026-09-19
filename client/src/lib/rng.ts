/**
 * Seeded PRNG (mulberry32) shared by levelGenerators.ts, game/proceduralLevel.ts,
 * and SparkCanvasGame.tsx — all three previously reimplemented the same algorithm
 * independently. Verified byte-for-byte identical output for every non-zero seed
 * across all three prior implementations; this version additionally guards
 * against a seed of exactly 0 (which the levelGenerators/proceduralLevel copies
 * already did, coercing it to 1 instead of degenerating).
 */
export function mulberry32(seed: number): () => number {
  let value = (seed >>> 0) || 1;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
