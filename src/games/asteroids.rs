//! Asteroids Game Core Mechanics & Screen Wrapping
//! Ported from dmcinnes/HTML5-Asteroids game.js.
//! Vector math, ship thrust, screen wrapping, asteroid splitting and points.

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ShipPhysics {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub angle_deg: f64,
}

impl ShipPhysics {
    pub fn new(x: f64, y: f64) -> Self {
        Self {
            x,
            y,
            vx: 0.0,
            vy: 0.0,
            angle_deg: -90.0,
        }
    }

    /// Rotates the ship by delta degrees
    pub fn rotate(&mut self, delta_deg: f64) {
        self.angle_deg = (self.angle_deg + delta_deg) % 360.0;
    }

    /// Applies forward thrust along ship's current angle
    pub fn apply_thrust(&mut self, thrust_accel: f64) {
        let rad = self.angle_deg.to_radians();
        self.vx += rad.cos() * thrust_accel;
        self.vy += rad.sin() * thrust_accel;

        // Speed dampening / terminal velocity clamp (max speed 8.0)
        let speed_sq = self.vx * self.vx + self.vy * self.vy;
        if speed_sq > 64.0 {
            let speed = speed_sq.sqrt();
            self.vx = (self.vx / speed) * 8.0;
            self.vy = (self.vy / speed) * 8.0;
        }
    }

    /// Advances position and applies toroidal screen wrapping
    pub fn step(&mut self, friction: f64, width: f64, height: f64) {
        self.vx *= friction;
        self.vy *= friction;
        self.x += self.vx;
        self.y += self.vy;

        // Screen wrap
        if self.x < 0.0 {
            self.x += width;
        } else if self.x > width {
            self.x -= width;
        }

        if self.y < 0.0 {
            self.y += height;
        } else if self.y > height {
            self.y -= height;
        }
    }
}
