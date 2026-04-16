use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::get,
};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};

use solana_blacklist::blacklist::{
    BlacklistCollector, BlacklistOptions, BlacklistResult, BlacklistSource,
    default_blacklist_sources,
};

// ── Shared application state ──────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    sources: HashMap<String, BlacklistSource>,
    cache: Arc<RwLock<Option<BlacklistResult>>>,
}

// ── Error handling ────────────────────────────────────────────────────────────

struct ApiError(anyhow::Error);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = json!({ "error": self.0.to_string() });
        (StatusCode::INTERNAL_SERVER_ERROR, Json(body)).into_response()
    }
}

impl<E: Into<anyhow::Error>> From<E> for ApiError {
    fn from(e: E) -> Self {
        ApiError(e.into())
    }
}

type ApiResult<T> = Result<T, ApiError>;

// ── Query parameters ──────────────────────────────────────────────────────────

#[derive(Deserialize, Default)]
struct BlacklistQuery {
    source: Option<String>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn list_sources(State(state): State<AppState>) -> impl IntoResponse {
    Json(json!(state.sources))
}

async fn get_blacklist(
    State(state): State<AppState>,
    Query(params): Query<BlacklistQuery>,
) -> ApiResult<Response> {
    let guard = state.cache.read().await;
    let Some(result) = guard.as_ref() else {
        let body =
            json!({ "error": "Blacklist data is not yet available, first fetch in progress" });
        return Ok((StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response());
    };

    // If a source filter is given, filter entries client-side from the cached data
    if let Some(ref name) = params.source {
        if !state.sources.contains_key(name) {
            let body = json!({
                "error": format!("source '{}' not found", name),
                "available": state.sources.keys().collect::<Vec<_>>()
            });
            return Ok((StatusCode::NOT_FOUND, Json(body)).into_response());
        }

        let filtered_entries: Vec<_> = result
            .entries
            .iter()
            .filter(|e| e.sources.iter().any(|s| s.name == *name))
            .cloned()
            .collect();

        let filtered = BlacklistResult {
            unique_pubkeys: filtered_entries.len(),
            sources: 1,
            fetched_at: result.fetched_at.clone(),
            entries: filtered_entries,
        };
        return Ok(Json(filtered).into_response());
    }

    Ok(Json(result.clone()).into_response())
}

async fn get_pubkey(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> ApiResult<Response> {
    if let Err(reason) = solana_blacklist::utils::validate_solana_pubkey(&pubkey) {
        let body = json!({ "error": format!("invalid pubkey: {}", reason) });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    let guard = state.cache.read().await;
    let Some(result) = guard.as_ref() else {
        let body =
            json!({ "error": "Blacklist data is not yet available, first fetch in progress" });
        return Ok((StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response());
    };

    match result.entries.iter().find(|e| e.pubkey == pubkey) {
        Some(entry) => {
            let body = json!({
                "pubkey": &entry.pubkey,
                "blacklisted": true,
                "name": &entry.name,
                "first_seen": &entry.first_seen,
                "sources": &entry.sources,
            });
            Ok(Json(body).into_response())
        }
        None => {
            let body = json!({
                "pubkey": pubkey,
                "blacklisted": false,
                "sources": [],
            });
            Ok((StatusCode::NOT_FOUND, Json(body)).into_response())
        }
    }
}

// ── Background collector ─────────────────────────────────────────────────────

fn build_collector(sources: HashMap<String, BlacklistSource>) -> BlacklistCollector {
    let db_path = std::env::var("BLACKLIST_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./blacklist.db"));

    let solana_rpc_url = std::env::var("SOLANA_RPC_URL")
        .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".to_string());

    let filter_inactive = std::env::var("BLACKLIST_FILTER_INACTIVE")
        .map(|v| !matches!(v.to_lowercase().as_str(), "false" | "0"))
        .unwrap_or(true);

    let opts = BlacklistOptions {
        persistence_path: Some(db_path),
        solana_rpc_url,
        filter_inactive,
        ..BlacklistOptions::default()
    };

    BlacklistCollector::new(opts).with_sources(sources)
}

fn spawn_background_collector(
    sources: HashMap<String, BlacklistSource>,
    cache: Arc<RwLock<Option<BlacklistResult>>>,
    refresh_secs: u64,
) {
    tokio::spawn(async move {
        let collector = build_collector(sources);
        loop {
            match collector.run().await {
                Ok(result) => {
                    let count = result.unique_pubkeys;
                    *cache.write().await = Some(result);
                    println!("[collector] Fetched {} blacklisted pubkeys", count,);
                }
                Err(err) => {
                    eprintln!("[collector] Error: {:#}", err);
                    // Keep serving stale data on failure
                }
            }
            tokio::time::sleep(Duration::from_secs(refresh_secs)).await;
        }
    });
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let sources = default_blacklist_sources();
    let cache: Arc<RwLock<Option<BlacklistResult>>> = Arc::new(RwLock::new(None));

    let refresh_secs: u64 = std::env::var("BLACKLIST_REFRESH_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300);

    // Run first fetch synchronously so data is available at startup
    let collector = build_collector(sources.clone());
    match collector.run().await {
        Ok(result) => {
            println!(
                "[collector] Initial fetch: {} blacklisted pubkeys from {} sources",
                result.unique_pubkeys, result.sources,
            );
            *cache.write().await = Some(result);
        }
        Err(err) => {
            eprintln!("[collector] Initial fetch failed: {:#}", err);
            eprintln!("[collector] API will start with empty cache, background loop will retry");
        }
    }

    // Spawn background refresh loop
    spawn_background_collector(sources.clone(), cache.clone(), refresh_secs);

    let state = AppState { sources, cache };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/sources", get(list_sources))
        .route("/blacklist", get(get_blacklist))
        .route("/blacklist/{pubkey}", get(get_pubkey))
        .layer(cors)
        .with_state(state);

    let addr = "0.0.0.0:3000";
    println!(
        "Solana Blacklist API listening on http://{addr} (refresh every {}s)",
        refresh_secs,
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
