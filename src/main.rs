//! SELY MiniGame Hub - Rust Standalone Server (Production VDS Binary)
//! Matches server/_core/index.ts, server/app.ts, and RUSTGEC.MD.

use std::env;
use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

use sely_minigame_hub::routes::config::config_routes;
use sely_minigame_hub::routes::leaderboard::{leaderboard_routes, AppState};
use sely_minigame_hub::routes::og::og_routes;
use sely_minigame_hub::routes::scheduled::scheduled_routes;
use sely_minigame_hub::routes::seo::seo_routes;
use sely_minigame_hub::routes::share::share_routes;
use sely_minigame_hub::routes::trpc::trpc_routes;
use sely_minigame_hub::storage::turso::{create_turso_connection, is_turso_configured};

async fn find_available_port(start_port: u16) -> Option<(tokio::net::TcpListener, u16)> {
    for port in start_port..(start_port + 20) {
        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
            return Some((listener, port));
        }
    }
    None
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "sely_minigame_hub=info,tower_http=info".into()),
        )
        .init();

    tracing::info!("Initializing SELY MiniGame Hub v2.0.0 (Rust Axum Engine)...");

    // Initialize Turso/LibSQL database connection (if configured or local fallback)
    let turso_conn = if is_turso_configured() {
        match create_turso_connection().await {
            Ok(conn) => {
                tracing::info!("Turso / LibSQL connection initialized successfully.");
                Some(Arc::new(Mutex::new(conn)))
            }
            Err(e) => {
                tracing::warn!("Turso connection failed: {}, falling back to in-memory store", e);
                None
            }
        }
    } else {
        None
    };

    let state = AppState { turso_conn };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build state-aware API routes first
    let api_routes = axum::Router::new()
        .merge(leaderboard_routes())
        .merge(trpc_routes())
        .with_state(state);

    // Build the main Axum application router
    let mut app = axum::Router::new()
        .merge(seo_routes())
        .merge(config_routes())
        .merge(scheduled_routes())
        .merge(share_routes())
        .merge(og_routes())
        .merge(api_routes)
        .layer(CompressionLayer::new())
        .layer(cors);

    // Storage proxy routes (/storage/* and /manus-storage/*)
    let storage_dir = if Path::new("dist/public/storage").is_dir() {
        "dist/public/storage"
    } else if Path::new("client/public/storage").is_dir() {
        "client/public/storage"
    } else {
        "storage"
    };

    if Path::new(storage_dir).is_dir() {
        tracing::info!("Serving storage assets from '{}'", storage_dir);
        app = app
            .nest_service("/storage", ServeDir::new(storage_dir))
            .nest_service("/manus-storage", ServeDir::new(storage_dir));
    }

    // Resolve SPA static frontend path (dist/public or client/dist or public)
    let static_dir = if Path::new("dist/public").is_dir() {
        "dist/public"
    } else if Path::new("client/dist").is_dir() {
        "client/dist"
    } else {
        "public"
    };

    let index_html = format!("{}/index.html", static_dir);
    if Path::new(&index_html).exists() {
        tracing::info!("Serving SPA static assets from '{}' with fallback '{}'", static_dir, index_html);
        let serve_service = ServeDir::new(static_dir).fallback(ServeFile::new(&index_html));
        app = app.fallback_service(serve_service);
    } else {
        tracing::warn!("Static index.html not found at '{}'. Only API routes will be active.", index_html);
    }

    // Pre-warm today's daily game content on standalone server startup
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let daily_store = sely_minigame_hub::storage::daily_content::MemoryDailyStore::new();
    let ensured = daily_store.ensure(&today);
    tracing::info!("Pre-warmed daily content for {} ({} games active)", ensured.date, ensured.games.len());

    let default_port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    let (listener, bound_port) = find_available_port(default_port)
        .await
        .expect("Failed to bind to any port in range");

    tracing::info!("🚀 SELY MiniGame Hub server listening on http://127.0.0.1:{}", bound_port);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Signal received, starting graceful shutdown...");
}
