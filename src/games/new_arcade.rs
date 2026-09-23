//! Deterministic configuration shared by the four lightweight catalogue games.
//! The renderer remains a React canvas fallback, while the daily route knobs are
//! generated here so server, WASM and client cannot silently drift apart.

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct ArcadeConfig {
    pub game_id: String,
    pub variant: u32,
    pub obstacle_count: u32,
    pub pace: u32,
    pub route_width: u32,
}

pub fn generate_arcade_config(seed: u32, mastery: u32, game_id: &str) -> ArcadeConfig {
    let mixed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
    ArcadeConfig {
        game_id: game_id.to_string(),
        variant: (mixed >> 8) % 5,
        obstacle_count: 3 + mastery.min(4),
        pace: 2 + ((mixed >> 16) % 4) + mastery.min(3),
        route_width: 18 + ((mixed >> 24) % 5),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_is_stable_and_mastery_only_increases_pressure() {
        let easy = generate_arcade_config(42, 1, "coil");
        let hard = generate_arcade_config(42, 4, "coil");
        assert_eq!(easy.variant, generate_arcade_config(42, 1, "coil").variant);
        assert!(hard.obstacle_count >= easy.obstacle_count);
        assert!(hard.pace >= easy.pace);
    }
}
