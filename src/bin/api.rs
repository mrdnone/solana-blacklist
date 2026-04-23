use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::{
    Router,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::{delete, get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use utoipa::{OpenApi, ToSchema};
use utoipa::openapi::security::{ApiKey, ApiKeyValue, SecurityScheme};
use utoipa_swagger_ui::SwaggerUi;

use solana_blacklist::blacklist::{
    BlacklistCollector, BlacklistOptions, BlacklistResult, BlacklistSource,
    default_blacklist_sources,
};
use solana_blacklist::persistence::FirstSeenStore;

// ── OpenAPI doc ───────────────────────────────────────────────────────────────

/// Report submitted by a validator
#[derive(Serialize, ToSchema)]
struct VoteSchema {
    voter_identity: String,
    target_vote_pubkey: String,
    signature: String,
    voted_at: String,
    reason: Option<String>,
}

/// A target with its report count
#[derive(Serialize, ToSchema)]
struct VoteTargetSchema {
    target_vote_pubkey: String,
    vote_count: u64,
}

/// Request body for submitting a blacklist report
#[derive(Deserialize, ToSchema)]
#[allow(dead_code)]
struct VoteSubmitSchema {
    voter_identity: String,
    target_vote_pubkey: String,
    signature: String,
    voted_at_ts: i64,
    reason: String,
}

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Solana Blacklist API",
        description = "Aggregated Solana validator blacklist with community blacklist reporting (Meridian).",
        version = "1.0.0"
    ),
    paths(
        api_list_sources,
        api_get_blacklist,
        api_get_pubkey,
        api_votes_list,
        api_vote_submit,
        api_vote_detail,
        api_admin_list_votes,
        api_admin_votes_by_validator,
        api_admin_approve,
        api_admin_reject,
        api_admin_remove_blacklist,
    ),
    components(
        schemas(VoteSchema, VoteTargetSchema, VoteSubmitSchema)
    ),
    tags(
        (name = "Blacklist", description = "Aggregated blacklist endpoints"),
        (name = "Meridian", description = "Community validator blacklist reporting"),
        (name = "Admin", description = "Admin operations — require X-Admin-Key header"),
    ),
    modifiers(&SecurityAddon),
)]
struct ApiDoc;

struct SecurityAddon;

impl utoipa::Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "admin_key",
            SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("x-admin-key"))),
        );
    }
}

// ── Shared application state ──────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    sources: HashMap<String, BlacklistSource>,
    cache: Arc<RwLock<Option<BlacklistResult>>>,
    store: Arc<Mutex<FirstSeenStore>>,
    admin_key: Option<String>,
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

// ── Admin auth helper ────────────────────────────────────────────────────────

fn require_admin(headers: &HeaderMap, admin_key: &Option<String>) -> Result<(), Response> {
    let Some(key) = admin_key else {
        return Err((StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({"error": "admin not configured"}))).into_response());
    };
    let provided = headers
        .get("x-admin-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if provided != key {
        return Err((StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "unauthorized"}))).into_response());
    }
    Ok(())
}

// ── Query parameters ──────────────────────────────────────────────────────────

#[derive(Deserialize, Default)]
struct BlacklistQuery {
    source: Option<String>,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

#[utoipa::path(
    get, path = "/sources",
    tag = "Blacklist",
    responses((status = 200, description = "Map of configured blacklist sources"))
)]
async fn api_list_sources(State(state): State<AppState>) -> impl IntoResponse {
    let mut sources = serde_json::to_value(&state.sources).unwrap();
    // Include meridian as a known source even though it's not in the static .json config
    if let serde_json::Value::Object(ref mut map) = sources {
        map.entry(solana_blacklist::meridian::MERIDIAN_SOURCE_NAME.to_string())
            .or_insert_with(|| json!({
                "name": solana_blacklist::meridian::MERIDIAN_SOURCE_NAME,
                "description": "Community-reported blacklist via Meridian validator reporting",
            }));
    }
    Json(sources)
}

