export type ApexLane = 0 | 1 | 2 | 3;
export type ApexTrafficKind = "compact" | "sedan" | "van" | "sport";

export interface ApexTrafficSpawn {
  lane: ApexLane;
  speedKph: number;
  color: string;
  kind: ApexTrafficKind;
}

export interface ApexTrafficBody extends ApexTrafficSpawn {
  y: number;
}

export interface ApexPedals {
  gas: boolean;
  brake: boolean;
}

const APEX_MIN_SPEED = 68;
const APEX_MAX_SPEED = 220;
export const APEX_CRUISE_SPEED = 100;
const APEX_ACCELERATION = 120;
const APEX_BRAKING = 200;
const APEX_COAST_RESPONSE = 14;

/** Advance speed with a steady cruise target when neither pedal is held. */
export function advanceApexSpeed(speedKph: number, pedals: ApexPedals, dt: number) {
  const elapsed = Math.max(0, dt);
  const speedChange = pedals.brake
    ? -APEX_BRAKING * elapsed
    : pedals.gas
      ? APEX_ACCELERATION * elapsed
      : Math.max(-APEX_COAST_RESPONSE * elapsed, Math.min(APEX_COAST_RESPONSE * elapsed, APEX_CRUISE_SPEED - speedKph));
  return Math.max(APEX_MIN_SPEED, Math.min(APEX_MAX_SPEED, speedKph + speedChange));
}

/** Reduce near-miss score farming while keeping successful passes rewarding. */
export function apexNearMissReward(combo: number) {
  return 100 * Math.min(4, Math.max(0, Math.floor(combo)));
}

/** Makes the road's visual flow clearly scale with speed, especially at the top end. */
export function apexRoadFlowMultiplier(speedKph: number) {
  const progress = Math.max(0, Math.min(1, (speedKph - APEX_MIN_SPEED) / (APEX_MAX_SPEED - APEX_MIN_SPEED)));
  return 0.65 + progress * 2.85;
}

const TRAFFIC_PAINTS = ["#df654d", "#76958a", "#d5c7a5", "#8998ae", "#b48c69"];
const TRAFFIC_KINDS: ApexTrafficKind[] = ["compact", "sedan", "van", "sport"];
const TRAFFIC_CLEARANCE_PX = 12;

export function apexTrafficHeight(kind: ApexTrafficKind, playerHeight: number) {
  return playerHeight * (kind === "van" ? 1.15 : 0.93);
}

/** Reject a car only when an active car already occupies its entry space. */
export function canSpawnApexTraffic(cars: ApexTrafficBody[], spawn: ApexTrafficBody, playerHeight: number) {
  const spawnBottom = spawn.y + apexTrafficHeight(spawn.kind, playerHeight);
  return cars.every((car) => {
    if (car.lane !== spawn.lane) return true;
    const carBottom = car.y + apexTrafficHeight(car.kind, playerHeight);
    return car.y - spawnBottom >= TRAFFIC_CLEARANCE_PX || spawn.y - carBottom >= TRAFFIC_CLEARANCE_PX;
  });
}

/** Keep cars in the same lane from driving through one another as their speeds differ. */
export function advanceApexTraffic(cars: ApexTrafficBody[], playerSpeedKph: number, dt: number, screenScale: number, playerHeight: number) {
  const step = Math.max(0, dt) * screenScale;
  for (const car of cars) {
    const relativeSpeed = car.lane < 2 ? playerSpeedKph + car.speedKph : playerSpeedKph - car.speedKph;
    car.y += relativeSpeed * step;
  }

  for (const lane of [0, 1, 2, 3] as ApexLane[]) {
    const oncoming = lane < 2;
    const laneCars = cars.filter((car) => car.lane === lane).sort((a, b) => oncoming ? b.y - a.y : a.y - b.y);
    for (let index = 1; index < laneCars.length; index += 1) {
      const leader = laneCars[index - 1];
      const follower = laneCars[index];
      const leaderHeight = apexTrafficHeight(leader.kind, playerHeight);
      const followerHeight = apexTrafficHeight(follower.kind, playerHeight);
      const gap = oncoming
        ? leader.y - (follower.y + followerHeight)
        : follower.y - (leader.y + leaderHeight);

      if (gap <= TRAFFIC_CLEARANCE_PX + 8 && follower.speedKph > leader.speedKph) {
        follower.speedKph = leader.speedKph;
      }
      if (gap < TRAFFIC_CLEARANCE_PX) {
        follower.y = oncoming
          ? leader.y - followerHeight - TRAFFIC_CLEARANCE_PX
          : leader.y + leaderHeight + TRAFFIC_CLEARANCE_PX;
      }
    }
  }
}

export function createApexRandom(seed: number) {
  let value = (seed >>> 0) || 1;
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seed: number) {
  return createApexRandom(seed);
}

function shuffledLanes(random: () => number): ApexLane[] {
  const lanes: ApexLane[] = [0, 1, 2, 3];
  for (let index = lanes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [lanes[index], lanes[swapIndex]] = [lanes[swapIndex], lanes[index]];
  }
  return lanes;
}

/**
 * Creates a reproducible, endless traffic stream. Each wave keeps an escape
 * lane open, while per-lane reservations stop cars clustering bumper-to-bumper.
 */
export function createApexTrafficGenerator(seed: number, mastery: number) {
  const random = seededRandom(seed ^ Math.imul(mastery + 11, 0x9e3779b9));
  const lastSpawnAt = new Map<ApexLane, number>();

  return (distanceMeters: number): ApexTrafficSpawn[] => {
    const progress = Math.min(1, Math.max(0, distanceMeters / 4200));
    const maxCars = progress > 0.66 ? 3 : progress > 0.2 ? 2 : 1;
    // The time gap is expressed as a distance because the caller advances the
    // generator in world metres. At highway speeds this is roughly 2.8–3.4 s.
    const laneHeadwayMeters = 78 + progress * 16 + Math.min(12, Math.max(0, mastery) * 3);
    const shuffled = shuffledLanes(random);
    const eligible = shuffled.filter((lane) =>
      distanceMeters - (lastSpawnAt.get(lane) ?? Number.NEGATIVE_INFINITY) >= laneHeadwayMeters
    );
    if (!eligible.length) return [];
    const targetCount = Math.min(eligible.length, 1 + Math.floor(random() * maxCars));
    const chosen = eligible.slice(0, targetCount);

    for (const lane of chosen) lastSpawnAt.set(lane, distanceMeters);

    return chosen.map((lane) => {
      const oncoming = lane < 2;
      const kind = TRAFFIC_KINDS[Math.floor(random() * TRAFFIC_KINDS.length)];
      const baseSpeed = oncoming
        ? 92 + random() * 48
        : 82 + random() * 62;

      return {
        lane,
        speedKph: baseSpeed + progress * (oncoming ? 12 : 7),
        color: TRAFFIC_PAINTS[Math.floor(random() * TRAFFIC_PAINTS.length)],
        kind,
      };
    });
  };
}
