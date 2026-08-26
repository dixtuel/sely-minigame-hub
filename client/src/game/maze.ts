// Grid-based maze generation (recursive backtracker + optional braiding + gate lock)
// Produces real branching corridors, dead ends, and a single locked bottleneck edge
// that gates the exit — replacing the old "visit 4 corners" bezier route.

export type MazeCell = {
  col: number;
  row: number;
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
};

export type MazeWall = { x1: number; z1: number; x2: number; z2: number };

export type MazeRoom = { col: number; row: number; size: number; cx: number; cz: number; theme: 0 | 1 | 2 | 3 };

export type MazeResult = {
  cols: number;
  rows: number;
  cellSize: number;
  originX: number;
  originZ: number;
  cells: MazeCell[][];
  walls: MazeWall[];
  gateWall: MazeWall;
  gateCell: { col: number; row: number };
  startCell: { col: number; row: number };
  markerCells: { col: number; row: number }[];
  rooms: MazeRoom[];
};

type Dir = "north" | "south" | "east" | "west";
const OPPOSITE: Record<Dir, Dir> = { north: "south", south: "north", east: "west", west: "east" };

export function cellCenter(result: Pick<MazeResult, "cellSize" | "originX" | "originZ">, col: number, row: number) {
  return {
    x: result.originX + col * result.cellSize + result.cellSize / 2,
    z: result.originZ + row * result.cellSize + result.cellSize / 2,
  };
}

export const MAZE_COLS = 13;
export const MAZE_ROWS = 11;
export const MAZE_CELL_SIZE = 2.3;

