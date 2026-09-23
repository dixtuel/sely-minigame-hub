/**
 * 2048 Engine & Grid Traversal Algorithms
 * Original game mechanics by Gabriele Cirulli (MIT License)
 * Adapted to SELY MiniGame Hub modular architecture.
 */

export interface TileItem {
  id: number;
  x: number;
  y: number;
  value: number;
  mergedFrom?: TileItem[] | null;
}

export interface Position {
  x: number;
  y: number;
}

export const GAME_2048_CONFIG = {
  size: 4,
  startTiles: 2,
};

export const DIRECTION_VECTORS: Record<number, Position> = {
  0: { x: 0, y: -1 }, // Up
  1: { x: 1, y: 0 },  // Right
  2: { x: 0, y: 1 },  // Down
  3: { x: -1, y: 0 }, // Left
};

export class Game2048Engine {
  size: number;
  grid: (TileItem | null)[][];
  score: number;
  won: boolean;
  over: boolean;
  tileIdCounter: number;
  private rng: () => number;

  constructor(seed: number) {
    this.size = GAME_2048_CONFIG.size;
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    this.score = 0;
    this.won = false;
    this.over = false;
    this.tileIdCounter = 1;

    let rngVal = (seed ^ 0x2048a5a5) >>> 0;
    this.rng = () => {
      rngVal = (Math.imul(rngVal, 1664525) + 1013904223) >>> 0;
      return rngVal / 4294967296;
    };

    // Add initial tiles
    for (let i = 0; i < GAME_2048_CONFIG.startTiles; i++) {
      this.addRandomTile();
    }
  }

  availableCells(): Position[] {
    const cells: Position[] = [];
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        if (!this.grid[x][y]) {
          cells.push({ x, y });
        }
      }
    }
    return cells;
  }

  addRandomTile() {
    const available = this.availableCells();
    if (available.length > 0) {
      const idx = Math.floor(this.rng() * available.length);
      const cell = available[idx];
      const value = this.rng() < 0.9 ? 2 : 4;
      const tile: TileItem = {
        id: this.tileIdCounter++,
        x: cell.x,
        y: cell.y,
        value,
      };
      this.grid[cell.x][cell.y] = tile;
    }
  }

  buildTraversals(vector: Position): { x: number[]; y: number[] } {
    const traversals: { x: number[]; y: number[] } = { x: [], y: [] };
    for (let pos = 0; pos < this.size; pos++) {
      traversals.x.push(pos);
      traversals.y.push(pos);
    }
    if (vector.x === 1) traversals.x.reverse();
    if (vector.y === 1) traversals.y.reverse();
    return traversals;
  }

  findFarthestPosition(cell: Position, vector: Position): { farthest: Position; next: Position } {
    let previous: Position;
    let nextCell = { ...cell };

    do {
      previous = nextCell;
      nextCell = { x: previous.x + vector.x, y: previous.y + vector.y };
    } while (
      nextCell.x >= 0 &&
      nextCell.x < this.size &&
      nextCell.y >= 0 &&
      nextCell.y < this.size &&
      !this.grid[nextCell.x][nextCell.y]
    );

    return { farthest: previous, next: nextCell };
  }

  move(direction: number): boolean {
    if (this.over) return false;

    const vector = DIRECTION_VECTORS[direction];
    if (!vector) return false;

    const traversals = this.buildTraversals(vector);
    let moved = false;

    // Clear previous merge flags
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const t = this.grid[x][y];
        if (t) t.mergedFrom = null;
      }
    }

    traversals.x.forEach(x => {
      traversals.y.forEach(y => {
        const tile = this.grid[x][y];
        if (tile) {
          const positions = this.findFarthestPosition({ x, y }, vector);
          const nextTile =
            positions.next.x >= 0 &&
            positions.next.x < this.size &&
            positions.next.y >= 0 &&
            positions.next.y < this.size
              ? this.grid[positions.next.x][positions.next.y]
              : null;

          if (nextTile && nextTile.value === tile.value && !nextTile.mergedFrom) {
            const mergedValue = tile.value * 2;
            const mergedTile: TileItem = {
              id: this.tileIdCounter++,
              x: positions.next.x,
              y: positions.next.y,
              value: mergedValue,
              mergedFrom: [tile, nextTile],
            };

            this.grid[positions.next.x][positions.next.y] = mergedTile;
            this.grid[x][y] = null;
            this.score += mergedValue;

            if (mergedValue === 2048) {
              this.won = true;
            }
            moved = true;
          } else {
            // Move to farthest
            if (positions.farthest.x !== x || positions.farthest.y !== y) {
              this.grid[positions.farthest.x][positions.farthest.y] = tile;
              this.grid[x][y] = null;
              tile.x = positions.farthest.x;
              tile.y = positions.farthest.y;
              moved = true;
            }
          }
        }
      });
    });

    if (moved) {
      this.addRandomTile();
      if (!this.movesAvailable()) {
        this.over = true;
      }
    }

    return moved;
  }

  movesAvailable(): boolean {
    if (this.availableCells().length > 0) return true;

    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.grid[x][y];
        if (tile) {
          for (let dir = 0; dir < 4; dir++) {
            const v = DIRECTION_VECTORS[dir];
            const nx = x + v.x;
            const ny = y + v.y;
            if (nx >= 0 && nx < this.size && ny >= 0 && ny < this.size) {
              const neighbor = this.grid[nx][ny];
              if (neighbor && neighbor.value === tile.value) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
}
