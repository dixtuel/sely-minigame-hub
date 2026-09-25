import { describe, expect, it } from "vitest";
import { advanceApexSpeed, advanceApexTraffic, APEX_CRUISE_SPEED, apexNearMissReward, apexRoadFlowMultiplier, apexTrafficHeight, canSpawnApexTraffic, createApexTrafficGenerator, type ApexLane, type ApexTrafficBody } from "./apex";

function generateRun(seed: number, mastery: number) {
  const nextWave = createApexTrafficGenerator(seed, mastery);
  return Array.from({ length: 150 }, (_, index) => ({
    distance: 76 + index * 32,
    cars: nextWave(76 + index * 32),
  }));
}

describe("Apex traffic generator", () => {
  it("is deterministic, but a new run seed produces a different route", () => {
    expect(generateRun(734_921, 2)).toEqual(generateRun(734_921, 2));
    expect(generateRun(734_921, 2)).not.toEqual(generateRun(734_922, 2));
  });

  it("keeps every wave passable and reserves enough distance between cars in the same lane", () => {
    for (const mastery of [0, 2, 4]) {
      const lastSpawnAt = new Map<ApexLane, number>();
      const waves = generateRun(194_027 + mastery, mastery);

      for (const { distance, cars } of waves) {
        expect(cars.length).toBeLessThanOrEqual(3);
        expect(new Set(cars.map(car => car.lane)).size).toBe(cars.length);

        for (const car of cars) {
          const previousDistance = lastSpawnAt.get(car.lane);
          if (previousDistance !== undefined) {
            expect(distance - previousDistance).toBeGreaterThanOrEqual(78 + Math.min(12, mastery * 3));
          }
          lastSpawnAt.set(car.lane, distance);
        }
      }
    }
  });

  it("ramps traffic from one car per wave toward denser late-game patterns", () => {
    const waves = generateRun(87_131, 1);
    const early = waves.filter(wave => wave.distance < 800);
    const late = waves.filter(wave => wave.distance > 3_600);

    expect(early.every(wave => wave.cars.length <= 1)).toBe(true);
    expect(late.some(wave => wave.cars.length > 1)).toBe(true);
  });
});

describe("Apex active traffic", () => {
  const makeCar = (lane: ApexLane, y: number, speedKph: number, kind: ApexTrafficBody["kind"] = "sedan"): ApexTrafficBody => ({
    lane, y, speedKph, kind, color: "#ffffff",
  });

  it("rejects an occupied entry space while leaving adjacent lanes available", () => {
    const active = [makeCar(2, -45, 110, "van")];
    expect(canSpawnApexTraffic(active, makeCar(2, -76, 90), 60)).toBe(false);
    expect(canSpawnApexTraffic(active, makeCar(3, -76, 90), 60)).toBe(true);
    expect(canSpawnApexTraffic(active, makeCar(2, -200, 90), 60)).toBe(true);
  });

  it("keeps faster followers behind slower cars in both traffic directions", () => {
    const cars = [
      makeCar(0, 60, 90, "van"),
      makeCar(0, -40, 150),
      makeCar(2, -40, 85),
      makeCar(2, 60, 145, "van"),
    ];

    for (let frame = 0; frame < 80; frame += 1) {
      advanceApexTraffic(cars, 120, 0.035, 1, 60);
      const oncomingGap = cars[0].y - (cars[1].y + apexTrafficHeight(cars[1].kind, 60));
      const sameDirectionGap = cars[3].y - (cars[2].y + apexTrafficHeight(cars[2].kind, 60));
      expect(oncomingGap).toBeGreaterThanOrEqual(12 - 0.001);
      expect(sameDirectionGap).toBeGreaterThanOrEqual(12 - 0.001);
    }

    expect(cars[1].speedKph).toBe(cars[0].speedKph);
    expect(cars[3].speedKph).toBe(cars[2].speedKph);
  });
});

describe("Apex speed response", () => {
  it("responds distinctly to throttle, braking, and coasting", () => {
    expect(advanceApexSpeed(100, { gas: true, brake: false }, 0.1)).toBeCloseTo(112);
    expect(advanceApexSpeed(100, { gas: false, brake: true }, 0.1)).toBeCloseTo(80);
    expect(advanceApexSpeed(110, { gas: false, brake: false }, 0.1)).toBeCloseTo(108.6);
  });

  it("keeps a default cruise speed and gently returns to it after braking or acceleration", () => {
    expect(APEX_CRUISE_SPEED).toBe(100);
    expect(advanceApexSpeed(APEX_CRUISE_SPEED, { gas: false, brake: false }, 1)).toBe(APEX_CRUISE_SPEED);
    expect(advanceApexSpeed(80, { gas: false, brake: false }, 0.1)).toBeCloseTo(81.4);
  });

  it("keeps near-miss rewards useful but caps farming more conservatively", () => {
    expect(apexNearMissReward(0)).toBe(0);
    expect(apexNearMissReward(1)).toBe(100);
    expect(apexNearMissReward(3)).toBe(300);
    expect(apexNearMissReward(9)).toBe(400);
  });

  it("prioritizes the brake and keeps speed inside the playable range", () => {
    expect(advanceApexSpeed(150, { gas: true, brake: true }, 0.1)).toBeCloseTo(130);
    expect(advanceApexSpeed(215, { gas: true, brake: false }, 1)).toBe(220);
    expect(advanceApexSpeed(70, { gas: false, brake: true }, 1)).toBe(68);
    expect(advanceApexSpeed(120, { gas: false, brake: false }, -1)).toBe(120);
  });

  it("makes road markings visibly move faster as top speed rises", () => {
    expect(apexRoadFlowMultiplier(68)).toBeLessThan(apexRoadFlowMultiplier(140));
    expect(apexRoadFlowMultiplier(140)).toBeLessThan(apexRoadFlowMultiplier(220));
    expect(apexRoadFlowMultiplier(220)).toBe(3.5);
  });
});
