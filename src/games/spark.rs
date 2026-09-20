//! SELY Spark (Kıvılcım) Physics, Kinematics & Collision Engine
//! Matches client/src/components/SparkCanvasGame.tsx and SparkCanvasGame.test.ts.

use crate::games::rng::Mulberry32;

pub const CANVAS_WIDTH: f64 = 420.0;
pub const CANVAS_HEIGHT: f64 = 600.0;
pub const GROUND_HEIGHT: f64 = 65.0;
pub const GROUND_Y: f64 = CANVAS_HEIGHT - GROUND_HEIGHT;

pub struct SparkDefaults;

impl SparkDefaults {
    pub const RADIUS: f64 = 13.0;
    pub const HIT_RADIUS: f64 = 10.0;
    pub const START_X: f64 = 88.0;
    pub const START_Y: f64 = 270.0;
    pub const GRAVITY: f64 = 0.42;
    pub const FLAP_IMPULSE: f64 = -7.2;
    pub const MAX_FALL_SPEED: f64 = 9.8;
    pub const PYLON_WIDTH: f64 = 56.0;
    pub const PYLON_SPACING: f64 = 220.0;
    pub const BASE_GAP: f64 = 155.0;
    pub const MIN_GAP: f64 = 125.0;
    pub const MIN_TOP_HEIGHT: f64 = 60.0;
}

#[derive(Clone, Debug)]
pub struct SparkState {
    pub x: f64,
    pub y: f64,
    pub vy: f64,
    pub rotation: f64,
}

#[derive(Clone, Debug)]
pub struct Pylon {
    pub id: usize,
    pub x: f64,
    pub width: f64,
    pub top_height: f64,
    pub gap: f64,
    pub bottom_y: f64,
    pub bottom_height: f64,
    pub passed: bool,
}

#[derive(Clone, Debug)]
pub struct Difficulty {
    pub speed: f64,
    pub gap: f64,
}

fn clamp(val: f64, min: f64, max: f64) -> f64 {
    val.max(min).min(max)
}

/// Computes deterministic pylon height from seed and index
pub fn spark_calculate_pylon_height(
    seed: u32,
    index: usize,
    min_height: f64,
    max_available: f64,
    prev_height: Option<f64>,
    max_delta: f64,
) -> f64 {
    let imul_part = ((index as i64 + 37).wrapping_mul(0x1f351f) as i32) as u32;
    let mixed_seed = seed ^ imul_part ^ 0x9e3779b9;
    let mut rng = Mulberry32::new(mixed_seed);

    let mut raw = (min_height + rng.next_f64() * (max_available - min_height)).floor();
    if let Some(prev) = prev_height {
        raw = clamp(raw, prev - max_delta, prev + max_delta);
        raw = clamp(raw, min_height, max_available);
    }
    raw
}

pub fn spark_calculate_pylon_height_default(seed: u32, index: usize) -> f64 {
    spark_calculate_pylon_height(seed, index, SparkDefaults::MIN_TOP_HEIGHT, 320.0, None, 140.0)
}

/// Calculates dynamic game difficulty based on score, mastery and viewport
pub fn spark_difficulty(score: i32, mastery: i32, viewport_width: f64) -> Difficulty {
    let width_factor = clamp(viewport_width / 800.0, 0.9, 1.25);
    let tiers = score.min(18) as f64;
    let base_speed = 2.8 + (mastery as f64) * 0.18 + tiers * 0.09;
    let speed = clamp(base_speed * width_factor, 2.6, 5.2);
    let gap = clamp(
        SparkDefaults::BASE_GAP - (mastery as f64) * 5.0 - (score.min(18) / 3) as f64 * 3.0,
        SparkDefaults::MIN_GAP,
        165.0,
    );
    Difficulty { speed, gap }
}

/// Executes single physics step for the Spark
pub fn spark_physics_step(
    spark: &SparkState,
    dt: f64,
    flap: bool,
    gravity: f64,
    flap_impulse: f64,
    max_fall: f64,
) -> SparkState {
    let vy = if flap {
        flap_impulse
    } else {
        (spark.vy + gravity * dt).min(max_fall)
    };
    let y = spark.y + vy * dt;
    let rotation = clamp(vy * 6.5, -25.0, 70.0);
    SparkState {
        x: spark.x,
        y,
        vy,
        rotation,
    }
}

