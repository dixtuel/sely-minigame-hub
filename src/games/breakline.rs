//! Seeded Breakline run layouts shared by the native server and browser WASM.

use crate::games::rng::Mulberry32;
use serde::{Deserialize, Serialize};

pub const BREAKLINE_COLS: usize = 11;
pub const BREAKLINE_ROWS: usize = 9;
pub const BREAKLINE_STAGE_COUNT: usize = 8;

const PATTERNS: [[&str; BREAKLINE_ROWS]; 23] = [
    [
        "00001110000", "00012221000", "00122222100", "01221112210", "12211111221",
        "01221112210", "00122222100", "00012221000", "00001110000",
    ],
    [
        "00001110000", "00001110000", "11111111111", "12223332221", "11111111111",
        "00001110000", "00001110000", "00001110000", "00000000000",
    ],
    [
        "11000000011", "22100000122", "12210001221", "01221012210", "00122122100",
        "01221012210", "12210001221", "22100000122", "11000000011",
    ],
    [
        "11111111111", "12222222221", "00111111100", "00022222000", "00011111000",
        "00022222000", "00111111100", "12222222221", "11111111111",
    ],
    [
        "11001100110", "22112211221", "11111111111", "00220022000", "00110011000",
        "00220022000", "11111111111", "22112211221", "11001100110",
    ],
    [
        "11100000111", "12110001121", "11221012211", "01122122110", "00122222100",
        "01122122110", "11221012211", "12110001121", "11100000111",
    ],
    [
        "11111111111", "12222222221", "12000000021", "12011111021", "12012221021",
        "12011111021", "12000000021", "12222222221", "11111111111",
    ],
    [
        "00001110000", "00011111000", "00112221100", "01122222110", "11223332211",
        "00001110000", "00001110000", "00001110000", "00001110000",
    ],
    [
        "11111111111", "12222222221", "12000000021", "12111111021", "12122221021",
        "12111111021", "12000000021", "12222222221", "11111111111",
    ],
    [
        "11100000000", "22110000000", "11221000000", "01122100000", "00112210000",
        "00011221000", "00001122100", "00000112210", "00000011221",
    ],
    [
        "11111111111", "12000000021", "12111111021", "12100001021", "12102301021",
        "12100001021", "12111111021", "12000000021", "11111111111",
    ],
    [
        "12222222221", "21111111112", "12000000021", "12022222021", "12021112021",
        "12022222021", "12000000021", "21111111112", "12222222221",
    ],
    [
        "11111111111", "12222222221", "11111111111", "12222222221", "11111111111",
        "12222222221", "11111111111", "12222222221", "11111111111",
    ],
    [
        "10101010101", "01010101010", "10101010101", "01010101010", "10101010101",
        "01010101010", "10101010101", "01010101010", "10101010101",
    ],
    [
        "11211211211", "12112112112", "21121121121", "11211211211", "12112112112",
        "21121121121", "11211211211", "12112112112", "21121121121",
    ],
    [
        "11111111111", "00000000000", "22222222222", "00000000000", "11111111111",
        "00000000000", "22222222222", "00000000000", "11111111111",
    ],
    [
        "10000000001", "21000000012", "12100000121", "11210001211", "01121012110",
        "00112121100", "00011211000", "00001110000", "00000100000",
    ],
    [
        "11111111111", "12200000221", "12011111021", "12012221021", "12012321021",
        "12012221021", "12011111021", "12200000221", "11111111111",
    ],
    [
        "00111111000", "01222222100", "12211111210", "12100001221", "12100001221",
        "12211111210", "01222222100", "00111111000", "00011100000",
    ],
    [
        "11100000111", "12210001221", "11221012211", "01122122110", "00112211000",
        "01122122110", "11221012211", "12210001221", "11100000111",
    ],
    [
        "00111111100", "01222222210", "12211111221", "12100001221", "12123321221",
        "12100001221", "12211111221", "01222222210", "00111111100",
    ],
    [
        "00111111100", "01222222210", "12211111221", "12210001221", "12210001221",
        "12211111221", "01222222210", "00111111100", "00000000000",
    ],
    [
        "11111111111", "12222222221", "12000000021", "12111111021", "12100001021",
        "12101101021", "12100001021", "12222222221", "11111111111",
    ],
];

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreaklineStage {
    pub pattern_index: usize,
    pub mirror_x: bool,
    pub mirror_y: bool,
    pub cells: Vec<u8>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BreaklineRun {
    pub version: u8,
    pub seed: u32,
    pub mastery: u8,
    pub cols: usize,
    pub rows: usize,
    pub stages: Vec<BreaklineStage>,
}

pub fn generate_breakline_run(seed: u32, mastery: u32) -> BreaklineRun {
    let mastery = mastery.clamp(1, 4) as u8;
    let selector_seed = seed ^ (u32::from(mastery) + 17).wrapping_mul(0x45d9_f3b);
    let mut selector = Mulberry32::new(selector_seed);
    let mut pattern_order: Vec<usize> = (0..PATTERNS.len()).collect();
    for index in (1..pattern_order.len()).rev() {
        let swap_index = (selector.next_f64() * (index + 1) as f64).floor() as usize;
        pattern_order.swap(index, swap_index);
    }
    let mut stages = Vec::with_capacity(BREAKLINE_STAGE_COUNT);

    for stage_index in 0..BREAKLINE_STAGE_COUNT {
        let pattern_index = pattern_order[stage_index];
        let stage_seed = seed
            ^ (u32::from(mastery) + 31).wrapping_mul(0x27d4_eb2d)
            ^ (stage_index as u32 + 1).wrapping_mul(0x1656_67b1);
        let mut orientation = Mulberry32::new(stage_seed);
        let mirror_x = orientation.next_f64() >= 0.5;
        let mirror_y = orientation.next_f64() >= 0.5;
        let difficulty = u32::from(mastery) + stage_index as u32;
        let mut cells = vec![0; BREAKLINE_ROWS * BREAKLINE_COLS];

        for row in 0..BREAKLINE_ROWS {
            for col in 0..BREAKLINE_COLS {
                let glyph = PATTERNS[pattern_index][row].as_bytes()[col];
                let mut hp = glyph.saturating_sub(b'0');
                if hp == 1
                    && difficulty >= 4
                    && (row * 17 + col * 11 + (seed as usize & 31) + stage_index * 3) % 13 == 0
                {
                    hp = 2;
                } else if hp == 2
                    && difficulty >= 6
                    && (row * 3 + col * 5 + stage_index) % 11 == 0
                {
                    hp = 3;
                }

                let target_row = if mirror_y { BREAKLINE_ROWS - 1 - row } else { row };
                let target_col = if mirror_x { BREAKLINE_COLS - 1 - col } else { col };
                cells[target_row * BREAKLINE_COLS + target_col] = hp;
            }
        }

        stages.push(BreaklineStage { pattern_index, mirror_x, mirror_y, cells });
    }

    BreaklineRun {
        version: 1,
        seed,
        mastery,
        cols: BREAKLINE_COLS,
        rows: BREAKLINE_ROWS,
        stages,
    }
}
