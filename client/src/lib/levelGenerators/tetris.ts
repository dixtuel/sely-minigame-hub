/**
 * Tetris Engine & Polyomino Tables
 * Original bitwise 16-bit masks from jakesgordon/javascript-tetris (Jake Gordon, MIT License)
 * Adapted to SELY MiniGame Hub modular architecture.
 */

export interface TetrisPieceType {
  name: string;
  size: number;
  blocks: number[]; // 4 rotation states represented as 16-bit integer masks
  color: string;
}

export interface ActivePiece {
  type: TetrisPieceType;
  dir: number; // 0..3
  x: number;
  y: number;
}

export const TETRIS_PIECES: Record<string, TetrisPieceType> = {
  i: { name: "I", size: 4, blocks: [0x0f00, 0x2222, 0x00f0, 0x4444], color: "#293B75" },
  j: { name: "J", size: 3, blocks: [0x44c0, 0x8e00, 0x6440, 0x0e20], color: "#296A55" },
  l: { name: "L", size: 3, blocks: [0x4460, 0x0e80, 0xc440, 0x2e00], color: "#E5B341" },
  o: { name: "O", size: 2, blocks: [0xcc00, 0xcc00, 0xcc00, 0xcc00], color: "#E9563F" },
  s: { name: "S", size: 3, blocks: [0x06c0, 0x8c40, 0x6c00, 0x4620], color: "#654169" },
  t: { name: "T", size: 3, blocks: [0x0e40, 0x4c40, 0x4e00, 0x4640], color: "#1B1A1B" },
  z: { name: "Z", size: 3, blocks: [0x0c60, 0x4c80, 0xc600, 0x2640], color: "#D97706" },
};

export const TETRIS_CONFIG = {
  nx: 10, // Width of court (blocks)
  ny: 20, // Height of court (blocks)
  speedStart: 0.6, // Seconds before drop
  speedDecrement: 0.006,
  speedMin: 0.09,
};

/**
 * Iterates through each block of a piece rotation mask
 */
export function forEachPieceBlock(
  type: TetrisPieceType,
  x: number,
  y: number,
  dir: number,
  fn: (bx: number, by: number) => void
) {
  let row = 0;
  let col = 0;
  const blocks = type.blocks[dir];
  for (let bit = 0x8000; bit > 0; bit = bit >> 1) {
    if (blocks & bit) {
      fn(x + col, y + row);
    }
    if (++col === 4) {
      col = 0;
      ++row;
    }
  }
}

/**
 * Checks if a piece collides with court boundaries or placed blocks
 */
export function isPieceOccupied(
  type: TetrisPieceType,
  x: number,
  y: number,
  dir: number,
  court: (string | null)[][]
): boolean {
  let result = false;
  forEachPieceBlock(type, x, y, dir, (bx, by) => {
    if (bx < 0 || bx >= TETRIS_CONFIG.nx || by < 0 || by >= TETRIS_CONFIG.ny || court[by]?.[bx] != null) {
      result = true;
    }
  });
  return result;
}

/**
 * 7-Bag Randomizer
 */
export function createTetrisBag(seed: number): () => TetrisPieceType {
  let bag: TetrisPieceType[] = [];
  const pieces = Object.values(TETRIS_PIECES);

  let rngVal = (seed ^ 0x9e3779b9) >>> 0;
  const nextRng = () => {
    rngVal = (Math.imul(rngVal, 1664525) + 1013904223) >>> 0;
    return rngVal / 4294967296;
  };

  return function nextPiece(): TetrisPieceType {
    if (bag.length === 0) {
      bag = [...pieces];
      // Fisher-Yates shuffle with deterministic RNG
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(nextRng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop()!;
  };
}
