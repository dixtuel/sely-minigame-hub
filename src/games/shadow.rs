//! Shadow game level generation and solver
//! Matches client/src/lib/levelGenerators/shadow.ts.

use std::collections::{HashSet, VecDeque};
use serde::{Deserialize, Serialize};
use super::rng::Mulberry32;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShadowPoint {
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ShadowLevel {
    pub size: usize,
    pub pads: Vec<ShadowPoint>,
    pub exit: ShadowPoint,
    pub inverse_tiles: Vec<ShadowPoint>,
    pub lag: usize,
    pub lesson: String,
    pub lesson_en: Option<String>,
}

pub fn index_for(seed: u32, salt: u32, length: usize) -> usize {
    if length == 0 {
        return 0;
    }
    let val = (seed.wrapping_add(salt)).wrapping_mul(1103515245) as i32;
    ((val as i64).abs() as usize) % length
}

fn clamp(val: i32, min: i32, max: i32) -> i32 {
    val.max(min).min(max)
}

pub fn build_shadow_level_candidate(seed: u32, mastery: u32) -> ShadowLevel {
    let size = if mastery >= 3 { 6 } else { 5 };
    let mut random = Mulberry32::new(seed ^ 0x5bd1e995);
    let lag = if mastery >= 4 { 3 } else { 2 };

    let mut exit_candidates: Vec<ShadowPoint> = Vec::new();
    for i in 1..size {
        exit_candidates.push(ShadowPoint { x: size as i32 - 1, y: i as i32 });
        exit_candidates.push(ShadowPoint { x: i as i32, y: size as i32 - 1 });
    }
    let exit = exit_candidates[index_for(seed, 211, exit_candidates.len())];

    let mut inner = || 1 + (random.next_f64() * (size - 2) as f64).floor() as i32;
    let col_a = inner();
    let row_a = inner();

    let offsets: Vec<(i32, i32)> = if lag == 2 {
        vec![
            (2, 0), (-2, 0), (0, 2), (0, -2),
            (1, 1), (1, -1), (-1, 1), (-1, -1),
        ]
    } else {
        vec![
            (1, 0), (-1, 0), (0, 1), (0, -1),
            (3, 0), (-3, 0), (0, 3), (0, -3),
            (2, 1), (2, -1), (-2, 1), (-2, -1),
            (1, 2), (1, -2), (-1, 2), (-1, -2),
        ]
    };

    let mut valid_pads_b: Vec<ShadowPoint> = Vec::new();
    for (dx, dy) in offsets {
        let bx = col_a + dx;
        let by = row_a + dy;
        let s = size as i32;
        if bx >= 0 && bx < s && by >= 0 && by < s {
            if (bx != 0 || by != 0) && (bx != exit.x || by != exit.y) && (bx != col_a || by != row_a) {
                valid_pads_b.push(ShadowPoint { x: bx, y: by });
            }
        }
    }

    let pad_b = if !valid_pads_b.is_empty() {
        valid_pads_b[index_for(seed, 937, valid_pads_b.len())]
    } else {
        ShadowPoint {
            x: col_a,
            y: clamp(row_a + if lag == 2 { 2 } else { 1 }, 0, size as i32 - 1),
        }
    };

    let inverse_tiles: Vec<ShadowPoint> = if mastery >= 3 {
        vec![ShadowPoint { x: inner(), y: inner() }]
    } else {
        Vec::new()
    };

    let lesson = if mastery >= 3 {
        "Işık prizmasından geçen gölgenin yönü tersine döner. Gecikmeli gölgeni arkandan sürükleyerek iki pedi aynı anda aktif et.".to_string()
    } else {
        format!(
            "Gölgen {} hamle geriden gelir. İki pedi eşleştirmek için bir pedden diğerine {} adımda kesintisiz geç.",
            lag, lag
        )
    };

    let lesson_en = if mastery >= 3 {
        Some("Crossing light prisms inverts the shadow's direction. Trace your steps so your delayed shadow matches both pads.".to_string())
    } else {
        Some(format!(
            "Your shadow follows {} steps behind. Walk from one pad to the other in exactly {} steps to match both.",
            lag, lag
        ))
    };

    ShadowLevel {
        size,
        pads: vec![ShadowPoint { x: col_a, y: row_a }, pad_b],
        exit,
        inverse_tiles,
        lag,
        lesson,
        lesson_en,
    }
}

pub fn is_shadow_level_solvable(level: &ShadowLevel) -> bool {
    let size = level.size as i32;

    let on_pad = |r: i32, c: i32| -> bool {
        level.pads.iter().any(|p| p.x == c && p.y == r)
    };

    let is_inverse = |r: i32, c: i32| -> bool {
        level.inverse_tiles.iter().any(|p| p.x == c && p.y == r)
    };

    #[derive(Clone, PartialEq, Eq, Hash)]
    struct StateKey {
        player: (i32, i32),
        shadow: (i32, i32),
        history: Vec<(i32, i32)>,
        open: bool,
    }

    struct QueueItem {
        state: StateKey,
        steps: usize,
    }

    let initial_key = StateKey {
        player: (0, 0),
        shadow: (0, 0),
        history: Vec::new(),
        open: false,
    };

    let mut seen: HashSet<StateKey> = HashSet::new();
    seen.insert(initial_key.clone());

    let mut queue: VecDeque<QueueItem> = VecDeque::new();
    queue.push_back(QueueItem {
        state: initial_key,
        steps: 0,
    });

    let moves: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

    while let Some(current) = queue.pop_front() {
        if current.state.open && current.state.player.0 == level.exit.y && current.state.player.1 == level.exit.x {
            return true;
        }

        if current.steps >= 36 {
            continue;
        }

        for &(dr, dc) in &moves {
            let next_player = (
                clamp(current.state.player.0 + dr, 0, size - 1),
                clamp(current.state.player.1 + dc, 0, size - 1),
            );

            if next_player == current.state.player {
                continue;
            }

            let mut next_shadow = current.state.shadow;
            if current.state.history.len() >= level.lag {
                let (lag_dr, lag_dc) = current.state.history[0];
                let factor = if is_inverse(next_shadow.0, next_shadow.1) { -1 } else { 1 };
                next_shadow = (
                    clamp(next_shadow.0 + lag_dr * factor, 0, size - 1),
                    clamp(next_shadow.1 + lag_dc * factor, 0, size - 1),
                );
            }

            let mut next_history = current.state.history.clone();
            next_history.push((dr, dc));
            if next_history.len() > level.lag {
                next_history.remove(0);
            }

            let p_on = on_pad(next_player.0, next_player.1);
            let s_on = on_pad(next_shadow.0, next_shadow.1);
            let open = current.state.open || (p_on && s_on && next_player != next_shadow);

            let next_key = StateKey {
                player: next_player,
                shadow: next_shadow,
                history: next_history,
                open,
            };

            if !seen.contains(&next_key) {
                seen.insert(next_key.clone());
                queue.push_back(QueueItem {
                    state: next_key,
                    steps: current.steps + 1,
                });
            }
        }
    }

    false
}

pub fn generate_shadow_level(seed: u32, mastery: u32) -> ShadowLevel {
    for attempt in 0..12 {
        let candidate = build_shadow_level_candidate(seed.wrapping_add(attempt * 7331), mastery);
        if is_shadow_level_solvable(&candidate) {
            return candidate;
        }
    }
    build_shadow_level_candidate(seed, mastery)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shadow_level_generation() {
        let level = generate_shadow_level(101, 1);
        assert_eq!(level.size, 5);
        assert_eq!(level.pads.len(), 2);
        assert_eq!(level.lag, 2);
        assert!(is_shadow_level_solvable(&level));
    }

    #[test]
    fn test_shadow_level_mastery_high() {
        let level = generate_shadow_level(202, 3);
        assert_eq!(level.size, 6);
        assert_eq!(level.inverse_tiles.len(), 1);
    }
}
