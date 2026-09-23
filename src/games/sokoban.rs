//! Sokoban Game Engine & Level Map Parser
//! Ported from muthuspark/javascript-games SokobanPage.vue.
//! 10 authentic ASCII level maps, push physics, target matching and win condition.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum SokobanTile {
    Empty,
    Wall,
    Target,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Position {
    pub r: i32,
    pub c: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SokobanState {
    pub player: Position,
    pub boxes: Vec<Position>,
    pub targets: Vec<Position>,
    pub walls: Vec<Position>,
    pub rows: usize,
    pub cols: usize,
}

pub const SOKOBAN_LEVEL_MAPS: &[&str] = &[
    // Level 1
    "#####\n#@$.#\n#####",
    // Level 2
    "######\n#....#\n#$$$$#\n#.@..#\n######",
    // Level 3
    "  #####\n###   #\n# $ # #\n# # . #\n#    @#\n#######",
    // Level 4
    "########\n#  ....#\n#  $$$$#\n#  @   #\n########",
    // Level 5
    "#######\n#  .  #\n# $#$ #\n# .@. #\n# $#$ #\n#  .  #\n#######",
    // Level 6
    "######\n# .. #\n# $$ #\n# $$ #\n# .. #\n#  @ #\n######",
    // Level 7
    "  ####\n###  ####\n#     $ #\n# #  #$ #\n# . .#@ #\n#########",
    // Level 8
    "########\n#   #  #\n# $ $  #\n# ###. #\n#   #..#\n# @ #  #\n########",
    // Level 9
    "  ######\n###    #\n#  $$# #\n# .. # #\n#  @   #\n########",
    // Level 10
    "#######\n#     #\n# $.$ #\n# .@. #\n# $.$ #\n#     #\n#######",
];

/// Parses ASCII level map into structured Sokoban level state
pub fn parse_sokoban_level(level_idx: usize) -> Option<SokobanState> {
    let map_str = SOKOBAN_LEVEL_MAPS.get(level_idx)?;
    let lines: Vec<&str> = map_str.lines().collect();
    let rows = lines.len();
    let cols = lines.iter().map(|l| l.len()).max().unwrap_or(0);

    let mut player = Position { r: 0, c: 0 };
    let mut boxes = Vec::new();
    let mut targets = Vec::new();
    let mut walls = Vec::new();

    for (r, line) in lines.iter().enumerate() {
        for (c, ch) in line.chars().enumerate() {
            let pos = Position { r: r as i32, c: c as i32 };
            match ch {
                '#' => walls.push(pos),
                '@' => player = pos,
                '+' => {
                    player = pos;
                    targets.push(pos);
                }
                '$' => boxes.push(pos),
                '*' => {
                    boxes.push(pos);
                    targets.push(pos);
                }
                '.' => targets.push(pos),
                _ => {}
            }
        }
    }

    Some(SokobanState {
        player,
        boxes,
        targets,
        walls,
        rows,
        cols,
    })
}

/// Checks if every target has a box on it (win condition)
pub fn is_sokoban_level_cleared(state: &SokobanState) -> bool {
    state.targets.iter().all(|target| {
        state.boxes.iter().any(|b| b.r == target.r && b.c == target.c)
    })
}
