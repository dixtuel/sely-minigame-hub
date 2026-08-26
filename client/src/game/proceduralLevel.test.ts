import { describe, expect, it } from "vitest";
import { generate3DEchoLayout } from "./proceduralLevel";

describe("proceduralLevel (3D Echo Room)", () => {
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
        expect(Math.abs(m.point.x)).toBeLessThan(15.5);
        expect(Math.abs(m.point.z)).toBeLessThan(13.5);
      }
    }
  });

  it("guarantees a continuous walkable route from start to exit without wall obstruction", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const layout = generate3DEchoLayout(seed * 4111, 2);
      expect(layout.route.length).toBeGreaterThanOrEqual(16);

      // Verify route continuity
      for (let i = 0; i < layout.route.length - 1; i++) {
        const p1 = layout.route[i];
        const p2 = layout.route[i + 1];
        const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        expect(dist).toBeLessThanOrEqual(2.6);
      }

      // Verify zero wall collision on the route
      for (const part of layout.partitions) {
        const [cx, cz, w, dp] = part;
        for (const r of layout.route) {
          const dx = Math.abs(r.x - cx) - w / 2;
          const dz = Math.abs(r.z - cz) - dp / 2;
          const inside = dx < 0.35 && dz < 0.35;
          expect(inside).toBe(false);
        }
      }
    }
  });
});
