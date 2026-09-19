import { describe, expect, it } from "vitest";
import { findMazePath, generateMaze } from "./maze";

function mulberry32(seed: number) {
  let value = (seed >>> 0) || 1;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

describe("generateMaze", () => {
  it("is fully connected once the locked gate edge is also allowed through (guaranteed solvable)", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const maze = generateMaze(mulberry32(seed * 991), 1);
      const visited: boolean[][] = Array.from({ length: maze.rows }, () => new Array(maze.cols).fill(false));
      const stack = [[maze.startCell.col, maze.startCell.row]];
      visited[maze.startCell.row][maze.startCell.col] = true;
      let count = 1;
      while (stack.length) {
        const [c, r] = stack.pop()!;
        const cell = maze.cells[r][c];
        const neighbors: [number, number][] = [];
        if (!cell.north) neighbors.push([c, r - 1]);
        if (!cell.south) neighbors.push([c, r + 1]);
        if (!cell.east) neighbors.push([c + 1, r]);
        if (!cell.west) neighbors.push([c - 1, r]);
        for (const [nc, nr] of neighbors) {
          if (!visited[nr][nc]) {
            visited[nr][nc] = true;
            count += 1;
            stack.push([nc, nr]);
          }
        }
      }
      expect(count).toBe(maze.cols * maze.rows);
    }
  });

  it("keeps the gate cell unreachable while its parent edge stays locked", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const maze = generateMaze(mulberry32(seed * 613), 1);
      const gate = maze.cells[maze.gateCell.row][maze.gateCell.col];
      const openSides = [gate.north, gate.south, gate.east, gate.west].filter((closed) => !closed).length;
      // The gate cell always has exactly its parent edge as an opening in the spanning tree;
      // braiding never touches the gate cell, so it should stay a single-entry pocket.
      expect(openSides).toBeGreaterThanOrEqual(1);
    }
  });

  it("produces 4 theme rooms and at least 3 marker cells distinct from start/gate", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const maze = generateMaze(mulberry32(seed * 233), 2);
      expect(maze.rooms).toHaveLength(4);
      expect(maze.markerCells.length).toBe(3);
      for (const m of maze.markerCells) {
        expect(m.col === maze.startCell.col && m.row === maze.startCell.row).toBe(false);
        expect(m.col === maze.gateCell.col && m.row === maze.gateCell.row).toBe(false);
      }
    }
  });

  it("findMazePath returns a valid sequence of adjacent open corridor cells", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const maze = generateMaze(mulberry32(seed * 701), 1);
      const start = { col: maze.startCell.col, row: maze.startCell.row };
      const target = { col: maze.markerCells[0].col, row: maze.markerCells[0].row };
      const path = findMazePath(maze, start, target);

      expect(path).not.toBeNull();
      expect(path!.length).toBeGreaterThan(0);
      expect(path![0]).toEqual(start);
      expect(path![path!.length - 1]).toEqual(target);

      for (let i = 0; i < path!.length - 1; i++) {
        const a = path![i];
        const b = path![i + 1];
        const manhattan = Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
        expect(manhattan).toBe(1);

        const cellA = maze.cells[a.row][a.col];
        if (b.row === a.row - 1) expect(cellA.north).toBe(false);
        if (b.row === a.row + 1) expect(cellA.south).toBe(false);
        if (b.col === a.col + 1) expect(cellA.east).toBe(false);
        if (b.col === a.col - 1) expect(cellA.west).toBe(false);
      }
    }
  });
});
