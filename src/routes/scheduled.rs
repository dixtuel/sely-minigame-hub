//! Scheduled Cron Job Handlers
//! Implements constant-time token authentication for VDS crontab and Vercel Cron.
//! Matches server/scheduled/dailyContent.ts.

use std::env;
use axum::{
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use subtle::ConstantTimeEq;

use crate::storage::daily_content::MemoryDailyStore;

fn timing_safe_equal(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.as_bytes().ct_eq(b.as_bytes()).into()
}

fn authorize_scheduled_request(headers: &HeaderMap) -> bool {
    let daily_token = env::var("DAILY_JOB_TOKEN").unwrap_or_default();
    let cron_secret = env::var("CRON_SECRET").unwrap_or_default();

    // 1. VDS crontab header check (x-sely-cron-token)
    if let Some(vds_token) = headers.get("x-sely-cron-token").and_then(|h| h.to_str().ok()) {
        if !daily_token.is_empty() && timing_safe_equal(vds_token, &daily_token) {
            return true;
        }
    }

    // 2. Vercel Cron job authorization (Authorization: Bearer <CRON_SECRET>)
    if let Some(auth) = headers.get("authorization").and_then(|h| h.to_str().ok()) {
        if let Some(bearer) = auth.strip_prefix("Bearer ") {
            let expected = if !cron_secret.is_empty() { &cron_secret } else { &daily_token };
            if !expected.is_empty() && timing_safe_equal(bearer, expected) {
                return true;
            }
        }
    }

    false
}

pub async fn daily_content_handler(headers: HeaderMap) -> Response {
    if !authorize_scheduled_request(&headers) {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "cron-only" })),
        )
            .into_response();
    }

    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let store = MemoryDailyStore::new();
    let ensured = store.ensure(&today);

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "date": ensured.date,
            "generated": ensured.games.len(),
            "version": "2"
        })),
    )
        .into_response()
}

pub async fn daily_cleanup_handler(headers: HeaderMap) -> Response {
    if !authorize_scheduled_request(&headers) {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "cron-only" })),
        )
            .into_response();
    }

    // Retain 90 days
    let cutoff = (chrono::Utc::now() - chrono::Duration::days(90)).format("%Y-%m-%d").to_string();
    let store = MemoryDailyStore::new();
    let removed = store.cleanup(&cutoff);

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "removed": removed,
            "retentionDays": 90
        })),
    )
        .into_response()
}

pub fn scheduled_routes() -> Router {
    Router::new()
        .route("/api/scheduled/daily-content", get(daily_content_handler).post(daily_content_handler))
        .route("/api/scheduled/daily-cleanup", get(daily_cleanup_handler).post(daily_cleanup_handler))
        .route("/api/cron/daily-content", get(daily_content_handler).post(daily_content_handler))
        .route("/api/cron/daily-cleanup", get(daily_cleanup_handler).post(daily_cleanup_handler))
}

