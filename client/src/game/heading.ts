const TWO_PI = Math.PI * 2;

export const movementYaw = (x: number, z: number) => Math.atan2(x, z);

export const shortestAngleDelta = (target: number, current: number) => {
  const delta = target - current;
  return Math.atan2(Math.sin(delta), Math.cos(delta));
};

export const stepFacingYaw = (current: number, x: number, z: number, delta: number, turnRate = 14) => {
  const target = movementYaw(x, z);
  const turn = 1 - Math.exp(-delta * turnRate);
  const next = current + shortestAngleDelta(target, current) * turn;
  return ((next + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
};
