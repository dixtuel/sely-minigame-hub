use sely_minigame_hub::routes::config::config_routes;
use sely_minigame_hub::routes::leaderboard::{leaderboard_routes, AppState};
use sely_minigame_hub::routes::og::og_routes;
use sely_minigame_hub::routes::scheduled::scheduled_routes;
use sely_minigame_hub::routes::seo::seo_routes;
use sely_minigame_hub::routes::share::share_routes;
use sely_minigame_hub::routes::trpc::trpc_routes;
use sely_minigame_hub::storage::turso::{create_turso_connection, is_turso_configured};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use vercel_runtime::axum::VercelLayer;
use vercel_runtime::{run, Error};

#[tokio::main]
async fn main() -> Result<(), Error> {
    let turso_conn = if is_turso_configured() {
        create_turso_connection().await.ok().map(|c| Arc::new(Mutex::new(c)))
    } else {
        None
    };

    let state = AppState { turso_conn };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_routes = axum::Router::new()
        .merge(leaderboard_routes())
        .merge(trpc_routes())
        .with_state(state);

    let app = axum::Router::new()
        .merge(seo_routes())
        .merge(config_routes())
        .merge(scheduled_routes())
        .merge(share_routes())
        .merge(og_routes())
        .merge(api_routes)
        .layer(CompressionLayer::new())
        .layer(cors)
        .layer(VercelLayer);

    run(app).await
}