#[utoipa::path(
    get, path = "/blacklist",
    tag = "Blacklist",
    params(("source" = Option<String>, Query, description = "Filter by source name")),
    responses(
        (status = 200, description = "Blacklisted pubkeys"),
        (status = 503, description = "Data not yet available"),
    )
)]
async fn api_get_blacklist(
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

#[utoipa::path(
    get, path = "/blacklist/{pubkey}",
    tag = "Blacklist",
    params(("pubkey" = String, Path, description = "Vote account or identity pubkey")),
    responses(
        (status = 200, description = "Pubkey blacklist status"),
        (status = 400, description = "Invalid pubkey"),
        (status = 503, description = "Data not yet available"),
    )
)]
async fn api_get_pubkey(
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
    exclude_zero_stake: Option<bool>,
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
    let exclude_zero_stake = params.exclude_zero_stake.unwrap_or(false);

    let store = state.store.lock().unwrap();
    let validators = store.list_validators(q, params.delinquent, exclude_zero_stake, limit, offset)?;
    let total = store.count_validators(q, params.delinquent, exclude_zero_stake)?;

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
    blacklisted_only: Option<bool>,
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
    let blacklisted_only = params.blacklisted_only.unwrap_or(false);

    let store = state.store.lock().unwrap();
    let total = store.count_epoch_snapshots(epoch, q, params.delinquent, blacklisted_only)?;

    if total == 0 && offset == 0 && q.is_none() && params.delinquent.is_none() && !blacklisted_only {
        let body = json!({ "error": format!("no data for epoch {}", epoch) });
        return Ok((StatusCode::NOT_FOUND, Json(body)).into_response());
    }

    let validators = store.get_epoch_snapshots(epoch, q, params.delinquent, blacklisted_only, limit, offset)?;

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

#[utoipa::path(
    post, path = "/votes",
    tag = "Meridian",
    request_body = VoteSubmitSchema,
    responses(
        (status = 200, description = "Report accepted"),
        (status = 400, description = "Invalid request or stale timestamp"),
    )
)]
async fn api_vote_submit(
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

    // Reason is required
    if req.reason.trim().is_empty() {
        let body = json!({ "error": "reason is required" });
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

    // Verify ed25519 signature — pass the known-valid identity into verify_vote
    // so the active-validator guard is enforced inside the function itself.
    let active_identities =
        std::collections::HashSet::from([req.voter_identity.clone()]);
    if let Err(e) = solana_blacklist::meridian::verify_vote(
        &req.voter_identity,
        &req.target_vote_pubkey,
        &req.signature,
        req.voted_at_ts,
        &active_identities,
    ) {
        let body = json!({ "error": format!("signature verification failed: {e}") });
        return Ok((StatusCode::BAD_REQUEST, Json(body)).into_response());
    }

    let vote = solana_blacklist::persistence::Vote {
        voter_identity: req.voter_identity,
        target_vote_pubkey: req.target_vote_pubkey,
        signature: req.signature,
        voted_at: chrono::Utc::now().to_rfc3339(),
        reason: Some(req.reason),
    };
    let inserted = store.insert_vote(&vote)?;

    Ok(Json(json!({ "status": "ok", "inserted": inserted })).into_response())
}

#[utoipa::path(
    get, path = "/votes",
    tag = "Meridian",
    responses((status = 200, description = "All report targets with counts", body = Vec<VoteTargetSchema>))
)]
async fn api_votes_list(State(state): State<AppState>) -> ApiResult<Response> {
    let store = state.store.lock().unwrap();
    let targets = store.list_vote_targets()?;
    Ok(Json(json!({
        "threshold": solana_blacklist::meridian::VOTE_THRESHOLD,
        "targets": targets,
    }))
    .into_response())
}

#[utoipa::path(
    get, path = "/votes/{target}",
    tag = "Meridian",
    params(("target" = String, Path, description = "Target vote account pubkey")),
    responses(
        (status = 200, description = "Report detail for target", body = Vec<VoteSchema>),
        (status = 400, description = "Invalid pubkey"),
    )
)]
async fn api_vote_detail(
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
        "name": "Meridian — Validator Community Blacklist Reporting",
        "description": "Active validators sign a canonical message to report a target for blacklisting. Threshold: 10 reports.",
        "how_to_report": [
            "1. Choose the target vote account pubkey to blacklist.",
            "2. Build the canonical message: meridian:blacklist:<target_vote_pubkey>",
            "3. Sign with your validator identity keypair: solana sign-offchain-message -k <identity-keypair> <message>",
            "4. POST /votes with { voter_identity, target_vote_pubkey, signature }"
        ],
        "endpoints": {
            "POST /votes": "Submit a report",
            "GET /votes": "List all targets with report counts",
            "GET /votes/{target}": "Get reports for a specific target",
            "GET /meridian/info": "This endpoint"
        }
    }))
}

// ── Admin handlers ───────────────────────────────────────────────────────────