export function generateMaze(
  rng: () => number,
  mastery: number,
  cols = MAZE_COLS,
  rows = MAZE_ROWS,
  cellSize = MAZE_CELL_SIZE,
): MazeResult {
  const originX = -(cols * cellSize) / 2;
  const originZ = -(rows * cellSize) / 2;

  const cells: MazeCell[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({ col, row, north: true, south: true, east: true, west: true })),
  );

  const visited: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const parentEdge = new Map<string, MazeWall>();
  const key = (c: number, r: number) => `${c},${r}`;

  const neighborsOf = (c: number, r: number): [number, number, Dir][] => {
    const list: [number, number, Dir][] = [];
    if (r > 0) list.push([c, r - 1, "north"]);
    if (r < rows - 1) list.push([c, r + 1, "south"]);
    if (c > 0) list.push([c - 1, r, "west"]);
    if (c < cols - 1) list.push([c + 1, r, "east"]);
    return list;
  };

  const wallSegmentFor = (c: number, r: number, dir: Dir): MazeWall => {
    const x0 = originX + c * cellSize;
    const z0 = originZ + r * cellSize;
    if (dir === "north") return { x1: x0, z1: z0, x2: x0 + cellSize, z2: z0 };
    if (dir === "south") return { x1: x0, z1: z0 + cellSize, x2: x0 + cellSize, z2: z0 + cellSize };
    if (dir === "west") return { x1: x0, z1: z0, x2: x0, z2: z0 + cellSize };
    return { x1: x0 + cellSize, z1: z0, x2: x0 + cellSize, z2: z0 + cellSize };
  };

  const startCol = 1 + Math.floor(rng() * 2);
  const startRow = 1 + Math.floor(rng() * 2);
  const stack: [number, number][] = [[startCol, startRow]];
  visited[startRow][startCol] = true;

  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const options = neighborsOf(c, r).filter(([nc, nr]) => !visited[nr][nc]);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nc, nr, dir] = options[Math.floor(rng() * options.length)];
    cells[r][c][dir] = false;
    cells[nr][nc][OPPOSITE[dir]] = false;
    parentEdge.set(key(nc, nr), wallSegmentFor(c, r, dir));
    visited[nr][nc] = true;
    stack.push([nc, nr]);
  }

  // BFS distances from start, ignoring nothing yet (full spanning tree — always connected).
  const dist: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  dist[startRow][startCol] = 0;
  let frontier: [number, number][] = [[startCol, startRow]];
  while (frontier.length) {
    const next: [number, number][] = [];
    for (const [c, r] of frontier) {
      const cell = cells[r][c];
      const openNeighbors: [number, number][] = [];
      if (!cell.north) openNeighbors.push([c, r - 1]);
      if (!cell.south) openNeighbors.push([c, r + 1]);
      if (!cell.east) openNeighbors.push([c + 1, r]);
      if (!cell.west) openNeighbors.push([c - 1, r]);
      for (const [nc, nr] of openNeighbors) {
        if (dist[nr][nc] === -1) {
          dist[nr][nc] = dist[r][c] + 1;
          next.push([nc, nr]);
        }
      }
    }
    frontier = next;
  }

  // Farthest cell becomes the vault behind the locked gate.
  let gateCell = { col: startCol, row: startRow };
  let bestDist = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (dist[r][c] > bestDist) {
        bestDist = dist[r][c];
        gateCell = { col: c, row: r };
      }
    }
  }
  const gateWall = parentEdge.get(key(gateCell.col, gateCell.row))!;

  // Markers: greedy farthest-point sampling among cells reachable WITHOUT crossing the gate.
  const reachablePreGate: { col: number; row: number; d: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c === gateCell.col && r === gateCell.row) continue;
      reachablePreGate.push({ col: c, row: r, d: dist[r][c] });
    }
  }
  reachablePreGate.sort((a, b) => b.d - a.d);
  const markerCells: { col: number; row: number }[] = [];
  const minSeparation = Math.max(2, Math.floor(Math.min(cols, rows) / 4));
  for (const candidate of reachablePreGate) {
    if (markerCells.length >= 3) break;
    if (candidate.col === startCol && candidate.row === startRow) continue;
    const farEnough = markerCells.every((m) => Math.abs(m.col - candidate.col) + Math.abs(m.row - candidate.row) >= minSeparation);
    if (farEnough) markerCells.push({ col: candidate.col, row: candidate.row });
  }
  while (markerCells.length < 3) {
    const fallback = reachablePreGate[markerCells.length + 3] ?? reachablePreGate[reachablePreGate.length - 1];
    markerCells.push({ col: fallback.col, row: fallback.row });
  }

  // Braiding: remove some dead-end walls to add loops/branches. More mastery -> more open.
  const braidChance = Math.max(0.12, Math.min(0.55, 0.16 + mastery * 0.09));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if (c === gateCell.col && r === gateCell.row) continue;
      const openCount = [cell.north, cell.south, cell.east, cell.west].filter((w) => !w).length;
      if (openCount !== 1) continue;
      if (rng() > braidChance) continue;
      const closedDirs = (["north", "south", "east", "west"] as Dir[]).filter((d) => cell[d]);
      for (const dir of closedDirs) {
        const delta: Record<Dir, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
        const [dc, dr] = delta[dir];
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (nc === gateCell.col && nr === gateCell.row) continue;
        if (rng() < 0.6) {
          cell[dir] = false;
          cells[nr][nc][OPPOSITE[dir]] = false;
          break;
        }
      }
    }
  }

  // Theme rooms: open a small 2x2 pocket near each quadrant center for variety/decoration.
  const themeAnchors: [number, number][] = [
    [Math.floor(cols * 0.25), Math.floor(rows * 0.25)],
    [Math.floor(cols * 0.75), Math.floor(rows * 0.25)],
    [Math.floor(cols * 0.75), Math.floor(rows * 0.75)],
    [Math.floor(cols * 0.25), Math.floor(rows * 0.75)],
  ];
  const rooms: MazeRoom[] = [];
  themeAnchors.forEach(([ac, ar], theme) => {
    const c0 = Math.min(cols - 2, Math.max(0, ac));
    const r0 = Math.min(rows - 2, Math.max(0, ar));
    const block = [
      [c0, r0], [c0 + 1, r0], [c0, r0 + 1], [c0 + 1, r0 + 1],
    ];
    const isLocked = block.some(([c, r]) => c === gateCell.col && r === gateCell.row);
    if (!isLocked) {
      cells[r0][c0].east = false;
      cells[r0][c0 + 1].west = false;
      cells[r0 + 1][c0].east = false;
      cells[r0 + 1][c0 + 1].west = false;
      cells[r0][c0].south = false;
      cells[r0 + 1][c0].north = false;
      cells[r0][c0 + 1].south = false;
      cells[r0 + 1][c0 + 1].north = false;
    }
    const center = cellCenter({ cellSize, originX, originZ }, c0 + 1, r0 + 1);
    rooms.push({ col: c0, row: r0, size: 2, cx: center.x, cz: center.z, theme: theme as 0 | 1 | 2 | 3 });
  });

  // Emit interior wall segments (skip the perimeter — the outer boundary mesh already covers it,
  // and skip the gate wall — it is tracked separately so it can be toggled open at runtime).
  const walls: MazeWall[] = [];
  const gateKey = `${gateWall.x1},${gateWall.z1},${gateWall.x2},${gateWall.z2}`;
  const seen = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if (cell.north && r > 0) {
        const seg = wallSegmentFor(c, r, "north");
        const k = `${seg.x1},${seg.z1},${seg.x2},${seg.z2}`;
        if (!seen.has(k) && k !== gateKey) {
          seen.add(k);
          walls.push(seg);
        }
      }
      if (cell.west && c > 0) {
        const seg = wallSegmentFor(c, r, "west");
        const k = `${seg.x1},${seg.z1},${seg.x2},${seg.z2}`;
        if (!seen.has(k) && k !== gateKey) {
          seen.add(k);
          walls.push(seg);
        }
      }
    }
  }

  return {
    cols,
    rows,
    cellSize,
    originX,
    originZ,
    cells,
    walls,
    gateWall,
    gateCell,
    startCell: { col: startCol, row: startRow },
    markerCells,
    rooms,
  };
}
