//! Cut game level generation and solver
//! Matches client/src/lib/levelGenerators/cut.ts.

use std::collections::HashSet;
use serde::{Deserialize, Serialize};
use super::geometry::{segment_distance, Point2D};
use super::rng::Mulberry32;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CutShapePlan {
    pub id: usize,
    pub x: f64,
    pub y: f64,
    pub size: f64,
    pub color: String,
    pub target: bool,
    pub linked: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CutLevel {
    pub shapes: Vec<CutShapePlan>,
    pub cuts: usize,
    pub stain_limit: usize,
    pub lesson: String,
}

struct Effect {
    target_ids: Vec<usize>,
    stains: usize,
}

pub fn build_cut_level_candidate(seed: u32, mastery: u32) -> CutLevel {
    let mut random = Mulberry32::new(seed ^ 0x9e3779b9);
    let palette = ["#e9563f", "#e5b341", "#f6f0e3", "#66b8a0"];
    let count = (7 + mastery) as usize;
    let desired = std::cmp::min(4, 2 + mastery) as usize;
    let min_gap = 13.0f64;

    let mut points: Vec<Point2D> = Vec::with_capacity(count);

    for index in 0..count {
        let mut placed = None;
        for _tries in 0..40 {
            let candidate = Point2D {
                x: 10.0 + random.next_f64() * 80.0,
                y: 8.0 + random.next_f64() * 40.0,
            };
            if points.iter().all(|existing| {
                let dx = existing.x - candidate.x;
                let dy = existing.y - candidate.y;
                (dx * dx + dy * dy).sqrt() >= min_gap
            }) {
                placed = Some(candidate);
                break;
            }
        }
        // 40 denemede boşluk bulunamazsa ızgaraya düş
        points.push(placed.unwrap_or(Point2D {
            x: 12.0 + (index % 6) as f64 * 13.0,
            y: 10.0 + (index / 6) as f64 * 18.0,
        }));
    }

    let mut order: Vec<usize> = (0..count).collect();
    for i in (1..order.len()).rev() {
        let j = (random.next_f64() * (i + 1) as f64).floor() as usize;
        order.swap(i, j);
    }

    let target_ids: HashSet<usize> = order[0..desired].iter().cloned().collect();
    let linked_ids: HashSet<usize> = if mastery >= 3 {
        order[0..desired]
            .iter()
            .enumerate()
            .filter(|(index, _)| index % 2 == 1)
            .map(|(_, &id)| id)
            .collect()
    } else {
        HashSet::new()
    };

    let shapes = points
        .into_iter()
        .enumerate()
        .map(|(id, point)| CutShapePlan {
            id,
            x: point.x.round(),
            y: point.y.round(),
            size: 3.5 + (random.next_f64() * 2.0).round(),
            color: palette[id % palette.len()].to_string(),
            target: target_ids.contains(&id),
            linked: linked_ids.contains(&id),
        })
        .collect();

    CutLevel {
        shapes,
        cuts: if mastery >= 3 { 3 } else { 4 },
        stain_limit: (1 + mastery / 2) as usize,
        lesson: if mastery >= 3 {
            "Bağlı hedefleri aynı kesimde ayırırsan mürekkep zincirlenir.".to_string()
        } else {
            "Hedef şekilleri tek, kararlı çizgide topla.".to_string()
        },
    }
}

pub fn is_cut_level_solvable(level: &CutLevel) -> bool {
    let targets: Vec<&CutShapePlan> = level.shapes.iter().filter(|s| s.target).collect();
    let mut candidates: Vec<(Point2D, Point2D)> = Vec::new();

    for shape in &targets {
        candidates.push((
            Point2D { x: shape.x - shape.size, y: shape.y },
            Point2D { x: shape.x + shape.size, y: shape.y },
        ));
        candidates.push((
            Point2D { x: shape.x, y: shape.y - shape.size },
            Point2D { x: shape.x, y: shape.y + shape.size },
        ));
    }

    for left in 0..targets.len() {
        for right in (left + 1)..targets.len() {
            candidates.push((
                Point2D { x: targets[left].x, y: targets[left].y },
                Point2D { x: targets[right].x, y: targets[right].y },
            ));
        }
    }

    let effects: Vec<Effect> = candidates
        .into_iter()
        .filter_map(|(a, b)| {
            let hit: Vec<&CutShapePlan> = level
                .shapes
                .iter()
                .filter(|shape| {
                    segment_distance(Point2D { x: shape.x, y: shape.y }, a, b) < shape.size / 2.0 + 2.0
                })
                .collect();

            let target_ids: Vec<usize> = hit.iter().filter(|s| s.target).map(|s| s.id).collect();
            let stains = hit.iter().filter(|s| !s.target).count();

            if !target_ids.is_empty() && stains <= level.stain_limit {
                Some(Effect { target_ids, stains })
            } else {
                None
            }
        })
        .collect();

    let target_count = targets.len();
    let mut visited: HashSet<(u32, usize, usize)> = HashSet::new();

    fn search(
        covered_mask: u32,
        cuts: usize,
        stains: usize,
        target_count: usize,
        stain_limit: usize,
        effects: &[Effect],
        visited: &mut HashSet<(u32, usize, usize)>,
    ) -> bool {
        if covered_mask.count_ones() as usize == target_count {
            return true;
        }
        if cuts == 0 {
            return false;
        }

        let state = (covered_mask, cuts, stains);
        if visited.contains(&state) {
            return false;
        }
        visited.insert(state);

        for effect in effects {
            if stains + effect.stains <= stain_limit {
                let mut next_mask = covered_mask;
                for &id in &effect.target_ids {
                    // id is shape id, bit offset in mask
                    next_mask |= 1 << id;
                }
                if search(
                    next_mask,
                    cuts - 1,
                    stains + effect.stains,
                    target_count,
                    stain_limit,
                    effects,
                    visited,
                ) {
                    return true;
                }
            }
        }
        false
    }

    search(0, level.cuts, 0, target_count, level.stain_limit, &effects, &mut visited)
}

pub fn generate_cut_level(seed: u32, mastery: u32) -> CutLevel {
    for attempt in 0..12 {
        let candidate = build_cut_level_candidate(seed.wrapping_add(attempt * 6229), mastery);
        if is_cut_level_solvable(&candidate) {
            return candidate;
        }
    }
    build_cut_level_candidate(seed, mastery)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cut_level_generation() {
        let level = generate_cut_level(42, 1);
        assert_eq!(level.shapes.len(), 8); // 7 + mastery=1
        assert_eq!(level.cuts, 4);
        assert_eq!(level.stain_limit, 1);
        let targets = level.shapes.iter().filter(|s| s.target).count();
        assert_eq!(targets, 3); // min(4, 2 + 1)
        assert!(is_cut_level_solvable(&level));
    }

    #[test]
    fn test_cut_level_mastery_high() {
        let level = generate_cut_level(12345, 3);
        assert_eq!(level.shapes.len(), 10); // 7 + 3
        assert_eq!(level.cuts, 3);
        assert_eq!(level.stain_limit, 2);
        let targets = level.shapes.iter().filter(|s| s.target).count();
        assert_eq!(targets, 4); // min(4, 2 + 3)
    }
}
