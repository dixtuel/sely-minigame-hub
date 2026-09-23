//! 2D geometry helpers for Cut and line-slice mechanics
//! Matches client/src/lib/geometry.ts.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

/// Computes the shortest distance from point to line segment a-b
pub fn segment_distance(point: Point2D, a: Point2D, b: Point2D) -> f64 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    let length_sq = dx * dx + dy * dy;

    let t = if length_sq == 0.0 {
        0.0
    } else {
        let dot = (point.x - a.x) * dx + (point.y - a.y) * dy;
        (dot / length_sq).max(0.0).min(1.0)
    };

    let proj_x = a.x + t * dx;
    let proj_y = a.y + t * dy;

    ((point.x - proj_x).powi(2) + (point.y - proj_y).powi(2)).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn close_to(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    #[test]
    fn test_segment_distance_on_segment() {
        let a = Point2D { x: 0.0, y: 0.0 };
        let b = Point2D { x: 10.0, y: 0.0 };
        let p = Point2D { x: 5.0, y: 5.0 };

        assert!(close_to(segment_distance(p, a, b), 5.0, 1e-4));
    }

    #[test]
    fn test_segment_distance_beyond_endpoint() {
        let a = Point2D { x: 0.0, y: 0.0 };
        let b = Point2D { x: 10.0, y: 0.0 };
        let p = Point2D { x: 15.0, y: 0.0 };

        assert!(close_to(segment_distance(p, a, b), 5.0, 1e-4));
    }
}
