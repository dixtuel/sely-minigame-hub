export type BreaklinePowerupKind = "wide" | "multiball" | "slow" | "boost";

export const BREAKLINE_POWERUP_DROP_CHANCE = 0.1;
export const BREAKLINE_POWERUP_COOLDOWN = 2.8;
export const BREAKLINE_MAX_POWERUPS_PER_RUN = 8;
export const BREAKLINE_MAX_BALLS = 3;
export const BREAKLINE_MAX_BALL_SPEED = 520;
export const BREAKLINE_MAX_EFFECTIVE_SPEED = 560;

export const BREAKLINE_POWERUP_DURATION: Record<
  Exclude<BreaklinePowerupKind, "multiball">,
  number
> = {
  wide: 7,
  slow: 6,
  boost: 4.5,
};

export function breaklinePowerupFromRoll(roll: number): BreaklinePowerupKind {
  const value = Number.isFinite(roll)
    ? Math.max(0, Math.min(0.999999999, roll))
    : 0.999999999;
  if (value < 0.34) return "wide";
  if (value < 0.6) return "multiball";
  if (value < 0.85) return "slow";
  return "boost";
}

export function breaklineEffectiveSpeed(
  speed: number,
  modifier: number
): number {
  return Math.min(BREAKLINE_MAX_EFFECTIVE_SPEED, Math.max(1, speed) * modifier);
}

export function breaklineNextBallSpeed(speed: number): number {
  return Math.min(BREAKLINE_MAX_BALL_SPEED, speed + 5);
}

export function breaklineAvailableBallSlots(currentBallCount: number): number {
  const count = Number.isFinite(currentBallCount)
    ? Math.max(0, Math.trunc(currentBallCount))
    : BREAKLINE_MAX_BALLS;
  return Math.max(0, BREAKLINE_MAX_BALLS - count);
}

export function breaklineSplitDirections(
  vx: number,
  vy: number,
  availableSlots: number
) {
  const count = Number.isFinite(availableSlots)
    ? Math.max(0, Math.min(2, Math.trunc(availableSlots)))
    : 0;
  const baseAngle = Math.atan2(vy, vx);
  const spread = 0.38;
  return Array.from({ length: count }, (_, index) => {
    const offset = index === 0 ? -spread : spread;
    const angle = baseAngle + offset;
    return { vx: Math.cos(angle), vy: Math.sin(angle) };
  });
}