#[utoipa::path(
    get, path = "/admin/votes",
    tag = "Admin",
    security(("admin_key" = [])),
    responses(
        (status = 200, description = "All reports ever submitted", body = Vec<VoteSchema>),
        (status = 401, description = "Unauthorized"),
        (status = 503, description = "Admin not configured"),
    )
)]
async fn api_admin_list_votes(
    headers: HeaderMap,
    State(state): State<AppState>,
) -> Response {
    if let Err(r) = require_admin(&headers, &state.admin_key) { return r; }
    let store = state.store.lock().unwrap();
    match store.get_all_votes() {
        Ok(votes) => Json(json!({ "votes": votes })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[utoipa::path(
    get, path = "/admin/votes/by-validator/{pubkey}",
    tag = "Admin",
    security(("admin_key" = [])),
    params(("pubkey" = String, Path, description = "Validator identity or vote account pubkey")),
    responses(
        (status = 200, description = "Reports involving this validator", body = Vec<VoteSchema>),
        (status = 401, description = "Unauthorized"),
    )
)]
async fn api_admin_votes_by_validator(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> Response {
    if let Err(r) = require_admin(&headers, &state.admin_key) { return r; }
    let store = state.store.lock().unwrap();
    match store.get_votes_by_validator(&pubkey) {
        Ok(votes) => Json(json!({ "votes": votes })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[utoipa::path(
    post, path = "/admin/votes/{target}/approve",
    tag = "Admin",
    security(("admin_key" = [])),
    params(("target" = String, Path, description = "Vote account pubkey to manually approve")),
    responses(
        (status = 200, description = "Approved — added to manual blacklist"),
        (status = 401, description = "Unauthorized"),
    )
)]
async fn api_admin_approve(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(target): Path<String>,
) -> Response {
    if let Err(r) = require_admin(&headers, &state.admin_key) { return r; }
    let store = state.store.lock().unwrap();
    match store.admin_approve_target(&target, "admin") {
        Ok(()) => Json(json!({ "status": "approved", "vote_identity": target })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[utoipa::path(
    post, path = "/admin/votes/{target}/reject",
    tag = "Admin",
    security(("admin_key" = [])),
    params(("target" = String, Path, description = "Vote account pubkey to reject")),
    responses(
        (status = 200, description = "Rejected — excluded from threshold list"),
        (status = 401, description = "Unauthorized"),
    )
)]
async fn api_admin_reject(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(target): Path<String>,
) -> Response {
    if let Err(r) = require_admin(&headers, &state.admin_key) { return r; }
    let store = state.store.lock().unwrap();
    match store.admin_reject_target(&target, "admin") {
        Ok(()) => Json(json!({ "status": "rejected", "vote_identity": target })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    }
}

#[utoipa::path(
    delete, path = "/admin/blacklist/{pubkey}",
    tag = "Admin",
    security(("admin_key" = [])),
    params(("pubkey" = String, Path, description = "Vote account pubkey to remove from manual blacklist")),
    responses(
        (status = 200, description = "Removed from manual blacklist"),
        (status = 401, description = "Unauthorized"),
    )
)]
async fn api_admin_remove_blacklist(
    headers: HeaderMap,
    State(state): State<AppState>,
    Path(pubkey): Path<String>,
) -> Response {
    if let Err(r) = require_admin(&headers, &state.admin_key) { return r; }
    let store = state.store.lock().unwrap();
    match store.admin_remove_from_blacklist(&pubkey) {
        Ok(removed) => Json(json!({ "removed": removed, "vote_identity": pubkey })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
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
        admin_key: std::env::var("ADMIN_KEY").ok(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_router = Router::new()
        .route("/sources", get(api_list_sources))
        .route("/blacklist", get(api_get_blacklist))
        .route("/blacklist/{pubkey}", get(api_get_pubkey))
        .route("/validators", get(list_validators))
        .route("/validators/{pubkey}", get(get_validator_detail))
        .route("/epochs", get(list_epochs))
        .route("/epochs/{epoch}", get(get_epoch_detail))
        .route("/votes", post(api_vote_submit).get(api_votes_list))
        .route("/votes/{target}", get(api_vote_detail))
        .route("/admin/votes", get(api_admin_list_votes))
        .route("/admin/votes/by-validator/{pubkey}", get(api_admin_votes_by_validator))
        .route("/admin/votes/{target}/approve", post(api_admin_approve))
        .route("/admin/votes/{target}/reject", post(api_admin_reject))
        .route("/admin/blacklist/{pubkey}", delete(api_admin_remove_blacklist))
        .route("/meridian/info", get(meridian_info))
        .layer(cors)
        .with_state(state);

    // Serve the frontend SPA under /blacklist/. The ServeDir fallback sends
    // index.html for any path that doesn't match a real file, so React Router
    // can handle client-side routing on hard refresh or direct links.
    let app = Router::new()
        .merge(SwaggerUi::new("/docs").url("/docs/openapi.json", ApiDoc::openapi()))
        .nest("/api", api_router)
        .nest_service(
            "/blacklist",
            ServeDir::new("frontend/dist")
                .fallback(ServeFile::new("frontend/dist/index.html")),
        );

    let addr = "0.0.0.0:3000";
    println!(
        "Solana Blacklist API listening on http://{addr} (refresh every {}s)",
        refresh_secs,
    );

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
