import { mulberry32 } from "@/lib/rng";

export const COIL_GRID = 20;

export interface CoilPoint {
  x: number;
  y: number;
}

export interface CoilMilestone {
  /** Total fruit collected when this pace tier begins. */
  fruitCount: number;
  /** Step time in seconds; lower is faster. */
  stepSeconds: number;
  bonus: number;
}

export interface CoilRunConfig {
  initialFood: CoilPoint;
  milestones: readonly CoilMilestone[];
}

const MILESTONE_FRUIT_COUNTS = [5, 10, 16, 23, 31, 40, 50, 62] as const;

/** Seeded classic Snake setup: clear 20×20 board, fruit start, and endless pace tiers. */
export function generateCoilRun(seed: number, mastery = 0): CoilRunConfig {
  const random = mulberry32(seed ^ 0x434f494c);
  const initialFood = {
    x: Math.floor(random() * COIL_GRID),
    y: Math.floor(random() * COIL_GRID),
  };

  // Keep the first fruit away from the three-cell spawn so a new run is immediately playable.
  if (initialFood.y === 10 && initialFood.x >= 7 && initialFood.x <= 13) {
    initialFood.x = initialFood.x < 10 ? 5 : 15;
  }

  return {
    initialFood,
    milestones: MILESTONE_FRUIT_COUNTS.map((fruitCount, index) => ({
      fruitCount,
      stepSeconds: Math.max(0.09, 0.205 - index * 0.014 - Math.max(0, mastery) * 0.004),
      bonus: 15 + index * 5,
    })),
  };
}
