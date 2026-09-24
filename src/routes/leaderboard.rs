//! Leaderboard REST API Routes
//! Handles GET /api/leaderboard and POST /api/leaderboard.
//! Matches server/storage/leaderboard.ts.

use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::sync::Arc;
use fred::clients::Pool;

use crate::storage::leaderboard::{
    get_today_iso_date, get_top_scores, submit_score, VALID_GAMES,
};

#[derive(Clone, Debug, Deserialize)]
pub struct LeaderboardQuery {
    pub game: Option<String>,
    pub date: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitScoreBody {
    pub game_id: String,
    pub score: i64,
    pub nick: String,
    pub signature: String,
}

#[derive(Clone)]
pub struct AppState {
    pub turso_conn: Option<Arc<tokio::sync::Mutex<libsql::Connection>>>,
    pub local_fallback_conn: Option<Arc<tokio::sync::Mutex<libsql::Connection>>>,
    pub redis_pool: Option<Pool>,
    pub llm_client: reqwest::Client,
}

pub async fn get_leaderboard_handler(
    Query(params): Query<LeaderboardQuery>,
    State(state): State<AppState>,
) -> Response {
    let game = params.game.unwrap_or_else(|| "echo".to_string()).to_lowercase();
    let date = params.date.unwrap_or_else(get_today_iso_date);

    if !VALID_GAMES.contains(&game.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Geçersiz oyun kimliği." })),
        )
            .into_response();
    }

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=30, s-maxage=60, stale-while-revalidate=300"),
    );

    let maybe_conn_guard = match &state.turso_conn {
        Some(c) => Some(c.lock().await),
        None => None,
    };
    let local_conn_guard = match &state.local_fallback_conn {
        Some(c) => Some(c.lock().await),
        None => None,
    };
    let maybe_ref = maybe_conn_guard.as_deref();
    let local_ref = local_conn_guard.as_deref();

    let data = get_top_scores(&game, &date, maybe_ref, local_ref, state.redis_pool.as_ref()).await;
    (StatusCode::OK, headers, Json(data)).into_response()
}

pub async fn submit_leaderboard_handler(
    State(state): State<AppState>,
    Json(body): Json<SubmitScoreBody>,
) -> Response {
    let game = body.game_id.to_lowercase();
    if !VALID_GAMES.contains(&game.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Geçersiz oyun kimliği." })),
        )
            .into_response();
    }

    let maybe_conn_guard = match &state.turso_conn {
        Some(c) => Some(c.lock().await),
        None => None,
    };
    let local_conn_guard = match &state.local_fallback_conn {
        Some(c) => Some(c.lock().await),
        None => None,
    };
    let maybe_ref = maybe_conn_guard.as_deref();
    let local_ref = local_conn_guard.as_deref();

    let result = submit_score(
        &game,
        body.score,
        &body.nick,
        &body.signature,
        None,
        maybe_ref,
        local_ref,
        state.redis_pool.as_ref(),
    )
    .await;

    if !result.success {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": result.message.unwrap_or_else(|| "Skor kaydedilemedi.".to_string()) })),
        )
            .into_response();
    }

    (StatusCode::OK, Json(result)).into_response()
}

pub fn leaderboard_routes() -> Router<AppState> {
    Router::new()
        .route("/api/leaderboard", get(get_leaderboard_handler))
        .route("/api/leaderboard", post(submit_leaderboard_handler))
}
