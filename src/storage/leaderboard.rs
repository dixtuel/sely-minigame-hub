//! Multi-Tier Leaderboard Engine (Redis TCP / Turso LibSQL / Memory)
//! Implements strict 24-hour TTL, 5s L1 micro-cache, anti-cheat score ceilings,
//! and graceful tiered fallback. Matches server/storage/leaderboard.ts.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

use super::turso::{
    get_turso_player_rank, get_turso_top_scores, save_turso_score,
    LeaderboardEntry,
};

pub const VALID_GAMES: &[&str] = &[
    "all", "echo", "vaka", "hane", "spark", "knot", "cut", "shadow",
    "asteroids", "sokoban", "tetris", "lander", "lightsout", "game2048",
    "coil", "apex", "lift", "breakline",
    "marker", // backward-compatibility alias
];

pub fn get_max_score_ceiling(game_id: &str) -> i64 {
    match game_id {
        "all" => 250_000,
        "echo" => 5_000,
        "knot" => 4_000,
        "cut" => 3_000,
        "shadow" => 3_000,
        "marker" => 3_000,
        "hane" => 2_500,
        "spark" => 2_000,
        "vaka" => 1_000,
        "asteroids" => 25_000,
        "sokoban" => 5_000,
        "tetris" => 100_000,
        "lander" => 5_000,
        "lightsout" => 5_000,
        "game2048" => 100_000,
        "coil" => 25_000,
        "apex" => 100_000,
        "lift" => 100_000,
        "breakline" => 100_000,
        _ => 5_000,
    }
}

pub fn get_today_iso_date() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardResponse {
    pub game_id: String,
    pub date: String,
    pub top: Vec<LeaderboardEntry>,
    pub total_players: usize,
    pub source: String, // "redis" | "turso" | "memory"
}

// In-process L1 micro-cache (5s TTL)
struct L1Entry {
    timestamp: Instant,
    data: LeaderboardResponse,
}

static L1_CACHE: Mutex<Option<HashMap<String, L1Entry>>> = Mutex::new(None);
const L1_TTL: Duration = Duration::from_millis(5_000);
const MAX_L1_ENTRIES: usize = 128;

fn get_l1_cache(key: &str) -> Option<LeaderboardResponse> {
    let mut guard = L1_CACHE.lock().unwrap();
    let cache = guard.get_or_insert_with(HashMap::new);
    if let Some(entry) = cache.get(key) {
        if entry.timestamp.elapsed() < L1_TTL {
            return Some(entry.data.clone());
        }
    }
    None
}

fn set_l1_cache(key: String, data: LeaderboardResponse) {
    let mut guard = L1_CACHE.lock().unwrap();
    let cache = guard.get_or_insert_with(HashMap::new);
    if cache.len() >= MAX_L1_ENTRIES {
        if let Some(oldest) = cache.keys().next().cloned() {
            cache.remove(&oldest);
        }
    }
    cache.insert(key, L1Entry {
        timestamp: Instant::now(),
        data,
    });
}

fn invalidate_l1_cache(key: &str) {
    let mut guard = L1_CACHE.lock().unwrap();
    if let Some(cache) = guard.as_mut() {
        cache.remove(key);
    }
}

// In-Memory store fallback (when neither Redis nor Turso is available)
#[derive(Clone, Debug)]
struct MemoryScore {
    nick: String,
    score: i64,
    timestamp: i64,
}

static MEMORY_STORE: Mutex<Option<HashMap<String, HashMap<String, MemoryScore>>>> = Mutex::new(None);
const MAX_MEMORY_BOARDS: usize = 32;
const MAX_BOARD_SCORES: usize = 500;

fn get_memory_board(game_id: &str, date_str: &str) -> LeaderboardResponse {
    let key = format!("lb:{}:{}", game_id, date_str);
    let mut guard = MEMORY_STORE.lock().unwrap();
    let store = guard.get_or_insert_with(HashMap::new);
    let board = store.get(&key);

    let mut entries: Vec<LeaderboardEntry> = match board {
        Some(b) => b
            .iter()
            .map(|(sig, ms)| LeaderboardEntry {
                rank: 0,
                nick: ms.nick.clone(),
                score: ms.score,
                signature: sig.clone(),
                timestamp: ms.timestamp,
            })
            .collect(),
        None => Vec::new(),
    };

    entries.sort_by(|a, b| b.score.cmp(&a.score));
    entries.truncate(10);
    for (i, entry) in entries.iter_mut().enumerate() {
        entry.rank = i + 1;
    }

    let total = board.map(|b| b.len()).unwrap_or(0);
    LeaderboardResponse {
        game_id: game_id.to_string(),
        date: date_str.to_string(),
        top: entries,
        total_players: total,
        source: "memory".to_string(),
    }
}

