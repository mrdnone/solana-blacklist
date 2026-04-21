use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::{
    Router,
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};

use solana_blacklist::blacklist::{
    BlacklistCollector, BlacklistOptions, BlacklistResult, BlacklistSource,
    default_blacklist_sources,
};
use solana_blacklist::persistence::FirstSeenStore;

// ── Shared application state ──────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    sources: HashMap<String, BlacklistSource>,
    cache: Arc<RwLock<Option<BlacklistResult>>>,
    store: Arc<Mutex<FirstSeenStore>>,
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
    let mut sources = serde_json::to_value(&state.sources).unwrap();
    // Include meridian as a known source even though it's not in the static .json config
    if let serde_json::Value::Object(ref mut map) = sources {
        map.entry(solana_blacklist::meridian::MERIDIAN_SOURCE_NAME.to_string())
            .or_insert_with(|| json!({
                "name": solana_blacklist::meridian::MERIDIAN_SOURCE_NAME,
                "description": "Community-voted blacklist via Meridian validator voting",
            }));
    }
    Json(sources)
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
        let available: Vec<String> = result
            .entries
            .iter()
            .flat_map(|e| e.sources.iter().map(|s| s.name.clone()))
            .collect::<std::collections::BTreeSet<_>>()
            .into_iter()
            .collect();

        if !available.iter().any(|s| s == name) {
            let body = json!({
                "error": format!("source '{}' not found", name),
                "available": available
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

    // Resolve identity pubkey → vote account if needed.
    // find_vote_identity_for matches vote_identity, identity, or node_pubkey.
    let resolved_vote_pubkey = {
        let store = state.store.lock().unwrap();
        store.find_vote_identity_for(&pubkey).unwrap_or(None)
    };
    // The canonical vote pubkey to search in the blacklist cache.
    let vote_pubkey = resolved_vote_pubkey.as_deref().unwrap_or(&pubkey);
    // If we resolved a different key, the input was an identity key.
    let identity_input = if resolved_vote_pubkey.is_some() && vote_pubkey != pubkey {
        Some(&pubkey)
    } else {
        None
    };

    let guard = state.cache.read().await;
    let Some(result) = guard.as_ref() else {
        let body =
            json!({ "error": "Blacklist data is not yet available, first fetch in progress" });
        return Ok((StatusCode::SERVICE_UNAVAILABLE, Json(body)).into_response());
    };

    match result.entries.iter().find(|e| e.pubkey == vote_pubkey) {
        Some(entry) => {
            // Look up identity from DB for extra context.
            let identity = {
                let store = state.store.lock().unwrap();
                store
                    .get_validator(vote_pubkey)
                    .ok()
                    .flatten()
                    .and_then(|v| v.identity)
            };
            let body = json!({
                "pubkey": vote_pubkey,
                "identity": identity_input.map(|s| s.to_owned()).or(identity),
                "blacklisted": true,
                "name": &entry.name,
                "first_seen": &entry.first_seen,
                "sources": &entry.sources,
                "in_validators_db": true,
            });
            Ok(Json(body).into_response())
        }
        None => {
            let (in_db, identity) = {
                let store = state.store.lock().unwrap();
                let in_db = store.validator_exists(vote_pubkey).unwrap_or(false);
                let identity = store
                    .get_validator(vote_pubkey)
                    .ok()
                    .flatten()
                    .and_then(|v| v.identity);
                (in_db, identity)
            };
            let body = json!({
                "pubkey": vote_pubkey,
                "identity": identity_input.map(|s| s.to_owned()).or(identity),
                "blacklisted": false,
                "sources": [],
                "in_validators_db": in_db,
            });
            Ok(Json(body).into_response())
        }
    }
}

// ── Validators list endpoint ─────────────────────────────────────────────────

#[derive(Deserialize, Default)]
struct ValidatorsQuery {
    q: Option<String>,
    delinquent: Option<bool>,
    limit: Option<u32>,
    offset: Option<u32>,
}

async fn list_validators(
    State(state): State<AppState>,
    Query(params): Query<ValidatorsQuery>,
) -> ApiResult<impl IntoResponse> {
    let limit = params.limit.unwrap_or(50).min(500);
    let offset = params.offset.unwrap_or(0);
    let q = params.q.as_deref();

    let store = state.store.lock().unwrap();
    let validators = store.list_validators(q, params.delinquent, limit, offset)?;
    let total = store.count_validators(q, params.delinquent)?;

    Ok(Json(json!({
        "validators": validators,
        "total": total,
        "limit": limit,
        "offset": offset,
    })))
}

// ── Validator detail endpoint ────────────────────────────────────────────────

async fn get_validator_detail(
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> ApiResult<Response> {
    if let Err(reason) = solana_blacklist::utils::validate_solana_pubkey(&pubkey) {
        let body = json!({ "error": format!("invalid pubkey: {}", reason) });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    let store = state.store.lock().unwrap();
    let current = store.get_validator(&pubkey)?;
    let epochs = store.get_validator_epochs(&pubkey)?;

    if current.is_none() && epochs.is_empty() {
        let body = json!({ "error": "validator not found" });
        return Ok((StatusCode::NOT_FOUND, Json(body)).into_response());
    }

    let body = json!({
        "vote_identity": pubkey,
        "current": current,
        "epochs": epochs,
    });
    Ok(Json(body).into_response())
}

// ── Epoch endpoints ──────────────────────────────────────────────────────────

async fn list_epochs(State(state): State<AppState>) -> ApiResult<Response> {
    let store = state.store.lock().unwrap();
    let epochs = store.list_stored_epochs()?;
    Ok(Json(json!(epochs)).into_response())
}

#[derive(Deserialize, Default)]
struct EpochDetailQuery {
    q: Option<String>,
    delinquent: Option<bool>,
    limit: Option<u32>,
    offset: Option<u32>,
}

async fn get_epoch_detail(
    State(state): State<AppState>,
    Path(epoch): Path<u64>,
    Query(params): Query<EpochDetailQuery>,
) -> ApiResult<Response> {
    let limit = params.limit.unwrap_or(50).min(500);
    let offset = params.offset.unwrap_or(0);
    let q = params.q.as_deref();

    let store = state.store.lock().unwrap();
    let total = store.count_epoch_snapshots(epoch, q, params.delinquent)?;

    if total == 0 && offset == 0 && q.is_none() && params.delinquent.is_none() {
        let body = json!({ "error": format!("no data for epoch {}", epoch) });
        return Ok((StatusCode::NOT_FOUND, Json(body)).into_response());
    }

    let validators = store.get_epoch_snapshots(epoch, q, params.delinquent, limit, offset)?;

    let body = json!({
        "epoch": epoch,
        "validator_count": total,
        "validators": validators,
        "total": total,
        "limit": limit,
        "offset": offset,
    });
    Ok(Json(body).into_response())
}

// ── Meridian voting endpoints ────────────────────────────────────────────────

async fn vote_submit(
    State(state): State<AppState>,
    Json(req): Json<solana_blacklist::meridian::VoteRequest>,
) -> ApiResult<Response> {
    // Validate pubkey formats
    if let Err(reason) = solana_blacklist::utils::validate_solana_pubkey(&req.voter_identity) {
        let body = json!({ "error": format!("invalid voter_identity: {}", reason) });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }
    if let Err(reason) = solana_blacklist::utils::validate_solana_pubkey(&req.target_vote_pubkey) {
        let body = json!({ "error": format!("invalid target_vote_pubkey: {}", reason) });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    let store = state.store.lock().unwrap();

    // Voter must be a known validator
    let resolved = store.find_vote_identity_for(&req.voter_identity)?;
    let Some(voter_vote_account) = resolved else {
        let body = json!({ "error": "voter_identity is not a known validator" });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    };

    // Cannot self-vote
    if voter_vote_account == req.target_vote_pubkey {
        let body = json!({ "error": "cannot vote to blacklist your own vote account" });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    // Target must exist
    if !store.validator_exists(&req.target_vote_pubkey)? {
        let body = json!({ "error": "target_vote_pubkey is not a known active validator" });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    // Verify ed25519 signature
    if let Err(e) = solana_blacklist::meridian::verify_vote(
        &req.voter_identity,
        &req.target_vote_pubkey,
        &req.signature,
    ) {
        let body = json!({ "error": format!("signature verification failed: {e}") });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    let vote = solana_blacklist::persistence::Vote {
        voter_identity: req.voter_identity,
        target_vote_pubkey: req.target_vote_pubkey,
        signature: req.signature,
        voted_at: chrono::Utc::now().to_rfc3339(),
    };
    let inserted = store.insert_vote(&vote)?;

    Ok(Json(json!({ "status": "ok", "inserted": inserted })).into_response())
}

async fn votes_list(State(state): State<AppState>) -> ApiResult<Response> {
    let store = state.store.lock().unwrap();
    let targets = store.list_vote_targets()?;
    Ok(Json(json!({
        "threshold": solana_blacklist::meridian::VOTE_THRESHOLD,
        "targets": targets,
    }))
    .into_response())
}

async fn vote_detail(
    State(state): State<AppState>,
    Path(target): Path<String>,
) -> ApiResult<Response> {
    if let Err(reason) = solana_blacklist::utils::validate_solana_pubkey(&target) {
        let body = json!({ "error": format!("invalid pubkey: {}", reason) });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    let store = state.store.lock().unwrap();
    let votes = store.get_votes_for_target(&target)?;
    let vote_count = votes.len() as u64;
    let threshold = solana_blacklist::meridian::VOTE_THRESHOLD;

    Ok(Json(json!({
        "target": target,
        "vote_count": vote_count,
        "threshold": threshold,
        "blacklisted": vote_count >= threshold,
        "votes": votes,
    }))
    .into_response())
}


async fn meridian_info() -> impl IntoResponse {
    Json(json!({
        "name": "Meridian — Validator Community Voting Blacklist",
        "description": "Active validators sign a canonical message to vote for blacklisting a target. Threshold: 10 votes.",
        "how_to_vote": [
            "1. Choose the target vote account pubkey to blacklist.",
            "2. Build the canonical message: meridian:blacklist:<target_vote_pubkey>",
            "3. Sign with your validator identity keypair: solana sign-offchain-message -k <identity-keypair> <message>",
            "4. POST /votes with { voter_identity, target_vote_pubkey, signature }"
        ],
        "endpoints": {
            "POST /votes": "Submit a vote",
            "GET /votes": "List all targets with vote counts",
            "GET /votes/{target}": "Get votes for a specific target",
            "GET /meridian": "Voting UI (HTML)",
            "GET /meridian/info": "This endpoint"
        }
    }))
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

    let db_path = std::env::var("BLACKLIST_DB_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./blacklist.db"));

    let refresh_secs: u64 = std::env::var("BLACKLIST_REFRESH_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(300);

    // Open DB once at startup
    let store = FirstSeenStore::open(&db_path).expect("Failed to open database");
    let store = Arc::new(Mutex::new(store));

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

    let state = AppState {
        sources,
        cache,
        store,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/sources", get(list_sources))
        .route("/blacklist", get(get_blacklist))
        .route("/blacklist/{pubkey}", get(get_pubkey))
        .route("/validators", get(list_validators))
        .route("/validators/{pubkey}", get(get_validator_detail))
        .route("/epochs", get(list_epochs))
        .route("/epochs/{epoch}", get(get_epoch_detail))
        .route("/votes", post(vote_submit).get(votes_list))
        .route("/votes/{target}", get(vote_detail))

        .route("/meridian/info", get(meridian_info))
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