/// Circle to Axis-Aligned Bounding Box (AABB) collision detection
fn circle_rect_collide(cx: f64, cy: f64, cr: f64, rx: f64, ry: f64, rw: f64, rh: f64) -> bool {
    let closest_x = clamp(cx, rx, rx + rw);
    let closest_y = clamp(cy, ry, ry + rh);
    let dx = cx - closest_x;
    let dy = cy - closest_y;
    dx * dx + dy * dy < cr * cr
}

/// Checks collision against ceiling, ground, or pylon columns
pub fn spark_flight_collision(
    spark_x: f64,
    spark_y: f64,
    hit_radius: f64,
    pylon: &Pylon,
    ground_y: f64,
) -> bool {
    if spark_y - hit_radius <= 0.0 {
        return true;
    }
    if spark_y + hit_radius >= ground_y {
        return true;
    }

    // Top pylon
    if circle_rect_collide(
        spark_x,
        spark_y,
        hit_radius,
        pylon.x,
        0.0,
        pylon.width,
        pylon.top_height,
    ) {
        return true;
    }

    // Bottom pylon
    if circle_rect_collide(
        spark_x,
        spark_y,
        hit_radius,
        pylon.x,
        pylon.bottom_y,
        pylon.width,
        pylon.bottom_height,
    ) {
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validates_full_flight_loop_and_mechanics() {
        // 1. Gravity and flap impulse
        let initial = SparkState {
            x: 80.0,
            y: 250.0,
            vy: 0.0,
            rotation: 0.0,
        };
        let dropped = spark_physics_step(
            &initial,
            1.0,
            false,
            SparkDefaults::GRAVITY,
            SparkDefaults::FLAP_IMPULSE,
            SparkDefaults::MAX_FALL_SPEED,
        );
        assert!(dropped.vy > 0.0);
        assert!(dropped.y > initial.y);

        let flapped = spark_physics_step(
            &dropped,
            1.0,
            true,
            SparkDefaults::GRAVITY,
            SparkDefaults::FLAP_IMPULSE,
            SparkDefaults::MAX_FALL_SPEED,
        );
        assert_eq!(flapped.vy, SparkDefaults::FLAP_IMPULSE);
        assert!(flapped.rotation < 0.0);

        // 2. Deterministic pylon heights from daily seed
        let seed = 42819;
        let h1 = spark_calculate_pylon_height_default(seed, 0);
        let h1_repeat = spark_calculate_pylon_height_default(seed, 0);
        let h2 = spark_calculate_pylon_height_default(seed, 1);
        assert_eq!(h1, h1_repeat);
        assert!(h1 >= SparkDefaults::MIN_TOP_HEIGHT);
        assert!(h2 >= SparkDefaults::MIN_TOP_HEIGHT);

        // 3. Difficulty scaling
        let easy = spark_difficulty(0, 0, 800.0);
        let hard = spark_difficulty(15, 3, 800.0);
        assert!(hard.speed > easy.speed);
        assert!(hard.gap < easy.gap);
        assert!(hard.gap >= SparkDefaults::MIN_GAP);

        // 4. Collision detection
        let ground_y = 535.0;
        let pylon = Pylon {
            id: 0,
            x: 100.0,
            width: 50.0,
            top_height: 120.0,
            gap: 150.0,
            bottom_y: 270.0,
            bottom_height: 265.0,
            passed: false,
        };
        let hit_radius = SparkDefaults::HIT_RADIUS;

        // Safe inside the gap
        assert!(!spark_flight_collision(125.0, 195.0, hit_radius, &pylon, ground_y));

        // Top pylon collision
        assert!(spark_flight_collision(125.0, 100.0, hit_radius, &pylon, ground_y));

        // Bottom pylon collision
        assert!(spark_flight_collision(125.0, 300.0, hit_radius, &pylon, ground_y));

        // Ceiling collision
        assert!(spark_flight_collision(50.0, 5.0, hit_radius, &pylon, ground_y));

        // Ground collision
        assert!(spark_flight_collision(50.0, 532.0, hit_radius, &pylon, ground_y));
    }
}
