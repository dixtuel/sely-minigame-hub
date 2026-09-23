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
  it("generates structurally sound 3D Echo Room maze layouts with valid points, gates, and walls", () => {
    const layout1 = generate3DEchoLayout(1001, 1);
    const layout2 = generate3DEchoLayout(2002, 1);
    const layout3 = generate3DEchoLayout(3003, 1);

    expect(layout1.startPoint.x !== layout2.startPoint.x || layout1.startPoint.z !== layout2.startPoint.z).toBe(true);
    expect(layout1.markers[0].point.x !== layout2.markers[0].point.x).toBe(true);
    expect(layout1.exitPoint.x !== layout3.exitPoint.x || layout1.exitPoint.z !== layout3.exitPoint.z).toBe(true);

    for (let seed = 1; seed <= 30; seed++) {
      const layout = generate3DEchoLayout(seed * 3137, 2);
      expect(layout.markers).toHaveLength(3);
      expect(layout.markers.map((m) => m.id)).toEqual(["mark-a", "mark-b", "mark-c"]);
      for (const m of layout.markers) {
        expect(m.label.length).toBeGreaterThan(0);
        expect(Math.abs(m.point.x)).toBeLessThan(16);
        expect(Math.abs(m.point.z)).toBeLessThan(14);
      }
      expect(layout.walls.length).toBeGreaterThan(20);

      // Gate wall separation
      const [gx, gz] = layout.gateWallPlacement;
      const isDuplicate = layout.walls.some(([wx, wz]) => wx === gx && wz === gz);
      expect(isDuplicate).toBe(false);

      // Points never blocked by walls
      expect(pointBlockedByWalls(layout.startPoint.x, layout.startPoint.z, layout.walls)).toBe(false);
      for (const m of layout.markers) {
        expect(pointBlockedByWalls(m.point.x, m.point.z, layout.walls)).toBe(false);
      }
      expect(pointBlockedByWalls(layout.exitPoint.x, layout.exitPoint.z, layout.walls)).toBe(false);
    }
  });

  it("preserves critical corridor paths and generates continuous listener patrol loop", () => {
    let totalHidden = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const maze = generateMaze(mulberry32(seed * 811), 1);
      const critical = computeCriticalCells(maze);
      const hidden = selectHiddenWalls(maze, mulberry32(seed * 811 + 1), 0.9);
      for (const wall of hidden) {
        const aOnPath = critical.has(`${wall.cellA.col},${wall.cellA.row}`);
        const bOnPath = critical.has(`${wall.cellB.col},${wall.cellB.row}`);
        expect(aOnPath || bOnPath).toBe(false);
      }

      // Hidden walls in typical run
      const hiddenLayout = generate3DEchoLayout(seed * 4441, 1);
      totalHidden += hiddenLayout.hiddenWalls.length;
      expect(hiddenLayout.hiddenWalls.length).toBeLessThan(hiddenLayout.walls.length);

      // Connected corridor patrol loop
      const patrolLayout = generate3DEchoLayout(seed * 3307, 1);
      const path = patrolLayout.listenerPath;
      expect(path.length).toBeGreaterThanOrEqual(10);

      const distFromStart = Math.hypot(path[0].x - patrolLayout.startPoint.x, path[0].z - patrolLayout.startPoint.z);
      expect(distFromStart).toBeGreaterThan(8.0);

      for (const p of path) {
        expect(pointBlockedByWalls(p.x, p.z, patrolLayout.walls)).toBe(false);
      }

      for (let i = 0; i < path.length - 1; i++) {
        const stepDist = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
        expect(stepDist).toBeLessThanOrEqual(patrolLayout.cellSize * 1.5);
      }
    }
    expect(totalHidden).toBeGreaterThan(0);
  });
});
