//! Camera-relative movement basis for 3D Echo Room
//! Matches client/src/game/movementBasis.ts and movementBasis.test.ts.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Vector2D {
    pub x: f64,
    pub z: f64,
}

pub const CAMERA_FORWARD: Vector2D = Vector2D { x: 0.849, z: 0.528 };
pub const CAMERA_RIGHT: Vector2D = Vector2D { x: 0.528, z: -0.849 };

/// Maps horizontal (-1..1) and vertical (-1..1) input axes to camera-relative 2D movement vector
pub fn move_from_input_axes(horizontal: f64, vertical: f64) -> Vector2D {
    let forward = -vertical;
    let x = CAMERA_RIGHT.x * horizontal + CAMERA_FORWARD.x * forward;
    let z = CAMERA_RIGHT.z * horizontal + CAMERA_FORWARD.z * forward;
    let magnitude = (x * x + z * z).sqrt();

    if magnitude > 1.0 {
        Vector2D {
            x: x / magnitude,
            z: z / magnitude,
        }
    } else {
        Vector2D { x, z }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close_to(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    #[test]
    fn test_maps_input_axes_correctly_and_normalizes_diagonal() {
        let forward = move_from_input_axes(0.0, -1.0);
        let reverse = move_from_input_axes(0.0, 1.0);
        assert!(close_to(forward.x, CAMERA_FORWARD.x, 1e-3));
        assert!(close_to(forward.z, CAMERA_FORWARD.z, 1e-3));
        assert!(close_to(reverse.x, -CAMERA_FORWARD.x, 1e-3));
        assert!(close_to(reverse.z, -CAMERA_FORWARD.z, 1e-3));

        let left = move_from_input_axes(-1.0, 0.0);
        let right = move_from_input_axes(1.0, 0.0);
        assert!(close_to(left.x, -CAMERA_RIGHT.x, 1e-3));
        assert!(close_to(left.z, -CAMERA_RIGHT.z, 1e-3));
        assert!(close_to(right.x, CAMERA_RIGHT.x, 1e-3));
        assert!(close_to(right.z, CAMERA_RIGHT.z, 1e-3));

        let diagonal = move_from_input_axes(1.0, -1.0);
        let magnitude = (diagonal.x * diagonal.x + diagonal.z * diagonal.z).sqrt();
        assert!(close_to(magnitude, 1.0, 1e-3));
        assert!(diagonal.x > 0.0);
        assert!(diagonal.z < 0.0);
    }
}
