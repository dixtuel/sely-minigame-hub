//! Turso Database (LibSQL / Local SQLite) Integration
//! Handles daily leaderboard scores, hall-of-fame archive, and user auth fallback.
//! Matches server/storage/turso.ts.

use std::collections::HashMap;
use std::env;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct LeaderboardEntry {
    pub rank: usize,
    pub nick: String,
    pub score: i64,
    pub signature: String,
    pub timestamp: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TursoTopScoresResult {
    pub top: Vec<LeaderboardEntry>,
    pub total_players: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TursoUser {
    pub id: i64,
    pub open_id: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub login_method: Option<String>,
    pub role: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_signed_in: i64,
}

// In-memory micro-cache with 15s TTL
struct CachedBoard {
    timestamp: Instant,
    data: TursoTopScoresResult,
}

static BOARD_CACHE: Mutex<Option<HashMap<String, CachedBoard>>> = Mutex::new(None);
const CACHE_TTL: Duration = Duration::from_secs(15);
const MAX_BOARD_CACHE_ENTRIES: usize = 128;

fn get_cached_board(key: &str) -> Option<TursoTopScoresResult> {
    let mut guard = BOARD_CACHE.lock().unwrap();
    let cache = guard.get_or_insert_with(HashMap::new);
    if let Some(entry) = cache.get(key) {
        if entry.timestamp.elapsed() < CACHE_TTL {
            return Some(entry.data.clone());
        }
    }
    None
}

fn set_cached_board(key: String, data: TursoTopScoresResult) {
    let mut guard = BOARD_CACHE.lock().unwrap();
    let cache = guard.get_or_insert_with(HashMap::new);
    if cache.len() >= MAX_BOARD_CACHE_ENTRIES {
        if let Some(oldest_key) = cache.keys().next().cloned() {
            cache.remove(&oldest_key);
        }
    }
    cache.insert(key, CachedBoard {
        timestamp: Instant::now(),
        data,
    });
}

pub fn invalidate_board_cache(game_id: &str, date_str: &str) {
    let mut guard = BOARD_CACHE.lock().unwrap();
    if let Some(cache) = guard.as_mut() {
        let prefix = format!("{}:{}", game_id, date_str);
        cache.retain(|k, _| !k.starts_with(&prefix));
    }
}

pub fn get_turso_config() -> Option<(String, Option<String>)> {
    if let Ok(url) = env::var("TURSO_DATABASE_URL") {
        if !url.is_empty() {
            return Some((url, env::var("TURSO_AUTH_TOKEN").ok()));
        }
    }
    if let Ok(url) = env::var("TURSO_URL") {
        if !url.is_empty() {
            return Some((url, env::var("TURSO_AUTH_TOKEN").ok()));
        }
    }
    if let Ok(url) = env::var("LIBSQL_URL") {
        if !url.is_empty() {
            return Some((url, env::var("TURSO_AUTH_TOKEN").ok()));
        }
    }

    // Standalone fallback: when not running on Vercel and no external db is configured
    let is_vercel = env::var("VERCEL").map(|v| v == "1").unwrap_or(false) || env::var("VERCEL_ENV").is_ok();
    let has_postgres = env::var("POSTGRES_URL").is_ok() || env::var("DATABASE_URL").is_ok() || env::var("CONTENT_DB_URL").is_ok();

    if !is_vercel && !has_postgres {
        return Some(("file:./data/sely.db".to_string(), None));
    }

    None
}

pub fn is_turso_configured() -> bool {
    get_turso_config().is_some()
}

pub async fn create_turso_connection() -> Result<libsql::Connection, Box<dyn std::error::Error + Send + Sync>> {
    let (url, auth_token) = get_turso_config().ok_or("Turso is not configured")?;

    let db = if url.starts_with("libsql://") || url.starts_with("http://") || url.starts_with("https://") {
        let token = auth_token.unwrap_or_default();
        libsql::Builder::new_remote(url, token).build().await?
    } else {
        let file_path = url.trim_start_matches("file:").trim_start_matches("//");
        if file_path != ":memory:" && !file_path.starts_with(':') {
            if let Some(parent) = Path::new(file_path).parent() {
                if !parent.as_os_str().is_empty() {
                    let _ = std::fs::create_dir_all(parent);
                }
            }
        }
        libsql::Builder::new_local(file_path).build().await?
    };

    let conn = db.connect()?;
    ensure_turso_schema(&conn).await?;
    Ok(conn)
}

pub async fn ensure_turso_schema(conn: &libsql::Connection) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS daily_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id TEXT NOT NULL,
            date_str TEXT NOT NULL,
            nick TEXT NOT NULL,
            signature TEXT NOT NULL,
            score INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(game_id, date_str, signature)
        );",
        (),
    ).await?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_daily_scores_lookup ON daily_scores(game_id, date_str, score DESC);",
        (),
    ).await?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_daily_scores_all_time ON daily_scores(game_id, signature, score DESC);",
        (),
    ).await?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            open_id TEXT NOT NULL UNIQUE,
            name TEXT,
            email TEXT,
            login_method TEXT,
            role TEXT NOT NULL DEFAULT 'user',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_signed_in INTEGER NOT NULL
        );",
        (),
    ).await?;

    Ok(())
}

