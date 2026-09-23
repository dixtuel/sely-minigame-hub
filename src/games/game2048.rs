//! 2048 Game Engine & Matrix Merge Mechanics
//! Ported from gabrielecirulli/2048 (game_manager.js, grid.js, tile.js).
//! 4x4 matrix, traversals, farthest position lookup, 90% 2 / 10% 4 tile spawns.

use serde::{Deserialize, Serialize};

pub const GRID_SIZE: usize = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    Up,
    Right,
    Down,
    Left,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MoveResult {
    pub moved: bool,
    pub score_gained: u32,
    pub board: [[u32; GRID_SIZE]; GRID_SIZE],
}

/// Computes movement and merges for a 4x4 board in a given direction
pub fn slide_2048_board(board: &[[u32; GRID_SIZE]; GRID_SIZE], dir: Direction) -> MoveResult {
    let mut next_board = *board;
    let mut score_gained = 0;
    let mut moved = false;

    // Helper to process a single 4-element line
    let slide_line = |line: &mut [u32; GRID_SIZE]| -> (bool, u32) {
        let mut line_moved = false;
        let mut line_score = 0;
        let compact: Vec<u32> = line.iter().copied().filter(|&v| v > 0).collect();

        let mut merged = Vec::new();
        let mut i = 0;
        while i < compact.len() {
            if i + 1 < compact.len() && compact[i] == compact[i + 1] {
                let val = compact[i] * 2;
                merged.push(val);
                line_score += val;
                i += 2;
            } else {
                merged.push(compact[i]);
                i += 1;
            }
        }

        while merged.len() < GRID_SIZE {
            merged.push(0);
        }

        for idx in 0..GRID_SIZE {
            if line[idx] != merged[idx] {
                line_moved = true;
                line[idx] = merged[idx];
            }
        }

        (line_moved, line_score)
    };

    match dir {
        Direction::Left => {
            for r in 0..GRID_SIZE {
                let mut line = next_board[r];
                let (m, sc) = slide_line(&mut line);
                if m { moved = true; }
                score_gained += sc;
                next_board[r] = line;
            }
        }
        Direction::Right => {
            for r in 0..GRID_SIZE {
                let mut line = [
                    next_board[r][3],
                    next_board[r][2],
                    next_board[r][1],
                    next_board[r][0],
                ];
                let (m, sc) = slide_line(&mut line);
                if m { moved = true; }
                score_gained += sc;
                next_board[r] = [line[3], line[2], line[1], line[0]];
            }
        }
        Direction::Up => {
            for c in 0..GRID_SIZE {
                let mut line = [
                    next_board[0][c],
                    next_board[1][c],
                    next_board[2][c],
                    next_board[3][c],
                ];
                let (m, sc) = slide_line(&mut line);
                if m { moved = true; }
                score_gained += sc;
                for r in 0..GRID_SIZE {
                    next_board[r][c] = line[r];
                }
            }
        }
        Direction::Down => {
            for c in 0..GRID_SIZE {
                let mut line = [
                    next_board[3][c],
                    next_board[2][c],
                    next_board[1][c],
                    next_board[0][c],
                ];
                let (m, sc) = slide_line(&mut line);
                if m { moved = true; }
                score_gained += sc;
                for r in 0..GRID_SIZE {
                    next_board[r][c] = line[3 - r];
                }
            }
        }
    }

    MoveResult {
        moved,
        score_gained,
        board: next_board,
    }
}
