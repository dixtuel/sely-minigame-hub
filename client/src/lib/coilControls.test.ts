import { describe, expect, it } from "vitest";
import { directionFromCoilSwipe } from "./coilControls";

describe("Coil swipe controls", () => {
  it.each([
    [-40, 4, "left"],
    [40, 4, "right"],
    [3, -40, "up"],
    [3, 40, "down"],
  ] as const)("maps (%i, %i) to %s", (dx, dy, direction) => {
    expect(directionFromCoilSwipe(dx, dy)).toBe(direction);
  });

  it("ignores taps and very short drags", () => {
    expect(directionFromCoilSwipe(0, 0)).toBeNull();
    expect(directionFromCoilSwipe(12, -18)).toBeNull();
    expect(directionFromCoilSwipe(21, 0, 22)).toBeNull();
  });

  it("locks the swipe to the dominant axis", () => {
    expect(directionFromCoilSwipe(-44, 43)).toBe("left");
    expect(directionFromCoilSwipe(30, 48)).toBe("down");
  });
});
