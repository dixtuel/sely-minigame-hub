import type { GridPoint } from "./types";

const clampAxis = (value: number) => (Math.abs(value) < 0.16 ? 0 : Math.max(-1, Math.min(1, value)));

export class InputManager {
  private readonly keys = new Set<string>();
  private virtualMove: GridPoint = { x: 0, z: 0 };
  private gamepadPulseWasDown = false;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onKeyUp: (event: KeyboardEvent) => void;
  private readonly onWindowBlur: () => void;

  constructor(private readonly onPulse: () => void) {
    this.onKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const handled = ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "e"].includes(key);
      if (!handled) return;
      if (key === " " || key === "e") {
        if (!event.repeat) this.onPulse();
      } else {
        this.keys.add(key);
      }
      event.preventDefault();
    };
    this.onKeyUp = (event) => {
      this.keys.delete(event.key.toLowerCase());
    };
    this.onWindowBlur = () => {
      this.keys.clear();
      this.virtualMove = { x: 0, z: 0 };
      this.gamepadPulseWasDown = false;
    };
    window.addEventListener("keydown", this.onKeyDown, { passive: false });
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onWindowBlur);
  }

  setVirtualMove(x: number, z: number) {
    this.virtualMove = { x: clampAxis(x), z: clampAxis(z) };
  }

  getMove(): GridPoint {
    let x = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    let z = (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) - (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0);

    const pad = navigator.getGamepads?.()[0];
    const gamepadPulseDown = Boolean(pad?.buttons[0]?.pressed);
    if (pad) {
      x += clampAxis(pad.axes[0] ?? 0);
      z += clampAxis(pad.axes[1] ?? 0);
      if (gamepadPulseDown && !this.gamepadPulseWasDown) this.onPulse();
    }
    this.gamepadPulseWasDown = gamepadPulseDown;

    x += this.virtualMove.x;
    z += this.virtualMove.z;
    const magnitude = Math.hypot(x, z);
    return magnitude > 1 ? { x: x / magnitude, z: z / magnitude } : { x, z };
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onWindowBlur);
    this.keys.clear();
  }
}