pub async fn save_turso_score(
    conn: &libsql::Connection,
    game_id: &str,
    score: i64,
    nick: &str,
    signature: &str,
    date_str: &str,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let now = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "INSERT INTO daily_scores (game_id, date_str, nick, signature, score, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(game_id, date_str, signature) DO UPDATE SET
           score = CASE WHEN excluded.score > daily_scores.score THEN excluded.score ELSE daily_scores.score END,
           nick = excluded.nick,
           created_at = excluded.created_at;",
        libsql::params![game_id, date_str, nick, signature, score, now],
    ).await?;

    invalidate_board_cache(game_id, date_str);
    Ok(true)
}

pub async fn get_turso_player_rank(
    conn: &libsql::Connection,
    game_id: &str,
    date_str: &str,
    score: i64,
) -> Option<usize> {
    let mut rows = conn.query(
        "SELECT COUNT(*) as rank_above FROM daily_scores WHERE game_id = ?1 AND date_str = ?2 AND score > ?3;",
        libsql::params![game_id, date_str, score],
    ).await.ok()?;

    if let Ok(Some(row)) = rows.next().await {
        let count: i64 = row.get(0).unwrap_or(0);
        Some((count + 1) as usize)
    } else {
        None
    }
}

pub async fn get_turso_top_scores(
    conn: &libsql::Connection,
    game_id: &str,
    date_str: &str,
    limit: usize,
) -> Result<TursoTopScoresResult, Box<dyn std::error::Error + Send + Sync>> {
    let cache_key = format!("{}:{}:{}", game_id, date_str, limit);
    if let Some(cached) = get_cached_board(&cache_key) {
        return Ok(cached);
    }

    let mut rows = conn.query(
        "SELECT nick, signature, score, created_at FROM daily_scores WHERE game_id = ?1 AND date_str = ?2 ORDER BY score DESC LIMIT ?3;",
        libsql::params![game_id, date_str, limit as i64],
    ).await?;

    let mut top = Vec::new();
    while let Some(row) = rows.next().await? {
        let nick: String = row.get(0)?;
        let signature: String = row.get(1)?;
        let score: i64 = row.get(2)?;
        let created_at: i64 = row.get(3)?;
        top.push(LeaderboardEntry {
            rank: top.len() + 1,
            nick,
            score,
            signature,
            timestamp: created_at,
        });
    }

    let mut count_rows = conn.query(
        "SELECT COUNT(*) FROM daily_scores WHERE game_id = ?1 AND date_str = ?2;",
        libsql::params![game_id, date_str],
    ).await?;

    let total_players = if let Some(crow) = count_rows.next().await? {
        let c: i64 = crow.get(0)?;
        c as usize
    } else {
        top.len()
    };

    let result = TursoTopScoresResult {
        top,
        total_players,
    };
    set_cached_board(cache_key, result.clone());

    Ok(result)
}

pub async fn get_turso_all_time_top_scores(
    conn: &libsql::Connection,
    game_id: &str,
    limit: usize,
) -> Result<Vec<LeaderboardEntry>, Box<dyn std::error::Error + Send + Sync>> {
    let mut rows = conn.query(
        "SELECT nick, signature, MAX(score) as best_score, created_at FROM daily_scores WHERE game_id = ?1 GROUP BY signature ORDER BY best_score DESC LIMIT ?2;",
        libsql::params![game_id, limit as i64],
    ).await?;

    let mut top = Vec::new();
    while let Some(row) = rows.next().await? {
        let nick: String = row.get(0)?;
        let signature: String = row.get(1)?;
        let score: i64 = row.get(2)?;
        let created_at: i64 = row.get(3)?;
        top.push(LeaderboardEntry {
            rank: top.len() + 1,
            nick,
            score,
            signature,
            timestamp: created_at,
        });
    }

    Ok(top)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_in_memory_turso() {
        let db = libsql::Builder::new_local(":memory:").build().await.unwrap();
        let conn = db.connect().unwrap();
        ensure_turso_schema(&conn).await.unwrap();

        let saved = save_turso_score(&conn, "echo", 1200, "Cesur Yolcu #1234", "sig-1234", "2026-09-20").await.unwrap();
        assert!(saved);

        let rank = get_turso_player_rank(&conn, "echo", "2026-09-20", 1200).await;
        assert_eq!(rank, Some(1));

        let top = get_turso_top_scores(&conn, "echo", "2026-09-20", 10).await.unwrap();
        assert_eq!(top.top.len(), 1);
        assert_eq!(top.total_players, 1);
        assert_eq!(top.top[0].score, 1200);
    }
}
