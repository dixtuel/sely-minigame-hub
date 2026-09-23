/**
 * Sokoban Engine & Level Generator
 * Original maps & rules from muthuspark/javascript-games (Muthukrishnan, MIT License)
 * Adapted to SELY MiniGame Hub modular architecture.
 */

export interface SokobanLevelData {
  name: string;
  map: string[];
}

export interface SokobanPoint {
  x: number;
  y: number;
}

export interface SokobanGameState {
  walls: SokobanPoint[];
  targets: SokobanPoint[];
  boxes: SokobanPoint[];
  player: SokobanPoint;
  width: number;
  height: number;
}

export interface SokobanHistoryStep {
  player: SokobanPoint;
  boxes: SokobanPoint[];
  moves: number;
  pushes: number;
}

export const SOKOBAN_LEVELS: SokobanLevelData[] = [
  // Level 1 - Tutorial
  {
    name: "Tutorial",
    map: ["WWWWWW", "W....W", "W.B..W", "W.T..W", "W..P.W", "WWWWWW"],
  },
  // Level 2 - Simple push
  {
    name: "First Steps",
    map: ["WWWWWWW", "W.....W", "W.BTB.W", "W..P..W", "W.....W", "WWWWWWW"],
  },
  // Level 3 - Corner work
  {
    name: "Corner Push",
    map: ["WWWWWWWW", "W......W", "W.B..B.W", "W..TT..W", "W...P..W", "W......W", "WWWWWWWW"],
  },
  // Level 4 - Narrow paths
  {
    name: "Narrow Path",
    map: ["WWWWWWWW", "WT....TW", "W.WBBW.W", "W..P...W", "W......W", "WWWWWWWW"],
  },
  // Level 5 - Box arrangement
  {
    name: "Triple Boxes",
    map: ["WWWWWWWWW", "W.......W", "W..BBB..W", "W..TTT..W", "W...P...W", "W.......W", "WWWWWWWWW"],
  },
  // Level 6 - L-shaped
  {
    name: "L-Shape",
    map: ["WWWWWWWW", "W......W", "W.T.B..W", "W.TWBP.W", "W......W", "WWWWWWWW"],
  },
  // Level 7 - Planning ahead
  {
    name: "Think Ahead",
    map: ["WWWWWWWWW", "W...W...W", "W.B.W.T.W", "W.B...T.W", "W.P.W...W", "WWWWWWWWW"],
  },
  // Level 8 - Tight space
  {
    name: "Tight Squeeze",
    map: ["WWWWWWWW", "WTT....W", "WB.B...W", "W......W", "W...P..W", "WWWWWWWW"],
  },
  // Level 9 - Diamond
  {
    name: "Diamond",
    map: ["WWWWWWWWW", "W...T...W", "W..T.T..W", "W.B.B.B.W", "W...P...W", "W.......W", "WWWWWWWWW"],
  },
  // Level 10 - Challenge
  {
    name: "The Challenge",
    map: ["WWWWWWWWWW", "W........W", "W.BWWWB..W", "W.TW.WT..W", "W..W.W...W", "W...P....W", "WWWWWWWWWW"],
  },
];

export function parseSokobanLevel(level: SokobanLevelData): SokobanGameState {
  const map = level.map;
  const state: SokobanGameState = {
    walls: [],
    targets: [],
    boxes: [],
    player: { x: 0, y: 0 },
    width: map[0].length,
    height: map.length,
  };

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[y].length; x++) {
      const char = map[y][x];
      switch (char) {
        case "W":
          state.walls.push({ x, y });
          break;
        case "P":
          state.player = { x, y };
          break;
        case "B":
          state.boxes.push({ x, y });
          break;
        case "T":
          state.targets.push({ x, y });
          break;
        case "O": // Box on target
          state.boxes.push({ x, y });
          state.targets.push({ x, y });
          break;
        case "@": // Player on target
          state.player = { x, y };
          state.targets.push({ x, y });
          break;
      }
    }
  }

  return state;
}

export function isSokobanWin(state: SokobanGameState): boolean {
  return state.targets.every(t => state.boxes.some(b => b.x === t.x && b.y === t.y));
}
