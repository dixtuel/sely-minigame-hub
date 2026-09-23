export type LiftPlatformKind = "normal" | "moving" | "crumble" | "spring";

export interface LiftPlatform {
  x: number;
  y: number;
  width: number;
  kind: LiftPlatformKind;
  phase: number;
  direction: -1 | 1;
  moveRange: number;
  moveSpeed: number;
  used: boolean;
}

export const LIFT_PHYSICS = {
  gravity: 820,
  jumpBase: 480,
  playerRadius: 12,
  horizontalAcceleration: 1_900,
  reverseAcceleration: 2_800,
  brakingAcceleration: 2_400,
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** A bounded, height-aware pressure curve; mastery affects the starting point. */
export function liftDifficultyForRow(mastery: number, row: number) {
  const masteryOffset = (clamp(mastery, 1, 4) - 1) * 0.1;
  const ascent = Math.max(0, row - 3) / 100;
  return clamp(masteryOffset + ascent, 0, 1);
}

/** Jump speed grows with ascent, but caps so late-run physics stay predictable. */
export function liftJumpSpeed(mastery: number, score = 0) {
  return (
    LIFT_PHYSICS.jumpBase +
    clamp(mastery, 0, 4) * 18 +
    Math.min(128, Math.max(0, score) * 0.04)
  );
}

/** Input speed gets a gentle score ramp while remaining bounded on wide canvases. */
export function liftHorizontalSpeed(
  worldWidth: number,
  mastery: number,
  score = 0
) {
  const viewportSpeed = clamp(worldWidth * 0.82, 240, 420);
  return Math.min(
    500,
    viewportSpeed +
      clamp(mastery, 0, 4) * 9 +
      Math.min(52, Math.max(0, score) * 0.02)
  );
}

export function liftDescendingTime(verticalGap: number, jumpSpeed: number) {
  const discriminant =
    jumpSpeed * jumpSpeed - 2 * LIFT_PHYSICS.gravity * verticalGap;
  if (verticalGap < 0 || discriminant < 0) return null;
  return (jumpSpeed + Math.sqrt(discriminant)) / LIFT_PHYSICS.gravity;
}

/** Conservative X distance while accelerating from rest for one jump arc. */
export function liftReachableDistance(flightTime: number, maxSpeed: number) {
  const acceleration = LIFT_PHYSICS.horizontalAcceleration;
  const accelerationTime = maxSpeed / acceleration;
  if (flightTime <= accelerationTime)
    return 0.5 * acceleration * flightTime * flightTime;
  return maxSpeed * flightTime - (maxSpeed * maxSpeed) / (2 * acceleration);
}

/** Checks a platform against the real ballistic arc and wraparound movement envelope. */
export function canReachLiftPlatform(
  sourceCenterX: number,
  targetCenterX: number,
  targetWidth: number,
  worldWidth: number,
  verticalGap: number,
  jumpSpeed: number,
  horizontalSpeed: number,
  motionPadding = 0
) {
  const flightTime = liftDescendingTime(verticalGap, jumpSpeed);
  if (flightTime === null || worldWidth <= 0) return false;

  let distance = Math.abs(sourceCenterX - targetCenterX) % worldWidth;
  distance = Math.min(distance, worldWidth - distance);
  const landingSpan = targetWidth / 2 + LIFT_PHYSICS.playerRadius;
  const requiredTravel =
    Math.max(0, distance - landingSpan) + Math.max(0, motionPadding);
  return (
    requiredTravel <= liftReachableDistance(flightTime, horizontalSpeed) + 0.001
  );
}

export function getLiftPlatformOffset(platform: LiftPlatform, elapsed: number) {
  if (platform.kind !== "moving" || platform.moveRange <= 0) return 0;
  return (
    Math.sin(elapsed * platform.moveSpeed + platform.phase) *
    platform.moveRange *
    platform.direction
  );
}

/** Keep a seeded stream of platforms above the camera so the ascent can continue. */
export function needsMoreLiftPlatforms(
  topPlatformY: number,
  camera: number,
  viewportHeight: number
) {
  return topPlatformY + camera > -viewportHeight * 1.8;
}

function createRng(seed: number) {
  let value = seed >>> 0 || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const platformWidth = (worldWidth: number) =>
  Math.min(84, Math.max(60, worldWidth * 0.205));

function platformKind(
  random: () => number,
  row: number,
  difficulty: number,
  recentKinds: LiftPlatformKind[]
) {
  if (row <= 3) return "normal";

  const roll = random();
  const springChance = 0.075 + difficulty * 0.035;
  const crumbleChance = 0.1 + difficulty * 0.075;
  const movingChance = 0.14 + difficulty * 0.1;
  let kind: LiftPlatformKind =
    roll < springChance
      ? "spring"
      : roll < springChance + crumbleChance
        ? "crumble"
        : roll < springChance + crumbleChance + movingChance
          ? "moving"
          : "normal";

  // Leave breathing room after a crumble; avoid strings of high-risk steps.
  if (kind === "crumble" && recentKinds.at(-1) === "crumble") kind = "normal";
  if (
    kind === "crumble" &&
    recentKinds
      .slice(-2)
      .every(recent => recent === "crumble" || recent === "moving")
  ) {
    kind = "normal";
  }
  return kind;
}

function reflectedX(candidate: number, minX: number, maxX: number) {
  const span = maxX - minX;
  if (span <= 0) return minX;
  const folded = (((candidate - minX) % (span * 2)) + span * 2) % (span * 2);
  return minX + (folded <= span ? folded : span * 2 - folded);
}

export function createLiftPlatformGenerator(
  seed: number,
  worldWidth: number,
  mastery: number
) {
  const random = createRng(seed + mastery * 7919);
  const width = Math.max(220, worldWidth);
  const baseWidth = platformWidth(width);
  const safeMastery = clamp(mastery, 1, 4);
  const recentKinds: LiftPlatformKind[] = [];
  let row = 0;

  return (
    y: number,
    previousX: number,
    nextWorldWidth = worldWidth,
    previousPlatformWidth = baseWidth
  ): LiftPlatform => {
    const nextWidth = Math.max(220, nextWorldWidth);
    const safeWidth = platformWidth(nextWidth);
    row += 1;
    const difficulty = liftDifficultyForRow(safeMastery, row);
    const gap = 94 + random() * 18 + difficulty * 16;
    const kind = platformKind(random, row, difficulty, recentKinds);
    const maxX = nextWidth - safeWidth - 10;
    const minX = 10;
    const maxShift = Math.min(
      nextWidth * 0.42,
      72 + difficulty * Math.min(110, nextWidth * 0.22)
    );
    const minShift = Math.min(maxShift, Math.max(40, safeWidth * 0.5));
    const jumpSpeed = liftJumpSpeed(safeMastery);
    const horizontalSpeed = liftHorizontalSpeed(nextWidth, safeMastery);

    let platform: LiftPlatform | null = null;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const kindWidth =
        kind === "moving"
          ? 0.91
          : kind === "crumble"
            ? 0.88
            : kind === "spring"
              ? 0.97
              : 1;
      const runNarrowing = 0.9 - difficulty * 0.08 + random() * 0.1;
      const generatedWidth = Math.max(
        46,
        Math.min(safeWidth, safeWidth * kindWidth * runNarrowing)
      );
      let shift = (random() * 2 - 1) * maxShift;
      if (Math.abs(shift) < minShift)
        shift = (random() < 0.5 ? -1 : 1) * minShift;

      const x = clamp(reflectedX(previousX + shift, minX, maxX), minX, maxX);
      const moveRange =
        kind === "moving"
          ? Math.min(nextWidth * 0.12, 24 + random() * (14 + difficulty * 28))
          : 0;
      const candidate: LiftPlatform = {
        x: clamp(x, minX, nextWidth - generatedWidth - 10),
        y: y - gap,
        width: generatedWidth,
        kind,
        phase: random() * Math.PI * 2,
        direction: random() < 0.5 ? -1 : 1,
        moveRange,
        moveSpeed:
          kind === "moving" ? 0.65 + random() * (0.55 + difficulty * 0.8) : 0,
        used: false,
      };

      if (
        canReachLiftPlatform(
          previousX + previousPlatformWidth / 2,
          candidate.x + candidate.width / 2,
          candidate.width,
          nextWidth,
          gap,
          jumpSpeed,
          horizontalSpeed,
          candidate.moveRange
        )
      ) {
        platform = candidate;
        break;
      }
    }

    // A safe deterministic fallback prevents an unlucky random streak from
    // creating an impossible step, even if tuning changes later.
    if (!platform) {
      const fallbackGap = 94 + Math.min(8, difficulty * 8);
      const fallbackWidth = Math.max(52, Math.min(safeWidth, baseWidth * 0.9));
      platform = {
        x: clamp(
          previousX + (previousPlatformWidth - fallbackWidth) / 2,
          minX,
          nextWidth - fallbackWidth - 10
        ),
        y: y - fallbackGap,
        width: fallbackWidth,
        kind: "normal",
        phase: 0,
        direction: 1,
        moveRange: 0,
        moveSpeed: 0,
        used: false,
      };
    }

    recentKinds.push(platform.kind);
    if (recentKinds.length > 2) recentKinds.shift();
    return platform;
  };
}

export function createLiftPlatformSequence(
  seed: number,
  worldWidth: number,
  mastery: number,
  floorY: number,
  count: number
) {
  const width = Math.max(220, worldWidth);
  const baseWidth = platformWidth(width);
  const platforms: LiftPlatform[] = [
    {
      x: (width - baseWidth) / 2,
      y: floorY,
      width: baseWidth,
      kind: "normal",
      phase: 0,
      direction: 1,
      moveRange: 0,
      moveSpeed: 0,
      used: false,
    },
  ];
  const next = createLiftPlatformGenerator(seed, width, mastery);
  while (platforms.length < count) {
    const previous = platforms[platforms.length - 1];
    platforms.push(next(previous.y, previous.x, width, previous.width));
  }
  return { platforms, next };
}
