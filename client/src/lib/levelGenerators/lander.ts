/**
 * Lander Game Engine & Terrain Generator
 * Original physics from KilledByAPixel/LittleJS (Frank Force, MIT License)
 * Adapted to SELY MiniGame Hub modular architecture.
 */

export interface LanderTerrainPoint {
  x: number;
  y: number;
  isPad?: boolean;
}

export interface LanderState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians
  vAngle: number; // angular velocity
  fuel: number;
  alive: boolean;
  landed: boolean;
}

export const LANDER_CONFIG = {
  gravity: 0.045,
  mainThrust: 0.11,
  rotationSpeed: 0.012, // Controlled angular acceleration (fixed wild spinning)
  angleDamping: 0.90, // Strong angular damping so ship stabilizes when keys released
  maxAngularVelocity: 0.045, // Absolute ceiling on rotation speed (rad/frame)
  maxLandingAngle: 0.22, // radians (~12.6 degrees)
  // Derived from the original LittleJS landerGame.js's relative tolerance, not picked
  // arbitrarily: the original allows freefall crash-speed (velocity.length() < .05) to
  // build up for ~50 frames under its gravity (.001/frame) before a touchdown becomes
  // unsafe. SELY's gravity (0.045/frame) is much stronger, so matching that same ~50-frame
  // grace window means maxLandingSpeed = gravity * 50 ≈ 2.25 — the previous 1.5 gave only
  // ~33 frames of grace, i.e. a *tighter* margin than the original despite reading as a
  // bigger number, which made "land slowly" nearly unachievable regardless of piloting.
  maxLandingSpeed: 2.25,
  initialFuel: 100,
};

/**
 * Generates deterministic terrain with a flat landing pad
 */
export function generateLanderTerrain(seed: number, width: number, height: number): { points: LanderTerrainPoint[]; padX: number; padWidth: number; padY: number } {
  let rngVal = (seed ^ 0x517cc1b7) >>> 0;
  const nextRng = () => {
    rngVal = (Math.imul(rngVal, 1664525) + 1013904223) >>> 0;
    return rngVal / 4294967296;
  };

  const segments = 24;
  const step = width / segments;
  const points: LanderTerrainPoint[] = [];

  // Pad location (somewhere between 35% and 65% of width)
  const padIndex = 8 + Math.floor(nextRng() * (segments - 14));
  const padSegments = 3;
  const padY = height - 90 - nextRng() * 40;

  let currentY = height - 120;

  for (let i = 0; i <= segments; i++) {
    const x = i * step;
    let y = currentY;

    if (i >= padIndex && i <= padIndex + padSegments) {
      y = padY;
      points.push({ x, y, isPad: true });
    } else {
      currentY += (nextRng() - 0.5) * 60;
      currentY = Math.max(height - 240, Math.min(height - 50, currentY));
      points.push({ x, y: currentY, isPad: false });
    }
  }

  const padX = padIndex * step;
  const padWidth = padSegments * step;

  return { points, padX, padWidth, padY };
}
