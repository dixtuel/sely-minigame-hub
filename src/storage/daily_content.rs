//! SELY Daily Content Generator and Store
//! Matches server/storage/dailyContentStore.ts and RUSTGEC.MD Section 7.3.

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::RwLock;

pub const DAILY_GAMES: &[&str] = &["echo", "knot", "cut", "shadow", "vaka", "tetris", "spark", "coil", "apex", "lift", "breakline"];
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
    #[serde(rename = "featuredGameIds")]
    pub featured_game_ids: Vec<String>,
    #[serde(rename = "generatedAt")]
    pub generated_at: String,
}

/// Select the four visible catalogue cards from the generated daily package.
/// The cron-generated seeds remain the only source of variation; no client-side
/// hash or duplicated selection rule is needed.
fn featured_game_ids(games: &[DailyGamePack]) -> Vec<String> {
    let ordered: Vec<&DailyGamePack> = DAILY_GAMES
        .iter()
        .filter_map(|game_id| games.iter().find(|game| game.game_id == *game_id))
        .collect();
    if ordered.is_empty() {
        return Vec::new();
    }
    let package_seed = ordered.iter().fold(0_u64, |total, game| total.wrapping_add(game.seed as u64));
    let start = (package_seed % ordered.len() as u64) as usize;
    (0..ordered.len().min(4))
        .map(|offset| ordered[(start + offset) % ordered.len()].game_id.clone())
        .collect()
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
    let result = hasher.finalize();
    let hex: String = result.iter().map(|b| format!("{b:02x}")).collect();
    hex[..16].to_string()
}

/// Generates deterministic catalogue manifest for given date string (YYYY-MM-DD)
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
        featured_game_ids: featured_game_ids(&games),
        games,
        generated_at: Utc::now().to_rfc3339(),
    }
}

/// Thread-safe in-memory daily manifest store with cleanup. Used only as a fallback when no
/// Turso connection is configured (e.g. local dev without TURSO_DATABASE_URL) — on a real
/// serverless deployment this by itself is a per-invocation no-op, which is fine here because
/// the content is a pure function of the date and gets recomputed identically either way.
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

fn encode_params(params: &HashMap<String, i64>) -> String {
    serde_json::to_string(params).unwrap_or_default()
}

fn decode_params(raw: &str) -> HashMap<String, i64> {
    serde_json::from_str(raw).unwrap_or_default()
}

fn manifest_from_rows(date: &str, rows: Vec<(String, i32, i32, String, String, String)>) -> DailyManifest {
    let games: Vec<DailyGamePack> = rows
        .into_iter()
        .map(|(game_id, seed, difficulty, ruleset_version, payload, checksum)| DailyGamePack {
            game_id,
            seed,
            difficulty,
            ruleset_version,
            params: decode_params(&payload),
            checksum,
        })
        .collect();
    DailyManifest {
        date: date.to_string(),
        featured_game_ids: featured_game_ids(&games),
        games,
        generated_at: Utc::now().to_rfc3339(),
    }
}

async fn select_daily_content(
    conn: &libsql::Connection,
    date: &str,
) -> Result<Vec<(String, i32, i32, String, String, String)>, Box<dyn std::error::Error + Send + Sync>> {
    let mut rows = conn
        .query(
            "SELECT game_id, seed, difficulty, ruleset_version, payload, checksum FROM sely_daily_content WHERE content_date = ?1 ORDER BY game_id;",
            libsql::params![date],
        )
        .await?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().await? {
        out.push((
            row.get::<String>(0)?,
            row.get::<i32>(1)?,
            row.get::<i32>(2)?,
            row.get::<String>(3)?,
            row.get::<String>(4)?,
            row.get::<String>(5)?,
        ));
    }
    Ok(out)
}

async fn ensure_daily_content_in_connection(
    date: &str,
    conn: &libsql::Connection,
) -> Result<DailyManifest, ()> {
    if let Ok(rows) = select_daily_content(conn, date).await {
        if rows.len() == DAILY_GAMES.len() {
            return Ok(manifest_from_rows(date, rows));
        }
    }

    let manifest = create_daily_manifest(date);
    let created_at = Utc::now().to_rfc3339();
    for game in &manifest.games {
        conn
            .execute(
                "INSERT OR IGNORE INTO sely_daily_content
                    (content_date, game_id, seed, difficulty, ruleset_version, payload_codec, payload, checksum, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'json', ?6, ?7, ?8);",
                libsql::params![
                    date,
                    game.game_id.as_str(),
                    game.seed,
                    game.difficulty,
                    game.ruleset_version.as_str(),
                    encode_params(&game.params),
                    game.checksum.as_str(),
                    created_at.as_str()
                ],
            )
            .await
            .map_err(|_| ())?;
    }

    match select_daily_content(conn, date).await {
        Ok(rows) if rows.len() == DAILY_GAMES.len() => Ok(manifest_from_rows(date, rows)),
        _ => Err(()),
    }
}

