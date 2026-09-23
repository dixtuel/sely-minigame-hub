//! Tetris Game Engine & Bitwise Collision Logic
//! Ported from jakesgordon/javascript-tetris.
//! 16-bit hex piece bitmasks, 10x20 grid, 7-bag randomizer and bitwise collision tests.

use serde::{Deserialize, Serialize};

pub const TETRIS_COLS: usize = 10;
pub const TETRIS_ROWS: usize = 20;

/// 16-bit piece definitions in 4 orientations (0°, 90°, 180°, 270°)
pub const PIECE_I: [u16; 4] = [0x0F00, 0x2222, 0x00F0, 0x4444];
pub const PIECE_J: [u16; 4] = [0x44C0, 0x8E00, 0x6440, 0x0E20];
pub const PIECE_L: [u16; 4] = [0x4460, 0x0E80, 0xC440, 0x2E00];
pub const PIECE_O: [u16; 4] = [0xCC00, 0xCC00, 0xCC00, 0xCC00];
pub const PIECE_S: [u16; 4] = [0x06C0, 0x8C40, 0x6C00, 0x4620];
pub const PIECE_T: [u16; 4] = [0x0E40, 0x4C40, 0x4E00, 0x4640];
pub const PIECE_Z: [u16; 4] = [0x0C60, 0x4C80, 0xC600, 0x2640];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum TetrominoType {
    I,
    J,
    L,
    O,
    S,
    T,
    Z,
}

impl TetrominoType {
    pub fn get_rotations(&self) -> [u16; 4] {
        match self {
            TetrominoType::I => PIECE_I,
            TetrominoType::J => PIECE_J,
            TetrominoType::L => PIECE_L,
            TetrominoType::O => PIECE_O,
            TetrominoType::S => PIECE_S,
            TetrominoType::T => PIECE_T,
            TetrominoType::Z => PIECE_Z,
        }
    }

    pub fn color_hex(&self) -> &'static str {
        match self {
            TetrominoType::I => "#296A55",
            TetrominoType::J => "#293B75",
            TetrominoType::L => "#E5B341",
            TetrominoType::O => "#654169",
            TetrominoType::S => "#E9563F",
            TetrominoType::T => "#1B1A1B",
            TetrominoType::Z => "#D9381E",
        }
    }
}

/// Checks bitwise collision between a piece at (x, y) with rotation and a 10x20 grid
pub fn check_tetris_collision(
    piece_type: TetrominoType,
    rot_idx: usize,
    x: i32,
    y: i32,
    grid: &[[Option<&'static str>; TETRIS_COLS]; TETRIS_ROWS],
) -> bool {
    let mask = piece_type.get_rotations()[rot_idx % 4];
    for bit in 0..16 {
        if (mask & (0x8000 >> bit)) != 0 {
            let col = x + (bit % 4);
            let row = y + (bit / 4);

            if col < 0 || col >= (TETRIS_COLS as i32) || row >= (TETRIS_ROWS as i32) {
                return true; // Wall or floor collision
            }
            if row >= 0 && grid[row as usize][col as usize].is_some() {
                return true; // Occupied block collision
            }
        }
    }
    false
}
