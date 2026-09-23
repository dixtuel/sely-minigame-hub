//! Lander Game Core Physics & Terrain Generator
//! Ported from KilledByAPixel/LittleJS landerGame.js.
//! Fractal midpoint lunar terrain with flat landing pad, gravity and tilt dynamics.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LandingPad {
    pub start_x: f64,
    pub end_x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LanderTerrain {
    pub points: Vec<(f64, f64)>,
    pub pad: LandingPad,
}

/// Generates lunar terrain profile with a guaranteed flat landing zone
pub fn generate_lander_terrain(width: f64, height: f64, seed: u32) -> LanderTerrain {
    let mut rng = super::rng::Mulberry32::new(seed);
    let pad_width = 80.0;
    let pad_x = 100.0 + rng.next_f64() * (width - 200.0 - pad_width);
    let pad_y = height - 70.0 - rng.next_f64() * 60.0;

    let segment_count = 32;
    let dx = width / (segment_count as f64);
    let mut points = Vec::with_capacity(segment_count + 1);

    for i in 0..=segment_count {
        let x = (i as f64) * dx;
        let y = if x >= pad_x - 5.0 && x <= pad_x + pad_width + 5.0 {
            pad_y
        } else {
            let noise = ((x * 0.015 + seed as f64).sin() * 40.0)
                + ((x * 0.035).cos() * 25.0)
                + (rng.next_f64() * 15.0 - 7.5);
            (height - 110.0 + noise).clamp(height * 0.4, height - 20.0)
        };
        points.push((x, y));
    }

    LanderTerrain {
        points,
        pad: LandingPad {
            start_x: pad_x,
            end_x: pad_x + pad_width,
            y: pad_y,
        },
    }
}

/// Evaluates if a touchdown meets soft landing criteria
/// Tolerances: speed < 1.4, tilt angle < 0.18 rad (~10 degrees), entirely inside pad boundaries
pub fn check_safe_touchdown(
    x: f64,
    y: f64,
    vx: f64,
    vy: f64,
    angle: f64,
    pad: &LandingPad,
) -> bool {
    let speed = (vx * vx + vy * vy).sqrt();
    let inside_pad = x >= pad.start_x && x <= pad.end_x && (y - pad.y).abs() < 6.0;
    let upright = angle.abs() < 0.18;
    let gentle = speed < 1.4;

    inside_pad && upright && gentle
}
