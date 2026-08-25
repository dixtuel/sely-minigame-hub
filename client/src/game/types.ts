export type RunPhase = "explore" | "won" | "failed";

export type GridPoint = { x: number; z: number };

export type GameSnapshot = {
  phase: RunPhase;
  echoes: number;
  noise: number;
  marks: number;
  doorOpen: boolean;
  objective: string;
  message: string;
};

export type GameEvent =
  | { type: "state"; snapshot: GameSnapshot }
  | { type: "toast"; message: string }
  | { type: "ready" };

export type GameHandle = {
  scene: { render: () => void };
  setVirtualMove: (x: number, z: number) => void;
  pulse: () => void;
  restart: () => void;
  dispose: () => void;
};

export const createInitialSnapshot = (): GameSnapshot => ({
  phase: "explore",
  echoes: 6,
  noise: 0,
  marks: 0,
  doorOpen: false,
  objective: "İlk işareti bul",
  message: "Sesini bırak. Taşlar yolu hatırlıyor.",
});
