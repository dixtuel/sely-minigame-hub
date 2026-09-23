//! Smooth character facing and angular calculations for 3D Echo Room
//! Matches client/src/game/heading.ts and heading.test.ts.

use std::f64::consts::PI;

const TWO_PI: f64 = PI * 2.0;

/// Calculates movement yaw angle from x and z velocities
pub fn movement_yaw(x: f64, z: f64) -> f64 {
    x.atan2(z)
}

/// Calculates shortest signed angle delta between target and current yaw
pub fn shortest_angle_delta(target: f64, current: f64) -> f64 {
    let delta = target - current;
    delta.sin().atan2(delta.cos())
}

/// Steps facing yaw towards movement direction with exponential decay smoothing
pub fn step_facing_yaw(current: f64, x: f64, z: f64, delta: f64, turn_rate: f64) -> f64 {
    let target = movement_yaw(x, z);
    let turn = 1.0 - (-delta * turn_rate).exp();
    let next = current + shortest_angle_delta(target, current) * turn;
    ((next + PI) % TWO_PI + TWO_PI) % TWO_PI - PI
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close_to(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    #[test]
    fn test_calculates_movement_yaw_and_smooth_facing() {
        assert!(close_to(movement_yaw(0.0, 1.0), 0.0, 1e-4));
        assert!(close_to(movement_yaw(0.0, -1.0).abs(), PI, 1e-4));
        assert!(close_to(movement_yaw(-1.0, 0.0), -PI / 2.0, 1e-4));
        assert!(close_to(movement_yaw(1.0, 0.0), PI / 2.0, 1e-4));

        let target = -PI + 0.04;
        let current = PI - 0.04;
        assert!(close_to(shortest_angle_delta(target, current), 0.08, 1e-4));

        let next = step_facing_yaw(PI / 2.0, 0.0, 1.0, 1.0 / 60.0, 14.0);
        assert!(next > 0.0);
        assert!(next < PI / 2.0);
    }
}
