//! SELY Knot (Düğüm) Procedural Board & Spanning Tree Generator
//! Matches client/src/lib/levelGenerators/knot.ts and levelGenerators.test.ts.

use crate::games::rng::Mulberry32;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};

pub const KNOT_COLS: usize = 4;
pub const KNOT_ROWS: usize = 4;
pub const KNOT_SOURCE_INDEX: usize = 0;
pub const KNOT_TARGET_INDEX: usize = 15;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Direction {
    N,
    E,
    S,
    W,
}

const DIRECTION_ORDER: [Direction; 4] = [Direction::N, Direction::E, Direction::S, Direction::W];

impl Direction {
    pub fn opposite(self) -> Self {
        match self {
            Direction::N => Direction::S,
            Direction::E => Direction::W,
            Direction::S => Direction::N,
            Direction::W => Direction::E,
        }
    }

    pub fn step(self) -> (isize, isize) {
        match self {
            Direction::N => (-1, 0),
            Direction::E => (0, 1),
            Direction::S => (1, 0),
            Direction::W => (0, -1),
        }
    }

    pub fn rotate(self, rot: usize) -> Self {
        let idx = match self {
            Direction::N => 0,
            Direction::E => 1,
            Direction::S => 2,
            Direction::W => 3,
        };
        DIRECTION_ORDER[(idx + rot) % 4]
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct KnotLevel {
    pub tile_shapes: Vec<Vec<Direction>>,
    pub rotations: Vec<usize>,
    pub source_index: usize,
    pub target_index: usize,
    pub target_path: Vec<usize>,
    pub bonus_index: i32,
    pub bonus_path: Vec<usize>,
    pub heat_limit: usize,
    pub lesson: String,
}

fn knot_neighbors(index: usize) -> Vec<(Direction, usize)> {
    let r = (index / KNOT_COLS) as isize;
    let c = (index % KNOT_COLS) as isize;
    let mut out = Vec::with_capacity(4);

    for &dir in &DIRECTION_ORDER {
        let (dr, dc) = dir.step();
        let nr = r + dr;
        let nc = c + dc;
        if nr >= 0 && nr < KNOT_ROWS as isize && nc >= 0 && nc < KNOT_COLS as isize {
            out.push((dir, (nr as usize) * KNOT_COLS + (nc as usize)));
        }
    }
    out
}

fn knot_direction_between(from: usize, to: usize) -> Direction {
    for (dir, n_idx) in knot_neighbors(from) {
        if n_idx == to {
            return dir;
        }
    }
    panic!("Knot: non-adjacent cells between {from} and {to}");
}

fn build_knot_spanning_tree(rng: &mut Mulberry32) -> HashMap<usize, Vec<usize>> {
    let mut adj = HashMap::new();
    for i in 0..(KNOT_COLS * KNOT_ROWS) {
        adj.insert(i, Vec::new());
    }

    let mut visited = HashSet::new();
    visited.insert(KNOT_SOURCE_INDEX);
    let mut stack = vec![KNOT_SOURCE_INDEX];

    while let Some(&current) = stack.last() {
        let options: Vec<(Direction, usize)> = knot_neighbors(current)
            .into_iter()
            .filter(|&(_, n_idx)| !visited.contains(&n_idx))
            .collect();

        if options.is_empty() {
            stack.pop();
            continue;
        }

        let pick_idx = (rng.next_f64() * (options.len() as f64)).floor() as usize;
        let (_, pick_cell) = options[pick_idx];

        visited.insert(pick_cell);
        adj.get_mut(&current).unwrap().push(pick_cell);
        adj.get_mut(&pick_cell).unwrap().push(current);
        stack.push(pick_cell);
    }

    adj
}

fn knot_tree_path(adj: &HashMap<usize, Vec<usize>>, from: usize, to: usize) -> Vec<usize> {
    let mut parent = HashMap::new();
    let mut visited = HashSet::new();
    visited.insert(from);

    let mut queue = VecDeque::new();
    queue.push_back(from);

    while let Some(current) = queue.pop_front() {
        if current == to {
            break;
        }
        if let Some(neighbors) = adj.get(&current) {
            for &next in neighbors {
                if !visited.contains(&next) {
                    visited.insert(next);
                    parent.insert(next, current);
                    queue.push_back(next);
                }
            }
        }
    }

    let mut path = vec![to];
    let mut cursor = to;
    while cursor != from {
        match parent.get(&cursor) {
            Some(&prev) => {
                path.push(prev);
                cursor = prev;
            }
            None => return Vec::new(),
        }
    }
    path.reverse();
    path
}

const KNOT_DECOY_SHAPES: &[&[Direction]] = &[
    &[Direction::N],
    &[Direction::E],
    &[Direction::S],
    &[Direction::W],
    &[Direction::N, Direction::S],
    &[Direction::E, Direction::W],
    &[Direction::N, Direction::E],
    &[Direction::E, Direction::S],
    &[Direction::S, Direction::W],
    &[Direction::W, Direction::N],
];

fn build_knot_candidate(seed: u32, mastery: i32) -> KnotLevel {
    let mut rng = Mulberry32::new(seed);
    let adj = build_knot_spanning_tree(&mut rng);
    let target_path = knot_tree_path(&adj, KNOT_SOURCE_INDEX, KNOT_TARGET_INDEX);
    let path_set: HashSet<usize> = target_path.iter().cloned().collect();

    let mut branch_candidates = Vec::new();
    if target_path.len() > 2 {
        for &cell in &target_path[1..target_path.len() - 1] {
            if let Some(neighbors) = adj.get(&cell) {
                for &neighbor in neighbors {
                    if !path_set.contains(&neighbor) {
                        branch_candidates.push((cell, neighbor));
                    }
                }
            }
        }
    }

    let chosen_branch = if mastery >= 2 && !branch_candidates.is_empty() {
        let idx = (rng.next_f64() * (branch_candidates.len() as f64)).floor() as usize;
        Some(branch_candidates[idx])
    } else {
        None
    };

    let mut tile_shapes = vec![Vec::<Direction>::new(); 16];
    for i in 0..target_path.len() {
        let cell = target_path[i];
        let mut dirs = Vec::new();
        if i > 0 {
            dirs.push(knot_direction_between(cell, target_path[i - 1]));
        }
        if i < target_path.len() - 1 {
            dirs.push(knot_direction_between(cell, target_path[i + 1]));
        }
        if let Some((branch, bonus)) = chosen_branch {
            if branch == cell {
                dirs.push(knot_direction_between(cell, bonus));
            }
        }
        tile_shapes[cell] = dirs;
    }

    if let Some((branch, bonus)) = chosen_branch {
        tile_shapes[bonus] = vec![knot_direction_between(bonus, branch)];
    }

    let mut critical_set = path_set.clone();
    if let Some((_, bonus)) = chosen_branch {
        critical_set.insert(bonus);
    }

    for i in 0..16 {
        if !critical_set.contains(&i) {
            let decoy_idx = (rng.next_f64() * (KNOT_DECOY_SHAPES.len() as f64)).floor() as usize;
            tile_shapes[i] = KNOT_DECOY_SHAPES[decoy_idx].to_vec();
        }
    }

    let rotations: Vec<usize> = (0..16)
        .map(|i| {
            if i == KNOT_SOURCE_INDEX || i == KNOT_TARGET_INDEX {
                0
            } else if critical_set.contains(&i) {
                1 + (rng.next_f64() * 3.0).floor() as usize
            } else {
                (rng.next_f64() * 4.0).floor() as usize
            }
        })
        .collect();

    let critical_non_locked: Vec<usize> = critical_set
        .iter()
        .cloned()
        .filter(|&c| c != KNOT_SOURCE_INDEX && c != KNOT_TARGET_INDEX)
        .collect();

    let required_turns: usize = critical_non_locked
        .iter()
        .map(|&c| (4 - rotations[c]) % 4)
        .sum();

    let margin = 3 + ((required_turns as f64) * 0.5).ceil() as usize;

    KnotLevel {
        tile_shapes,
        rotations,
        source_index: KNOT_SOURCE_INDEX,
        target_index: KNOT_TARGET_INDEX,
        target_path: target_path.clone(),
        bonus_index: chosen_branch.map(|(_, b)| b as i32).unwrap_or(-1),
        bonus_path: chosen_branch
            .map(|(br, bo)| vec![br, bo])
            .unwrap_or_default(),
        heat_limit: required_turns + margin,
        lesson: if mastery >= 3 {
            "Hedefe giden yolu kur; sonra fazla akışı bonus düğüme taşı.".to_string()
        } else {
            "Her dönüş, akışın nereye kaçtığını değiştirir.".to_string()
        },
    }
}

pub fn knot_connectivity(tile_shapes: &[Vec<Direction>], rotations: &[usize]) -> HashSet<usize> {
    let mut visited = HashSet::new();
    visited.insert(KNOT_SOURCE_INDEX);

    let mut queue = VecDeque::new();
    queue.push_back(KNOT_SOURCE_INDEX);

    while let Some(current) = queue.pop_front() {
        let current_rot = rotations[current];
        let rotated_dirs: Vec<Direction> = tile_shapes[current]
            .iter()
            .map(|&d| d.rotate(current_rot))
            .collect();

        for dir in rotated_dirs {
            let (dr, dc) = dir.step();
            let r = (current / KNOT_COLS) as isize + dr;
            let c = (current % KNOT_COLS) as isize + dc;
            if r < 0 || r >= KNOT_ROWS as isize || c < 0 || c >= KNOT_COLS as isize {
                continue;
            }
            let neighbor = (r as usize) * KNOT_COLS + (c as usize);
            let neighbor_rot = rotations[neighbor];
            let neighbor_rotated: Vec<Direction> = tile_shapes[neighbor]
                .iter()
                .map(|&d| d.rotate(neighbor_rot))
                .collect();

            if neighbor_rotated.contains(&dir.opposite()) && !visited.contains(&neighbor) {
                visited.insert(neighbor);
                queue.push_back(neighbor);
            }
        }
    }

    visited
}

pub fn is_knot_level_solvable(level: &KnotLevel) -> bool {
    if level.rotations.len() != 16 || level.tile_shapes.len() != 16 {
        return false;
    }
    if level.target_path.first() != Some(&level.source_index)
        || level.target_path.last() != Some(&level.target_index)
    {
        return false;
    }

    let solved_rotations: Vec<usize> = (0..16)
        .map(|i| {
            if i == level.source_index
                || i == level.target_index
                || level.target_path.contains(&i)
                || (level.bonus_index >= 0 && i == level.bonus_index as usize)
            {
                0
            } else {
                level.rotations[i]
            }
        })
        .collect();

    let connected = knot_connectivity(&level.tile_shapes, &solved_rotations);
    let target_ok = connected.contains(&level.target_index);
    let bonus_ok = level.bonus_index < 0 || connected.contains(&(level.bonus_index as usize));

    let mut critical_set: HashSet<usize> = level.target_path.iter().cloned().collect();
    if level.bonus_index >= 0 {
        critical_set.insert(level.bonus_index as usize);
    }
    let critical_non_locked: Vec<usize> = critical_set
        .into_iter()
        .filter(|&c| c != level.source_index && c != level.target_index)
        .collect();

    let required_turns: usize = critical_non_locked
        .iter()
        .map(|&c| (4 - level.rotations[c]) % 4)
        .sum();

    target_ok && bonus_ok && required_turns <= level.heat_limit
}

pub fn generate_knot_level(seed: u32, mastery: i32) -> KnotLevel {
    let mut fallback = None;
    for attempt in 0..12 {
        let candidate = build_knot_candidate(seed.wrapping_add(attempt * 7919), mastery);
        if !is_knot_level_solvable(&candidate) {
            continue;
        }
        if fallback.is_none() {
            fallback = Some(candidate.clone());
        }
        if mastery < 2 || candidate.bonus_index >= 0 {
            return candidate;
        }
    }
    fallback.unwrap_or_else(|| build_knot_candidate(seed, mastery))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_knot_level_generation_and_solvability() {
        for seed in 1..=10 {
            let level = generate_knot_level(seed * 4821, 1);
            assert_eq!(level.tile_shapes.len(), 16);
            assert_eq!(level.rotations.len(), 16);
            assert!(is_knot_level_solvable(&level));
        }
    }
}
