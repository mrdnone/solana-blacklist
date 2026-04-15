use std::collections::HashMap;

use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::get,
};
use serde::Deserialize;
use serde_json::json;
use tower_http::cors::{Any, CorsLayer};

use solana_blacklist::blacklist::{
    BlacklistCollector, BlacklistOptions, BlacklistResult, BlacklistSource,
    default_blacklist_sources,
};

// ── Shared application state ──────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    sources: HashMap<String, BlacklistSource>,
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
    let sources = match params.source {
        None => state.sources.clone(),
        Some(ref name) => match state.sources.get(name) {
            Some(src) => {
                let mut m = HashMap::new();
                m.insert(name.clone(), src.clone());
                m
            }
            None => {
                let body = json!({
                    "error": format!("source '{}' not found", name),
                    "available": state.sources.keys().collect::<Vec<_>>()
                });
                return Ok((StatusCode::NOT_FOUND, Json(body)).into_response());
            }
        },
    };

    let result = run_collector(sources).await?;
    Ok(Json(result).into_response())
}

async fn get_pubkey(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> ApiResult<Response> {
    if let Err(reason) = solana_blacklist::utils::validate_solana_pubkey(&pubkey) {
        let body = json!({ "error": format!("invalid pubkey: {}", reason) });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    let result = run_collector(state.sources.clone()).await?;

    match result.entries.iter().find(|e| e.pubkey == pubkey) {
        Some(entry) => {
            let body = json!({
                "pubkey": &entry.pubkey,
                "blacklisted": true,
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

// ── Collector helper ──────────────────────────────────────────────────────────

async fn run_collector(
    sources: HashMap<String, BlacklistSource>,
) -> anyhow::Result<BlacklistResult> {
    BlacklistCollector::new(BlacklistOptions::default())
        .with_sources(sources)
        .run()
        .await
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let sources = default_blacklist_sources();
    let state = AppState { sources };

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
    println!("Solana Blacklist API listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
