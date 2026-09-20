use lambda_http::{run, Error};
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

#[tokio::main]
async fn main() -> Result<(), Error> {
    // Vercel Serverless environment compatibility shim
    if std::env::var("AWS_LAMBDA_FUNCTION_NAME").is_err() {
        std::env::set_var("AWS_LAMBDA_FUNCTION_NAME", "index");
    }
    if std::env::var("AWS_LAMBDA_FUNCTION_MEMORY_SIZE").is_err() {
        std::env::set_var("AWS_LAMBDA_FUNCTION_MEMORY_SIZE", "128");
    }
    if std::env::var("AWS_LAMBDA_FUNCTION_VERSION").is_err() {
        std::env::set_var("AWS_LAMBDA_FUNCTION_VERSION", "$LATEST");
    }
    if std::env::var("AWS_LAMBDA_LOG_STREAM_NAME").is_err() {
        std::env::set_var("AWS_LAMBDA_LOG_STREAM_NAME", "default");
    }
    if std::env::var("AWS_LAMBDA_LOG_GROUP_NAME").is_err() {
        std::env::set_var("AWS_LAMBDA_LOG_GROUP_NAME", "/aws/lambda/index");
    }

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
        .layer(cors);

    run(app).await
}
