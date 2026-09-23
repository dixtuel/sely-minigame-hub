//! Lights Out Game Logic
//! Ported from muthuspark/javascript-games LightsOutPage.vue.
//! 3x3 to 7x7 grid configurations, 4-neighbor toggle logic and solvability check.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LightsOutGrid {
    pub size: usize,
    pub board: Vec<Vec<bool>>,
}

impl LightsOutGrid {
    pub fn new(size: usize) -> Self {
        Self {
            size,
            board: vec![vec![false; size]; size],
        }
    }

    /// Toggles the cell at (r, c) and its 4 adjacent neighbors (North, South, East, West)
    pub fn toggle_cell(&mut self, r: usize, c: usize) {
        if r >= self.size || c >= self.size {
            return;
        }

        let deltas: [(i32, i32); 5] = [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)];
        for (dr, dc) in deltas {
            let nr = r as i32 + dr;
            let nc = c as i32 + dc;
            if nr >= 0 && nr < self.size as i32 && nc >= 0 && nc < self.size as i32 {
                let ur = nr as usize;
                let uc = nc as usize;
                self.board[ur][uc] = !self.board[ur][uc];
            }
        }
    }

    /// Checks if all lights are completely extinguished (win condition)
    pub fn is_all_lights_out(&self) -> bool {
        self.board.iter().all(|row| row.iter().all(|&cell| !cell))
    }

    /// Count how many lights are currently active
    pub fn active_lights_count(&self) -> usize {
        self.board.iter().map(|row| row.iter().filter(|&&c| c).count()).sum()
    }
}
