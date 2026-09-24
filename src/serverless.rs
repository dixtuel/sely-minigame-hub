//! SELY MiniGame Hub - Serverless Vercel Adapter
//! Official Vercel Rust Runtime on Fluid Compute

use sely_minigame_hub::routes::config::config_routes;
use sely_minigame_hub::routes::leaderboard::{leaderboard_routes, AppState};
use sely_minigame_hub::routes::og::og_routes;
use sely_minigame_hub::routes::scheduled::scheduled_routes;
use sely_minigame_hub::routes::seo::seo_routes;
use sely_minigame_hub::routes::share::share_routes;
use sely_minigame_hub::routes::trpc::trpc_routes;
use sely_minigame_hub::storage::leaderboard::create_redis_pool;
use sely_minigame_hub::storage::turso::create_turso_connections;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use vercel_runtime::axum::VercelLayer;
use vercel_runtime::{run, Error};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let database = create_turso_connections().await;
    let turso_conn = database.primary.map(|conn| Arc::new(Mutex::new(conn)));
    let local_fallback_conn = database.local_fallback.map(|conn| Arc::new(Mutex::new(conn)));
    let redis_pool = create_redis_pool().await;

    let state = AppState { turso_conn, local_fallback_conn, redis_pool, llm_client: reqwest::Client::new() };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_routes = axum::Router::new()
        .merge(leaderboard_routes())
        .merge(trpc_routes())
        .merge(scheduled_routes())
        .with_state(state);

    let router = axum::Router::new()
        .merge(seo_routes())
        .merge(config_routes())
        .merge(share_routes())
        .merge(og_routes())
        .merge(api_routes)
        .layer(CompressionLayer::new())
        .layer(cors);

    let app = tower::ServiceBuilder::new()
        .layer(VercelLayer::new())
        .service(router);

    run(app).await
}