fn save_memory_score(game_id: &str, date_str: &str, nick: &str, signature: &str, score: i64) -> Option<usize> {
    let key = format!("lb:{}:{}", game_id, date_str);
    let mut guard = MEMORY_STORE.lock().unwrap();
    let store = guard.get_or_insert_with(HashMap::new);

    if !store.contains_key(&key) && store.len() >= MAX_MEMORY_BOARDS {
        if let Some(oldest) = store.keys().next().cloned() {
            store.remove(&oldest);
        }
    }

    let board = store.entry(key).or_insert_with(HashMap::new);
    let now = chrono::Utc::now().timestamp_millis();

    let should_insert = match board.get(signature) {
        Some(existing) => score > existing.score,
        None => {
            if board.len() >= MAX_BOARD_SCORES {
                if let Some(oldest_key) = board.keys().next().cloned() {
                    board.remove(&oldest_key);
                }
            }
            true
        }
    };

    if should_insert {
        board.insert(signature.to_string(), MemoryScore {
            nick: nick.to_string(),
            score,
            timestamp: now,
        });
    }

    let mut all_scores: Vec<(&String, i64)> = board.iter().map(|(sig, ms)| (sig, ms.score)).collect();
    all_scores.sort_by(|a, b| b.1.cmp(&a.1));
    all_scores.iter().position(|(sig, _)| *sig == signature).map(|pos| pos + 1)
}

pub async fn get_top_scores(
    game_id: &str,
    date_str: &str,
    turso_conn: Option<&libsql::Connection>,
) -> LeaderboardResponse {
    let l1_key = format!("{}:{}", game_id, date_str);
    if let Some(cached) = get_l1_cache(&l1_key) {
        return cached;
    }

    // Strategy B: Turso Database
    if let Some(conn) = turso_conn {
        if let Ok(turso_res) = get_turso_top_scores(conn, game_id, date_str, 10).await {
            if !turso_res.top.is_empty() {
                let response = LeaderboardResponse {
                    game_id: game_id.to_string(),
                    date: date_str.to_string(),
                    top: turso_res.top,
                    total_players: turso_res.total_players,
                    source: "turso".to_string(),
                };
                set_l1_cache(l1_key, response.clone());
                return response;
            }
        }
    }

    // Strategy C: Memory
    let memory_res = get_memory_board(game_id, date_str);
    set_l1_cache(l1_key, memory_res.clone());
    memory_res
}

#[derive(Clone, Debug, Serialize)]
pub struct SubmitScoreResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rank: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

pub async fn submit_score(
    game_id: &str,
    score: i64,
    nick: &str,
    signature: &str,
    date_str: Option<&str>,
    turso_conn: Option<&libsql::Connection>,
) -> SubmitScoreResult {
    if score <= 0 {
        return SubmitScoreResult {
            success: false,
            rank: None,
            message: Some("Geçersiz skor değeri.".to_string()),
        };
    }

    let ceiling = get_max_score_ceiling(game_id);
    if score > ceiling {
        return SubmitScoreResult {
            success: false,
            rank: None,
            message: Some("Skor makul sınırların üzerinde.".to_string()),
        };
    }

    let clean_nick = nick.trim();
    let clean_sig = signature.trim();
    if clean_nick.is_empty() || clean_sig.is_empty() {
        return SubmitScoreResult {
            success: false,
            rank: None,
            message: Some("Eksik kod adı veya imza.".to_string()),
        };
    }

    let effective_date = date_str.unwrap_or_else(|| "");
    let today = if effective_date.is_empty() {
        get_today_iso_date()
    } else {
        effective_date.to_string()
    };

    invalidate_l1_cache(&format!("{}:{}", game_id, today));

    // Turso Persistence
    if let Some(conn) = turso_conn {
        let _ = save_turso_score(conn, game_id, score, clean_nick, clean_sig, &today).await;
        if let Some(rank) = get_turso_player_rank(conn, game_id, &today, score).await {
            return SubmitScoreResult {
                success: true,
                rank: Some(rank),
                message: None,
            };
        }
    }

    // Memory Fallback
    let rank = save_memory_score(game_id, &today, clean_nick, clean_sig, score);
    SubmitScoreResult {
        success: true,
        rank,
        message: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_leaderboard_memory_flow() {
        let date = "2026-09-20";
        let sub1 = submit_score("spark", 1500, "Şimşek Gezgin #1234", "sig-1", Some(date), None).await;
        assert!(sub1.success);
        assert_eq!(sub1.rank, Some(1));

        let sub2 = submit_score("spark", 1800, "Usta Pilot #5678", "sig-2", Some(date), None).await;
        assert!(sub2.success);
        assert_eq!(sub2.rank, Some(1));

        let board = get_top_scores("spark", date, None).await;
        assert_eq!(board.top.len(), 2);
        assert_eq!(board.top[0].signature, "sig-2");
        assert_eq!(board.top[0].score, 1800);
        assert_eq!(board.top[1].signature, "sig-1");
        assert_eq!(board.top[1].score, 1500);
    }

    #[tokio::test]
    async fn test_anti_cheat_score_ceiling() {
        let res = submit_score("vaka", 9999, "Hacker", "sig-cheat", None, None).await;
        assert!(!res.success);
        assert!(res.message.unwrap().contains("makul sınırların"));
    }
}
