import { describe, expect, it } from "vitest";
import { generateMaze } from "./maze";
import { computeCriticalCells, generate3DEchoLayout, selectHiddenWalls } from "./proceduralLevel";

function mulberry32(seed: number) {
  let value = (seed >>> 0) || 1;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pointBlockedByWalls(x: number, z: number, walls: [number, number, number, number, number][]) {
  return walls.some(([wx, wz, width, depth]) => Math.abs(x - wx) < width / 2 + 0.05 && Math.abs(z - wz) < depth / 2 + 0.05);
}

describe("proceduralLevel (maze-based 3D Echo Room)", () => {
  it("generates varied layouts for different seeds", () => {
    const layout1 = generate3DEchoLayout(1001, 1);
    const layout2 = generate3DEchoLayout(2002, 1);
    const layout3 = generate3DEchoLayout(3003, 1);

    expect(layout1.startPoint.x !== layout2.startPoint.x || layout1.startPoint.z !== layout2.startPoint.z).toBe(true);
    expect(layout1.markers[0].point.x !== layout2.markers[0].point.x).toBe(true);
    expect(layout1.exitPoint.x !== layout3.exitPoint.x || layout1.exitPoint.z !== layout3.exitPoint.z).toBe(true);
  });

  it("guarantees 3 distinct markers with labels and within bounds", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const layout = generate3DEchoLayout(seed * 3137, 2);
      expect(layout.markers).toHaveLength(3);
      expect(layout.markers.map((m) => m.id)).toEqual(["mark-a", "mark-b", "mark-c"]);
      for (const m of layout.markers) {
        expect(m.label.length).toBeGreaterThan(0);
        expect(Math.abs(m.point.x)).toBeLessThan(16);
        expect(Math.abs(m.point.z)).toBeLessThan(14);
      }
    }
  });

  it("never places the start point or markers inside a wall", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const layout = generate3DEchoLayout(seed * 4111, 2);
      expect(pointBlockedByWalls(layout.startPoint.x, layout.startPoint.z, layout.walls)).toBe(false);
      for (const m of layout.markers) {
        expect(pointBlockedByWalls(m.point.x, m.point.z, layout.walls)).toBe(false);
      }
      expect(pointBlockedByWalls(layout.exitPoint.x, layout.exitPoint.z, layout.walls)).toBe(false);
    }
  });

  it("produces a real branching maze, not a wide-open room", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = generate3DEchoLayout(seed * 977, 1);
      // A genuine maze has a substantial number of internal walls (not a wide-open room).
      expect(layout.walls.length).toBeGreaterThan(20);
    }
  });

  it("locks the exit behind a distinct gate wall separate from the regular maze walls", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const layout = generate3DEchoLayout(seed * 619, 1);
      const [gx, gz] = layout.gateWallPlacement;
      const isDuplicate = layout.walls.some(([wx, wz]) => wx === gx && wz === gz);
      expect(isDuplicate).toBe(false);
    }
  });

  it("only hides walls off the critical path, so the route to every marker and the gate always stays legible", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const maze = generateMaze(mulberry32(seed * 811), 1);
      const critical = computeCriticalCells(maze);
      const hidden = selectHiddenWalls(maze, mulberry32(seed * 811 + 1), 0.9); // high chance to stress-test the filter
      for (const wall of hidden) {
        const aOnPath = critical.has(`${wall.cellA.col},${wall.cellA.row}`);
        const bOnPath = critical.has(`${wall.cellB.col},${wall.cellB.row}`);
        expect(aOnPath || bOnPath).toBe(false);
      }
    }
  });

  it("actually produces some hidden walls in a typical run (the feature is wired up, not a no-op)", () => {
    let totalHidden = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const layout = generate3DEchoLayout(seed * 4441, 1);
      totalHidden += layout.hiddenWalls.length;
      // Hidden walls are a real subset of the full wall list, never the whole thing.
      expect(layout.hiddenWalls.length).toBeLessThan(layout.walls.length);
    }
    expect(totalHidden).toBeGreaterThan(0);
  });
});
