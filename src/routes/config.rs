//! Global Config REST API Handler
//! Exposes GET /api/config.
//! Matches server/storage/globalConfig.ts.

use axum::{
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use crate::storage::global_config::fetch_global_config;

pub async fn get_config_handler() -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=15, s-maxage=15, stale-while-revalidate=60"),
    );

    let config = fetch_global_config().await;
    (StatusCode::OK, headers, Json(config)).into_response()
}

pub fn config_routes() -> Router {
    Router::new().route("/api/config", get(get_config_handler))
}
