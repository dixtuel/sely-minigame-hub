/**
 * Lights Out Engine & Solvable Matrix Generator
 * Original logic from muthuspark/javascript-games (Muthukrishnan, MIT License)
 * Adapted to SELY MiniGame Hub modular architecture.
 */

export interface LightsOutConfig {
  size: number;
  shuffles: number;
}

export const LIGHTS_OUT_LEVELS: Record<number, LightsOutConfig> = {
  1: { size: 3, shuffles: 4 },
  2: { size: 4, shuffles: 6 },
  3: { size: 5, shuffles: 9 },
  4: { size: 6, shuffles: 12 },
  5: { size: 7, shuffles: 16 },
};

/**
 * Toggles a cell and its 4 orthogonal neighbors
 */
export function toggleLightCell(grid: boolean[][], r: number, c: number, size: number) {
  const deltas = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dr, dc] of deltas) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
      grid[nr][nc] = !grid[nr][nc];
    }
  }
}

/**
 * Generates a guaranteed solvable puzzle by simulating random valid moves from an all-off grid
 */
export function generateSolvableLightsOutGrid(size: number, shuffles: number, seed: number): boolean[][] {
  const grid: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  let rngVal = (seed ^ 0x3f51a2d7) >>> 0;
  const nextRng = () => {
    rngVal = (Math.imul(rngVal, 1664525) + 1013904223) >>> 0;
    return rngVal / 4294967296;
  };

  for (let i = 0; i < shuffles; i++) {
    const r = Math.floor(nextRng() * size);
    const c = Math.floor(nextRng() * size);
    toggleLightCell(grid, r, c, size);
  }

  // Ensure at least one light is on
  const hasLight = grid.some(row => row.some(cell => cell));
  if (!hasLight) {
    const r = Math.floor(nextRng() * size);
    const c = Math.floor(nextRng() * size);
    toggleLightCell(grid, r, c, size);
  }

  return grid;
}

export function isLightsOutCleared(grid: boolean[][]): boolean {
  return grid.every(row => row.every(cell => !cell));
}