/// Ensures today's (or `date`'s) manifest is persisted in libSQL. If the configured remote
/// database fails at request time, standalone servers retry against their local SQLite copy.
pub async fn ensure_daily_content(
    date: &str,
    conn: Option<&libsql::Connection>,
    local_fallback_conn: Option<&libsql::Connection>,
) -> DailyManifest {
    for candidate in [conn, local_fallback_conn].into_iter().flatten() {
        if let Ok(manifest) = ensure_daily_content_in_connection(date, candidate).await {
            return manifest;
        }
    }
    create_daily_manifest(date)
}

/// Deletes persisted daily manifests older than `before_date` (YYYY-MM-DD), matching
/// nodejs-legacy's TursoStore.cleanup. Returns 0 (nothing to clean) when Turso isn't
/// configured, since the in-memory fallback never accumulates anything across invocations.
pub async fn cleanup_daily_content(
    before_date: &str,
    conn: Option<&libsql::Connection>,
    local_fallback_conn: Option<&libsql::Connection>,
) -> usize {
    for candidate in [conn, local_fallback_conn].into_iter().flatten() {
        if let Ok(affected) = candidate
            .execute(
                "DELETE FROM sely_daily_content WHERE content_date < ?1;",
                libsql::params![before_date],
            )
            .await
        {
            return affected as usize;
        }
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_creates_deterministic_catalogue_manifests_and_enforces_cleanup() {
        let first = create_daily_manifest("2026-08-25");
        let second = create_daily_manifest("2026-08-25");

        assert_eq!(first.games.len(), DAILY_GAMES.len());
        let first_seeds: Vec<i32> = first.games.iter().map(|g| g.seed).collect();
        let second_seeds: Vec<i32> = second.games.iter().map(|g| g.seed).collect();
        assert_eq!(first_seeds, second_seeds);
        assert_eq!(first.featured_game_ids, second.featured_game_ids);
        assert_eq!(first.featured_game_ids.len(), 4);
        assert_eq!(first.featured_game_ids.iter().collect::<std::collections::HashSet<_>>().len(), 4);

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

    #[tokio::test]
    async fn test_ensure_and_cleanup_persist_through_turso() {
        let db = libsql::Builder::new_local(":memory:").build().await.unwrap();
        let conn = db.connect().unwrap();
        crate::storage::turso::ensure_turso_schema(&conn).await.unwrap();

        // First call creates and persists the manifest.
        let first = ensure_daily_content("2026-09-20", Some(&conn), None).await;
        assert_eq!(first.games.len(), DAILY_GAMES.len());

        // A brand new connection-backed call for the same date must read the SAME rows back
        // (not silently recompute in memory and lose them) — this is exactly what the old
        // per-invocation MemoryDailyStore couldn't guarantee across separate Vercel invocations.
        let second = ensure_daily_content("2026-09-20", Some(&conn), None).await;
        let first_seeds: Vec<i32> = first.games.iter().map(|g| g.seed).collect();
        let second_seeds: Vec<i32> = second.games.iter().map(|g| g.seed).collect();
        assert_eq!(first_seeds, second_seeds);
        for g in &second.games {
            assert!(!g.params.is_empty(), "params must round-trip through the stored payload");
        }

        // Old content gets pruned, recent content survives.
        ensure_daily_content("2026-01-01", Some(&conn), None).await;
        let removed = cleanup_daily_content("2026-05-01", Some(&conn), None).await;
        assert!(removed >= DAILY_GAMES.len());
        let still_there = select_daily_content(&conn, "2026-09-20").await.unwrap();
        assert_eq!(still_there.len(), DAILY_GAMES.len());
        let gone = select_daily_content(&conn, "2026-01-01").await.unwrap();
        assert!(gone.is_empty());
    }

    #[tokio::test]
    async fn test_ensure_and_cleanup_fall_back_gracefully_without_turso() {
        let manifest = ensure_daily_content("2026-09-20", None, None).await;
        assert_eq!(manifest.games.len(), DAILY_GAMES.len());
        assert_eq!(cleanup_daily_content("2026-05-01", None, None).await, 0);
    }
}
