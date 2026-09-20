//! SELY Daily Content Generator and Store
//! Matches server/storage/dailyContentStore.ts and RUSTGEC.MD Section 7.3.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::RwLock;

pub const DAILY_GAMES: &[&str] = &["echo", "knot", "cut", "shadow", "vaka", "hane", "spark"];
pub const RULESET_VERSION: &str = "5";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DailyGamePack {
    #[serde(rename = "gameId")]
    pub game_id: String,
    pub seed: i32,
    pub difficulty: i32,
    #[serde(rename = "rulesetVersion")]
    pub ruleset_version: String,
    pub params: HashMap<String, i64>,
    pub checksum: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DailyManifest {
    pub date: String,
    pub games: Vec<DailyGamePack>,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
}

/// FNV-1a 32-bit seed derivation algorithm matching seedFor in dailyContentStore.ts
pub fn seed_for(value: &str) -> i32 {
    let mut hash: u32 = 2166136261;
    for b in value.bytes() {
        hash = (hash ^ (b as u32)).wrapping_mul(16777619);
    }
    (hash % 2_147_483_647) as i32
}

/// Generates 16-character SHA-256 hex checksum of JSON representation
pub fn compute_checksum(payload: &serde_json::Value) -> String {
    let raw = serde_json::to_string(payload).unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let hex = format!("{:x}", hasher.finalize());
    hex[..16].to_string()
}

/// Generates deterministic 7-game manifest for given date string (YYYY-MM-DD)
pub fn create_daily_manifest(date: &str) -> DailyManifest {
    let mut games = Vec::with_capacity(DAILY_GAMES.len());

    for (index, &game_id) in DAILY_GAMES.iter().enumerate() {
        let seed = seed_for(&format!("{date}:{game_id}:v{RULESET_VERSION}"));
        let difficulty = 1 + ((seed + index as i32) % 4);

        let mut params = HashMap::new();
        params.insert("v".to_string(), 5);
        params.insert("band".to_string(), difficulty as i64);
        params.insert("variant".to_string(), ((seed >> 5) % 5) as i64);
        params.insert("objective".to_string(), ((seed >> 11) % 4) as i64);
        params.insert("pace".to_string(), (2 + ((seed >> 17) % 4)) as i64);

        let chk_val = serde_json::json!({
            "date": date,
            "gameId": game_id,
            "seed": seed,
            "difficulty": difficulty,
            "params": params,
        });
        let checksum = compute_checksum(&chk_val);

        games.push(DailyGamePack {
            game_id: game_id.to_string(),
            seed,
            difficulty,
            ruleset_version: RULESET_VERSION.to_string(),
            params,
            checksum,
        });
    }

    DailyManifest {
        date: date.to_string(),
        games,
        generated_at: Utc::now().to_rfc3339(),
    }
}

/// Thread-safe in-memory daily manifest store with cleanup
pub struct MemoryDailyStore {
    manifests: RwLock<HashMap<String, DailyManifest>>,
}

impl MemoryDailyStore {
    pub fn new() -> Self {
        Self {
            manifests: RwLock::new(HashMap::new()),
        }
    }

    pub fn ensure(&self, date: &str) -> DailyManifest {
        {
            let read_guard = self.manifests.read().unwrap();
            if let Some(existing) = read_guard.get(date) {
                return existing.clone();
            }
        }

        let manifest = create_daily_manifest(date);
        let mut write_guard = self.manifests.write().unwrap();
        write_guard.insert(date.to_string(), manifest.clone());
        manifest
    }

    pub fn cleanup(&self, before_date: &str) -> usize {
        let mut write_guard = self.manifests.write().unwrap();
        let initial_count = write_guard.len();
        write_guard.retain(|date, _| date.as_str() >= before_date);
        initial_count - write_guard.len()
    }
}

impl Default for MemoryDailyStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_creates_deterministic_7_game_manifests_and_enforces_cleanup() {
        let first = create_daily_manifest("2026-08-25");
        let second = create_daily_manifest("2026-08-25");

        assert_eq!(first.games.len(), 7);
        let first_seeds: Vec<i32> = first.games.iter().map(|g| g.seed).collect();
        let second_seeds: Vec<i32> = second.games.iter().map(|g| g.seed).collect();
        assert_eq!(first_seeds, second_seeds);

        for g in &first.games {
            assert_eq!(g.checksum.len(), 16);
            assert_eq!(g.ruleset_version, "5");
            assert_eq!(*g.params.get("v").unwrap(), 5);
            assert!(g.difficulty >= 1 && g.difficulty <= 4);
        }

        let tomorrow = create_daily_manifest("2026-08-26");
        assert_ne!(first.games[0].seed, tomorrow.games[0].seed);

        let store = MemoryDailyStore::new();
        store.ensure("2026-01-01");
        store.ensure("2026-08-25");
        let removed = store.cleanup("2026-05-01");
        assert!(removed >= 1);
    }
}
