import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { cellCenter, generateMaze, type MazeResult, type MazeWall } from "./maze";

export type WallPlacement = [number, number, number, number, number]; // x, z, width, depth, height

export type Echo3DLayout = {
  seed: number;
  mastery: number;
  cellSize: number;
  startPoint: Vector3;
  initialHeading: Vector3;
  markers: { id: string; label: string; point: Vector3 }[];
  exitPoint: Vector3;
  gateRotation: number;
  walls: WallPlacement[];
  hiddenWalls: WallPlacement[];
  gateWallPlacement: WallPlacement;
  columns: [number, number, number, number][];
  rubble: [number, number, number, number][];
  grass: [number, number][];
  listenerPath: Vector3[];
  rooms: { x: number; z: number; theme: 0 | 1 | 2 | 3 }[];
};

function rng(seed: number) {
  let value = (seed >>> 0) || 1;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const WALL_HEIGHT_BASE = 1.18;
const WALL_THICKNESS = 0.28;

function wallToPlacement(wall: { x1: number; z1: number; x2: number; z2: number }, prng: () => number): WallPlacement {
  const cx = +((wall.x1 + wall.x2) / 2).toFixed(2);
  const cz = +((wall.z1 + wall.z2) / 2).toFixed(2);
  const height = +(WALL_HEIGHT_BASE + prng() * 0.14).toFixed(2);
  const horizontal = wall.z1 === wall.z2;
  if (horizontal) {
    const width = +(Math.abs(wall.x2 - wall.x1)).toFixed(2);
    return [cx, cz, width, WALL_THICKNESS, height];
  }
  const depth = +(Math.abs(wall.z2 - wall.z1)).toFixed(2);
  return [cx, cz, WALL_THICKNESS, depth, height];
}

const cellKey = (col: number, row: number) => `${col},${row}`;

/**
 * Cells on the shortest open-graph path from start to every marker and to the
 * gate. Walls bordering any of these cells are never hidden, so a "hidden trap"
 * wall can only ever sit on an optional side-branch/dead-end — the actual
 * solution route stays ambiently visible without spending an echo on it.
 */
export function computeCriticalCells(maze: MazeResult): Set<string> {
  const parent = new Map<string, string | null>();
  const startKey = cellKey(maze.startCell.col, maze.startCell.row);
  parent.set(startKey, null);
  const queue: { col: number; row: number }[] = [maze.startCell];
  while (queue.length) {
    const current = queue.shift()!;
    const cell = maze.cells[current.row][current.col];
    const neighbors: { col: number; row: number }[] = [];
    if (!cell.north) neighbors.push({ col: current.col, row: current.row - 1 });
    if (!cell.south) neighbors.push({ col: current.col, row: current.row + 1 });
    if (!cell.east) neighbors.push({ col: current.col + 1, row: current.row });
    if (!cell.west) neighbors.push({ col: current.col - 1, row: current.row });
    for (const neighbor of neighbors) {
      const key = cellKey(neighbor.col, neighbor.row);
      if (!parent.has(key)) {
        parent.set(key, cellKey(current.col, current.row));
        queue.push(neighbor);
      }
    }
  }

  const critical = new Set<string>();
  const addPathTo = (target: { col: number; row: number }) => {
    let key: string | null | undefined = cellKey(target.col, target.row);
    while (key) {
      critical.add(key);
      key = parent.get(key) ?? null;
    }
  };
  maze.markerCells.forEach(addPathTo);
  addPathTo(maze.gateCell);
  return critical;
}

/**
 * Walls where BOTH bordering cells are off the critical path (start → every marker,
 * start → gate). Only these are eligible to become pulse-only "hidden traps" — the
 * actual solution route is guaranteed to stay ambiently visible without spending an echo.
 */
export function selectHiddenWalls(maze: MazeResult, prng: () => number, chance = 0.22): MazeWall[] {
  const criticalCells = computeCriticalCells(maze);
  return maze.walls.filter((wall) => {
    const onCriticalPath = criticalCells.has(cellKey(wall.cellA.col, wall.cellA.row)) || criticalCells.has(cellKey(wall.cellB.col, wall.cellB.row));
    return !onCriticalPath && prng() < chance;
  });
}

function cellFreePoint(maze: MazeResult, col: number, row: number, prng: () => number, margin = 0.55) {
  const center = cellCenter(maze, col, row);
  const half = maze.cellSize / 2 - margin;
  return {
    x: center.x + (prng() * 2 - 1) * half,
    z: center.z + (prng() * 2 - 1) * half,
  };
}

const labelPool = [
  ["Kuzey ölçeği", "Sessiz kayıt", "Son yankı"],
  ["İlk mühür", "Taş bellek", "Gölge kapısı"],
  ["Eski yankı", "Orta kaide", "Zaman izi"],
  ["Derin geçit", "Kayıt mühürü", "Yansıma oda"],
  ["Işık izi", "Yankı kaidesi", "Son mühür"],
  ["Bazalt odası", "Kırılgan iz", "Arşiv çıkışı"],
];

export function generate3DEchoLayout(seed: number, mastery: number): Echo3DLayout {
  const prng = rng(seed);
  const maze = generateMaze(prng, mastery);

  const start = cellCenter(maze, maze.startCell.col, maze.startCell.row);
  const startPoint = new Vector3(+start.x.toFixed(2), 0, +start.z.toFixed(2));

  const gate = cellCenter(maze, maze.gateCell.col, maze.gateCell.row);
  const exitPoint = new Vector3(+gate.x.toFixed(2), 0, +gate.z.toFixed(2));

  const labels = labelPool[Math.abs(Math.imul(seed + 331, 1013)) % labelPool.length];
  const markers = maze.markerCells.map((cell, i) => {
    const point = cellFreePoint(maze, cell.col, cell.row, prng, 0.4);
    return {
      id: `mark-${String.fromCharCode(97 + i)}`,
      label: labels[i],
      point: new Vector3(+point.x.toFixed(2), 0, +point.z.toFixed(2)),
    };
  });

  const gateWallPlacement = wallToPlacement(maze.gateWall, prng);
  const gateHorizontal = maze.gateWall.z1 === maze.gateWall.z2;
  const gateRotation = gateHorizontal ? 0 : Math.PI / 2;

  const walls = maze.walls.map((wall) => wallToPlacement(wall, prng));

  // Hidden "trap" walls: pulse-only, and only ever picked from walls where BOTH
  // bordering cells are off the critical path — the route to every marker and
  // to the gate always stays ambiently visible, so there's always a legible way through.
  const criticalCells = computeCriticalCells(maze);
  const hiddenChance = 0.22;
  const hiddenWalls: WallPlacement[] = [];
  maze.walls.forEach((wall, index) => {
    const onCriticalPath = criticalCells.has(cellKey(wall.cellA.col, wall.cellA.row)) || criticalCells.has(cellKey(wall.cellB.col, wall.cellB.row));
    if (!onCriticalPath && prng() < hiddenChance) hiddenWalls.push(walls[index]);
  });

  // Initial heading: point toward the first open neighbor of the start cell.
  const startCellData = maze.cells[maze.startCell.row][maze.startCell.col];
  let hx = 0;
  let hz = 1;
  if (!startCellData.north) { hx = 0; hz = -1; }
  else if (!startCellData.south) { hx = 0; hz = 1; }
  else if (!startCellData.east) { hx = 1; hz = 0; }
  else if (!startCellData.west) { hx = -1; hz = 0; }
  const initialHeading = new Vector3(hx, 0, hz);

  // Decorative props scattered inside open cells, well clear of walls and objectives.
  const guardPoints = [startPoint, exitPoint, ...markers.map((m) => m.point)];
  const farFromGuards = (x: number, z: number, min: number) => guardPoints.every((p) => Math.hypot(p.x - x, p.z - z) >= min);

  const columns: [number, number, number, number][] = [];
  const rubble: [number, number, number, number][] = [];
  const grass: [number, number][] = [];

  let attempts = 0;
  while (columns.length < 16 && attempts < 400) {
    attempts += 1;
    const col = Math.floor(prng() * maze.cols);
    const row = Math.floor(prng() * maze.rows);
    const p = cellFreePoint(maze, col, row, prng, 0.75);
    if (!farFromGuards(p.x, p.z, 1.8)) continue;
    const height = +(1.3 + prng() * 0.7).toFixed(2);
    const width = +(0.55 + prng() * 0.15).toFixed(2);
    columns.push([+p.x.toFixed(2), +p.z.toFixed(2), height, width]);
  }

  attempts = 0;
  while (rubble.length < 22 && attempts < 400) {
    attempts += 1;
    const col = Math.floor(prng() * maze.cols);
    const row = Math.floor(prng() * maze.rows);
    const p = cellFreePoint(maze, col, row, prng, 0.6);
    if (!farFromGuards(p.x, p.z, 1.4)) continue;
    const scale = +(0.4 + prng() * 0.3).toFixed(2);
    const rotation = +(prng() * Math.PI).toFixed(2);
    rubble.push([+p.x.toFixed(2), +p.z.toFixed(2), scale, rotation]);
  }

  attempts = 0;
  while (grass.length < 12 && attempts < 300) {
    attempts += 1;
    const col = Math.floor(prng() * maze.cols);
    const row = Math.floor(prng() * maze.rows);
    const p = cellFreePoint(maze, col, row, prng, 0.6);
    if (!farFromGuards(p.x, p.z, 1.2)) continue;
    grass.push([+p.x.toFixed(2), +p.z.toFixed(2)]);
  }

  const listenerPath = maze.rooms.map((room) => new Vector3(+room.cx.toFixed(2), 0, +room.cz.toFixed(2)));

  return {
    seed,
    mastery,
    cellSize: maze.cellSize,
    startPoint,
    initialHeading,
    markers,
    exitPoint,
    gateRotation,
    walls,
    hiddenWalls,
    gateWallPlacement,
    columns,
    rubble,
    grass,
    listenerPath,
    rooms: maze.rooms.map((room) => ({ x: +room.cx.toFixed(2), z: +room.cz.toFixed(2), theme: room.theme })),
  };
}
