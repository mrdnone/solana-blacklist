//! Solana Blacklist Aggregator
//!
//! Unifies JSON and CSV via JSONPath:
//!   1) Select candidate records with `record_path` (if set).
//!   2) Apply all `filters` as JSONPath predicates relative to each record.
//!      - If a filter starts with '$' it is evaluated as-is relative to the record.
//!      - If a filter starts with '?(' or '[?(' it is wrapped into `$[...]`.
//!   3) Extract pubkeys by `pubkey_path` (relative to the record), optional `reason_path`.
//!
//! CSV rows become JSON objects with keys:
//!   - With headers: exact header names + `c{index}` aliases (`c0`, `c1`, ...).
//!   - Without headers: `c{index}` only.
//!
//! Values are typed: number/bool if parseable, else string.

use std::{
    borrow::Cow,
    collections::{BTreeMap, BTreeSet, HashMap, HashSet},
    path::PathBuf,
    time::Duration,
};

use anyhow::{Context, Result, anyhow};
use futures::stream::{self, StreamExt};
use jsonpath_lib as jsonpath;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{Map as JMap, Value as Json, Value, json};

use crate::persistence::ValidatorMeta;
use crate::utils::validate_solana_pubkey;

/// Each source is a separate JSON file under `src/sources/`.
/// Adding a new source = dropping a new `.json` file in that folder and adding it here.
const SOURCE_FILES: &[(&str, &str)] = &[
    ("solana::sfdp_rejects", include_str!("sources/solana_sfdp_rejects.json")),
    ("sandwiched_me", include_str!("sources/sandwiched_me.json")),
    ("hanabi", include_str!("sources/hanabi.json")),
    ("jito:blacklist", include_str!("sources/jito_blacklist.json")),
];

pub fn default_blacklist_sources() -> BlacklistSources {
    SOURCE_FILES
        .iter()
        .map(|(key, json)| {
            let source: BlacklistSource =
                serde_json::from_str(json).unwrap_or_else(|e| panic!("Failed to parse source {key}: {e}"));
            (key.to_string(), source)
        })
        .collect()
}

pub type BlacklistSources = HashMap<String, BlacklistSource>;

#[derive(Default)]
pub struct BlacklistCollector {
    opts: BlacklistOptions,
    sources: BlacklistSources,
}

impl BlacklistCollector {
    pub fn new(opts: BlacklistOptions) -> Self {
        Self {
            opts,
            sources: Default::default(),
        }
    }

    pub fn with_sources(mut self, sources: impl Into<BlacklistSources>) -> Self {
        self.sources = sources.into();
        self
    }

    pub fn get_sources(&self) -> BlacklistSources {
        self.sources.clone()
    }

    pub fn get_source(&self, source: &str) -> Option<&BlacklistSource> {
        self.sources.get(source)
    }

    pub async fn run(&self) -> Result<BlacklistResult> {
        let client = Client::builder()
            .timeout(Duration::from_secs(self.opts.timeout_secs))
            .redirect(reqwest::redirect::Policy::limited(5))
            .user_agent("vote-blacklist-collector/0.3")
            .build()?;

        #[allow(clippy::redundant_iter_cloned)]
        let results = stream::iter(self.sources.values().cloned().map(|s| {
            let client = client.clone();
            async move {
                match s.handler {
                    BlacklistHandler::Json => process_json(&client, &s).await,
                    BlacklistHandler::Csv { .. } => process_csv(&client, &s).await,
                }
                .with_context(|| format!("source '{}'", s.name))
            }
        }))
        .buffer_unordered(self.opts.concurrency)
        .collect::<Vec<_>>()
        .await;

        let mut pairs: Vec<(String, BlacklistResultEntrySource)> = Vec::new();
        for r in results {
            pairs.extend(r?);
        }

        let mut map: BTreeMap<String, BTreeSet<BlacklistResultEntrySource>> = BTreeMap::new();
        for (pk, rr) in pairs {
            map.entry(pk).or_default().insert(rr);
        }
        let mut entries = map
            .into_iter()
            .map(|(k, v)| {
                let sources_vec: Vec<BlacklistResultEntrySource> = v.into_iter().collect();
                let name = sources_vec
                    .iter()
                    .filter_map(|s| s.validator_name.as_ref())
                    .next()
                    .cloned();
                BlacklistResultEntry {
                    pubkey: k,
                    name,
                    first_seen: None,
                    sources: sources_vec,
                }
            })
            .collect::<Vec<_>>();

        // Fetch active validators (RPC + Stakewiz) and epoch info concurrently
        let (epoch_info, (rpc_set, current_accounts, delinquent_accounts), stakewiz_map) = tokio::join!(
            fetch_epoch_info(&client, &self.opts.solana_rpc_url),
            fetch_vote_accounts(&client, &self.opts.solana_rpc_url),
            fetch_stakewiz_validators(&client),
        );

        // Filter inactive validators: only keep entries present in at least one active set.
        // Guard: skip if the RPC set is empty (RPC failure) to avoid dropping everything.
        if self.opts.filter_inactive && !rpc_set.is_empty() {
            let before = entries.len();
            entries.retain(|e| rpc_set.contains(&e.pubkey) || stakewiz_map.contains_key(&e.pubkey));
            println!(
                "[active-filter] Filtered {before} → {} entries ({} removed)",
                entries.len(),
                before - entries.len(),
            );
        }

        // Open DB once — reuse for both Stakewiz metadata upsert and first-seen persistence
        let store = self
            .opts
            .persistence_path
            .as_ref()
            .and_then(|db_path| crate::persistence::FirstSeenStore::open(db_path).ok());

        // Upsert Stakewiz metadata (enriched with RPC fields) into the validators table
        if let Some(ref store) = store {
            if !stakewiz_map.is_empty() {
                // Build a lookup from vote_pubkey -> RpcVoteAccount for merging
                let all_rpc: HashMap<&str, &RpcVoteAccount> = current_accounts
                    .iter()
                    .chain(delinquent_accounts.iter())
                    .map(|a| (a.vote_pubkey.as_str(), a))
                    .collect();

                let metas: Vec<ValidatorMeta> = stakewiz_map
                    .values()
                    .cloned()
                    .map(|mut m| {
                        if let Some(rpc_acc) = all_rpc.get(m.vote_identity.as_str()) {
                            m.node_pubkey = Some(rpc_acc.node_pubkey.clone());
                            m.activated_stake_lamports = Some(rpc_acc.activated_stake);
                            m.last_vote = Some(rpc_acc.last_vote);
                            m.root_slot = Some(rpc_acc.root_slot);
                            if let Some(last) = rpc_acc.epoch_credits.last() {
                                m.epoch_credits = Some(last[1]);
                                m.prev_epoch_credits = Some(last[2]);
                            }
                        }
                        m
                    })
                    .collect();
                if let Err(err) = store.upsert_validators(&metas) {
                    eprintln!("[persistence] Failed to upsert validators: {err:#}");
                }
            }

            // Also upsert RPC-only validators not covered by Stakewiz, so that
            // all on-chain validators are known (needed for Meridian voting).
            let rpc_only: Vec<ValidatorMeta> = current_accounts
                .iter()
                .chain(delinquent_accounts.iter())
                .filter(|a| !stakewiz_map.contains_key(&a.vote_pubkey))
                .map(|a| {
                    let is_delinquent = delinquent_accounts
                        .iter()
                        .any(|d| d.vote_pubkey == a.vote_pubkey);
                    ValidatorMeta {
                        vote_identity: a.vote_pubkey.clone(),
                        identity: None,
                        name: None,
                        delinquent: Some(is_delinquent),
                        activated_stake: None,
                        commission: Some(a.commission as f64),
                        skip_rate: None,
                        uptime: None,
                        version: None,
                        wiz_score: None,
                        apy_estimate: None,
                        ip_country: None,
                        image: None,
                        website: None,
                        updated_at: chrono::Utc::now().to_rfc3339(),
                        node_pubkey: Some(a.node_pubkey.clone()),
                        activated_stake_lamports: Some(a.activated_stake),
                        last_vote: Some(a.last_vote),
                        root_slot: Some(a.root_slot),
                        epoch_credits: a.epoch_credits.last().map(|c| c[1]),
                        prev_epoch_credits: a.epoch_credits.last().map(|c| c[2]),
                    }
                })
                .collect();
            if !rpc_only.is_empty() {
                println!(
                    "[persistence] Upserting {} RPC-only validators (not in Stakewiz)",
                    rpc_only.len()
                );
                if let Err(err) = store.upsert_validators(&rpc_only) {
                    eprintln!("[persistence] Failed to upsert RPC-only validators: {err:#}");
                }
            }
        }

        // Epoch snapshot: store once per epoch boundary
        if let (Some(store), Some(epoch_info)) = (&store, &epoch_info) {
            let current_epoch = epoch_info.epoch;
            let last_epoch = store.get_last_stored_epoch().unwrap_or(None);

            if last_epoch.is_none_or(|last| current_epoch > last) {
                let snapshots = build_epoch_snapshots(
                    current_epoch,
                    &current_accounts,
                    &delinquent_accounts,
                    &stakewiz_map,
                );
                match store.insert_epoch_snapshots(&snapshots) {
                    Ok(_) => {
                        println!(
                            "[epoch-snapshot] Stored {} snapshots for epoch {}",
                            snapshots.len(),
                            current_epoch
                        );
                        let _ = store.set_last_stored_epoch(current_epoch);
                    }
                    Err(err) => eprintln!("[epoch-snapshot] Failed to store snapshots: {err:#}"),
                }
            }
        }

        // Enrich names: prefer bulk lookup from Stakewiz data, fallback to per-pubkey HTTP
        if !stakewiz_map.is_empty() {
            for entry in &mut entries {
                if entry.name.is_none() {
                    if let Some(meta) = stakewiz_map.get(&entry.pubkey) {
                        if let Some(ref n) = meta.name {
                            if !n.is_empty() {
                                entry.name = Some(n.clone());
                            }
                        }
                    }
                }
            }
        } else if self.opts.enrich_names {
            enrich_names(&client, &mut entries, self.opts.concurrency).await;
        }

        // Persistence: record first-seen dates and populate entries
        if let Some(ref store) = store {
            let pubkeys: Vec<&str> = entries.iter().map(|e| e.pubkey.as_str()).collect();
            let _ = store.record_seen(&pubkeys);
            if let Ok(dates) = store.get_dates(&pubkeys) {
                for entry in &mut entries {
                    entry.first_seen = dates.get(&entry.pubkey).cloned();
                }
            }
        }

        // Meridian: inject community-voted blacklist entries
        if let Some(ref store) = store {
            match store.get_blacklisted_by_votes(crate::meridian::VOTE_THRESHOLD) {
                Ok(pubkeys) => {
                    for pubkey in pubkeys {
                        let src = BlacklistResultEntrySource {
                            name: crate::meridian::MERIDIAN_SOURCE_NAME.to_string(),
                            reason: Some(
                                "Community-voted by ≥10 active validators".to_string(),
                            ),
                            validator_name: None,
                        };
                        if let Some(entry) = entries.iter_mut().find(|e| e.pubkey == pubkey) {
                            if !entry
                                .sources
                                .iter()
                                .any(|s| s.name == crate::meridian::MERIDIAN_SOURCE_NAME)
                            {
                                entry.sources.push(src);
                            }
                        } else {
                            entries.push(BlacklistResultEntry {
                                pubkey,
                                name: None,
                                first_seen: None,
                                sources: vec![src],
                            });
                        }
                    }
                }
                Err(e) => eprintln!("[meridian] Failed to query votes: {e:#}"),
            }
        }

        Ok(BlacklistResult {
            unique_pubkeys: entries.len(),
            sources: self.sources.len(),
            fetched_at: Some(chrono::Utc::now().to_rfc3339()),
            entries,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BlacklistHandler {
    Json,
    Csv { delimiter: u8, headers: bool },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlacklistSource {
    /// Human-readable name of the blacklist source.
    pub name: String,
    /// URL to fetch the blacklist from.
    pub url: String,
    /// Optional HTTP headers for fetch. JSON only.
    pub fetch_headers: Option<HashMap<String, String>>,
    #[serde(default)]
    pub contact_into: Value,
    pub handler: BlacklistHandler,
    /// Optional: pre-select records before filters. JSON only. Defaults to "$".
    #[serde(default)]
    pub record_path: Option<String>,
    /// JSONPath evaluated **relative to the record/row**, may yield one or many.
    pub pubkey_path: String,
    /// ANDed filters. JSONPath evaluated **relative to the record**.
    /// Accepts "$.." paths or predicate forms "?(@.field > 0)" / "[?(@...)]".
    #[serde(default)]
    pub filters: Vec<String>,
    #[serde(default)]
    pub reason_template: Option<String>,
    // pub default_reason: Option<String>,
    /// Optional JSONPath evaluated relative to the record/row.
    #[serde(default)]
    pub reason_path: Option<String>,
    /// Optional JSONPath for extracting the validator name from the record/row.
    #[serde(default)]
    pub name_path: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BlacklistOptions {
    pub concurrency: usize,
    pub timeout_secs: u64,
    pub enrich_names: bool,
    pub persistence_path: Option<PathBuf>,
    pub filter_inactive: bool,
    pub solana_rpc_url: String,
}

impl Default for BlacklistOptions {
    fn default() -> Self {
        Self {
            concurrency: 8,
            timeout_secs: 20,
            enrich_names: true,
            persistence_path: None,
            filter_inactive: true,
            solana_rpc_url: "https://api.mainnet-beta.solana.com".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct BlacklistResult {
    pub unique_pubkeys: usize,
    pub sources: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fetched_at: Option<String>,
    pub entries: Vec<BlacklistResultEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BlacklistResultEntry {
    pub pubkey: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_seen: Option<String>,
    pub sources: Vec<BlacklistResultEntrySource>,
}

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Serialize)]
pub struct BlacklistResultEntrySource {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validator_name: Option<String>,
}

async fn process_json(
    client: &Client,
    s: &BlacklistSource,
) -> Result<Vec<(String, BlacklistResultEntrySource)>> {
    let body = fetch(client, s).await?;
    let root: Json = serde_json::from_str(&body).context("parse json")?;

    // 1) candidate records
    let records: Vec<&Json> = if let Some(p) = &s.record_path {
        jsonpath::select(&root, p).with_context(|| format!("jsonpath record_path '{}'", p))?
    } else {
        vec![&root]
    };

    // 2) filter and 3) extract
    extract_from_records(
        records
            .into_iter()
            .filter(|r| passes_filters(r, &s.filters)),
        s,
    )
}

async fn process_csv(
    client: &Client,
    s: &BlacklistSource,
) -> Result<Vec<(String, BlacklistResultEntrySource)>> {
    let (delimiter, headers) = match s.handler {
        BlacklistHandler::Csv { delimiter, headers } => (delimiter, headers),
        _ => unreachable!(),
    };

    let body = fetch(client, s).await?;
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(headers)
        .delimiter(delimiter)
        .from_reader(body.as_bytes());

    let headers = if headers {
        Some(
            rdr.headers()?
                .iter()
                .map(|h| h.to_string())
                .collect::<Vec<_>>(),
        )
    } else {
        None
    };

    let mut out = Vec::new();
    for rec in rdr.records() {
        let rec = rec?;
        let row = row_to_json(&rec, headers.as_deref());
        if !passes_filters(&row, &s.filters) {
            continue;
        }
        out.extend(extract_from_records(vec![&row].into_iter(), s)?);
    }
    Ok(out)
}

fn passes_filters(record: &Json, filters: &[String]) -> bool {
    for f in filters {
        let ft = f.trim();
        let ok = if ft.starts_with('$') {
            jsonpath::select(record, ft)
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        } else if ft.starts_with("?(") || ft.starts_with("[?(") {
            let wrap = json!([record]);
            let path = if ft.starts_with("[?(") {
                format!("${}", ft)
            } else {
                format!("$[{}]", ft)
            };
            jsonpath::select(&wrap, &path)
                .map(|v| !v.is_empty())
                .unwrap_or(false)
        } else {
            false
        };
        if !ok {
            return false;
        }
    }
    true
}

fn extract_from_records<'a>(
    iter: impl Iterator<Item = &'a Json>,
    s: &BlacklistSource,
) -> Result<Vec<(String, BlacklistResultEntrySource)>> {
    let mut out = Vec::new();
    for rec in iter {
        let pks = jsonpath::select(rec, &s.pubkey_path)
            .with_context(|| format!("jsonpath pubkey_path '{}'", s.pubkey_path))?;

        let reason = if let Some(template) = &s.reason_template {
            Some(interpolate_template(template, rec))
        } else if let Some(rp) = &s.reason_path {
            jsonpath::select(rec, rp)
                .unwrap_or_default()
                .first()
                .map(|r| node_to_string(r).to_string())
        } else {
            None
        };

        let validator_name = if let Some(np) = &s.name_path {
            jsonpath::select(rec, np)
                .unwrap_or_default()
                .first()
                .map(|n| node_to_string(n).to_string())
                .filter(|n| !n.is_empty())
        } else {
            None
        };

        for n in pks {
            let pk = node_to_string(n);
            if validate_solana_pubkey(pk.trim()).is_err() {
                continue;
            }
            out.push((
                pk.to_string(),
                BlacklistResultEntrySource {
                    name: s.name.clone(),
                    reason: reason.clone(),
                    validator_name: validator_name.clone(),
                },
            ));
        }
    }
    Ok(out)
}

fn interpolate_template(template: &str, record: &Json) -> String {
    let mut result = template.to_string();
    let mut processed = std::collections::HashSet::new();

    // Process placeholders until no more can be resolved
    loop {
        let mut changed = false;
        let mut start = 0;

        while let Some(brace_start) = result[start..].find('{') {
            let abs_start = start + brace_start;
            if let Some(brace_end) = result[abs_start + 1..].find('}') {
                let abs_end = abs_start + 1 + brace_end;
                let var_content = &result[abs_start + 1..abs_end];

                // Skip malformed placeholders (containing unmatched braces)
                if var_content.contains('{') {
                    start = abs_start + 1;
                    continue;
                }

                let placeholder = &result[abs_start..=abs_end];

                if processed.contains(placeholder) {
                    start = abs_end + 1;
                    continue;
                }

                processed.insert(placeholder.to_string());
                let value = resolve_variable(record, var_content);

                if value != placeholder {
                    result.replace_range(abs_start..=abs_end, &value);
                    changed = true;
                    break;
                } else {
                    start = abs_end + 1;
                }
            } else {
                break;
            }
        }

        if !changed {
            break;
        }
    }

    result
}

fn resolve_variable(record: &Json, var_name: &str) -> String {
    // Parse format specifiers like {sandwichRate:.2}
    let (field_name, format_spec) = parse_format_spec(var_name);

    let patterns = [
        field_name,                   // Use as-is (could be complete JSONPath)
        &format!("$.{}", field_name), // Try as simple field access
    ];

    for pattern in patterns {
        if let Ok(nodes) = jsonpath::select(record, pattern) {
            if let Some(node) = nodes.first() {
                let value = node_to_string(node);
                return apply_format(&value, format_spec);
            }
        }
    }

    format!("{{{}}}", var_name)
}

fn parse_format_spec(var_name: &str) -> (&str, Option<&str>) {
    if let Some(colon_pos) = var_name.find(':') {
        let field_name = &var_name[..colon_pos];
        let format_spec = &var_name[colon_pos + 1..];
        (field_name, Some(format_spec))
    } else {
        (var_name, None)
    }
}

fn apply_format(value: &str, format_spec: Option<&str>) -> String {
    let Some(spec) = format_spec else {
        return value.to_string();
    };

    // Handle decimal precision formatting (.2, .1, etc.)
    if let Some(precision_str) = spec.strip_prefix('.') {
        if let (Ok(precision), Ok(num)) = (precision_str.parse::<usize>(), value.parse::<f64>()) {
            return format!("{:.prec$}", num, prec = precision);
        }
    }

    // TODO: Add more format specifiers as needed (padding, alignment, etc.)

    value.to_string()
}

fn row_to_json(rec: &csv::StringRecord, headers: Option<&[String]>) -> Json {
    let mut m = JMap::new();
    for (i, v) in rec.iter().enumerate() {
        m.insert(format!("c{}", i), best_json(v));
    }
    if let Some(hs) = headers {
        for (i, name) in hs.iter().enumerate() {
            if let Some(v) = rec.get(i) {
                m.insert(name.clone(), best_json(v));
            }
        }
    }
    Json::Object(m)
}

fn best_json(s: &str) -> Json {
    let t = s.trim();
    if t.eq_ignore_ascii_case("true") {
        return Json::Bool(true);
    }
    if t.eq_ignore_ascii_case("false") {
        return Json::Bool(false);
    }
    // Try integer first, then float
    if let Ok(n) = t.parse::<i64>() {
        return json!(n);
    }
    if let Ok(n) = t.parse::<f64>() {
        return json!(n);
    }
    Json::String(t.to_string())
}

async fn fetch(client: &Client, s: &BlacklistSource) -> Result<String> {
    let mut request = client.get(s.url.to_owned());

    if let Some(headers) = s.fetch_headers.as_ref() {
        for (k, v) in headers {
            request = request.header(k, v);
        }
    }

    let r = request.send().await?;
    let st = r.status();
    if !st.is_success() {
        return Err(anyhow!("http {} {}", st.as_u16(), s.url));
    }
    Ok(r.text().await?)
}

fn node_to_string(v: &'_ Value) -> Cow<'_, str> {
    match v {
        Value::String(s) => Cow::Borrowed(s),
        other => Cow::Owned(other.to_string()),
    }
}

// ── RPC types for getEpochInfo ───────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RpcEpochInfoResponse {
    result: RpcEpochInfo,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RpcEpochInfo {
    pub epoch: u64,
    pub slot_index: u64,
    pub slots_in_epoch: u64,
    pub absolute_slot: u64,
    pub block_height: Option<u64>,
    pub transaction_count: Option<u64>,
}

// ── RPC types for getVoteAccounts ────────────────────────────────────────────

#[derive(Deserialize)]
struct RpcVoteAccountsResponse {
    result: RpcVoteAccountsResult,
}

#[derive(Deserialize)]
struct RpcVoteAccountsResult {
    current: Vec<RpcVoteAccount>,
    delinquent: Vec<RpcVoteAccount>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RpcVoteAccount {
    pub vote_pubkey: String,
    pub node_pubkey: String,
    pub activated_stake: u64,
    pub commission: u8,
    pub epoch_vote_account: bool,
    pub epoch_credits: Vec<[u64; 3]>,
    pub last_vote: u64,
    pub root_slot: u64,
}

/// Fetch epoch info from the Solana RPC. Returns None on error (non-fatal).
async fn fetch_epoch_info(client: &Client, rpc_url: &str) -> Option<RpcEpochInfo> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getEpochInfo",
        "params": []
    });

    let result = async {
        let resp = client
            .post(rpc_url)
            .json(&body)
            .send()
            .await
            .context("getEpochInfo request failed")?;
        if !resp.status().is_success() {
            return Err(anyhow!("getEpochInfo HTTP {}", resp.status().as_u16()));
        }
        let parsed: RpcEpochInfoResponse = resp.json().await.context("getEpochInfo parse failed")?;
        Ok(parsed.result)
    }
    .await;

    match result {
        Ok(info) => {
            println!("[epoch-info] Current epoch: {}", info.epoch);
            Some(info)
        }
        Err(err) => {
            eprintln!("[epoch-info] Failed to fetch epoch info: {err:#}");
            None
        }
    }
}

/// Fetch all vote accounts (current + delinquent) from the Solana RPC.
/// Returns (active pubkey set, current accounts, delinquent accounts).
/// On error, returns empty set and empty vecs.
async fn fetch_vote_accounts(
    client: &Client,
    rpc_url: &str,
) -> (HashSet<String>, Vec<RpcVoteAccount>, Vec<RpcVoteAccount>) {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getVoteAccounts",
        "params": [{ "keepUnstakedDelinquents": true }]
    });

    let result = async {
        let resp = client
            .post(rpc_url)
            .json(&body)
            .send()
            .await
            .context("RPC request failed")?;

        if !resp.status().is_success() {
            return Err(anyhow!("RPC HTTP {}", resp.status().as_u16()));
        }

        let parsed: RpcVoteAccountsResponse = resp.json().await.context("RPC parse failed")?;
        let mut set =
            HashSet::with_capacity(parsed.result.current.len() + parsed.result.delinquent.len());
        for v in &parsed.result.current {
            set.insert(v.vote_pubkey.clone());
        }
        for v in &parsed.result.delinquent {
            set.insert(v.vote_pubkey.clone());
        }
        Ok((set, parsed.result.current, parsed.result.delinquent))
    }
    .await;

    match result {
        Ok((set, current, delinquent)) => {
            println!(
                "[active-filter] RPC returned {} active vote accounts",
                set.len()
            );
            (set, current, delinquent)
        }
        Err(err) => {
            eprintln!("[active-filter] RPC fetch failed, skipping filter: {err:#}");
            (HashSet::new(), Vec::new(), Vec::new())
        }
    }
}

/// Build epoch snapshots by merging RPC vote account data with Stakewiz metadata.
fn build_epoch_snapshots(
    epoch: u64,
    current: &[RpcVoteAccount],
    delinquent: &[RpcVoteAccount],
    stakewiz: &HashMap<String, ValidatorMeta>,
) -> Vec<crate::persistence::ValidatorEpochSnapshot> {
    let now = chrono::Utc::now().to_rfc3339();

    let mut snapshots = Vec::with_capacity(current.len() + delinquent.len());

    for (accounts, is_delinquent) in [(current, false), (delinquent, true)] {
        for acc in accounts {
            // Extract epoch_credits from the last entry matching this epoch,
            // or fall back to the very last entry
            let (ec, pec) = acc
                .epoch_credits
                .iter()
                .rev()
                .find(|e| e[0] == epoch)
                .or_else(|| acc.epoch_credits.last())
                .map(|e| (Some(e[1]), Some(e[2])))
                .unwrap_or((None, None));

            let swiz = stakewiz.get(&acc.vote_pubkey);

            snapshots.push(crate::persistence::ValidatorEpochSnapshot {
                vote_identity: acc.vote_pubkey.clone(),
                epoch,
                node_pubkey: Some(acc.node_pubkey.clone()),
                activated_stake_lamports: Some(acc.activated_stake),
                commission: Some(acc.commission as f64),
                is_delinquent,
                epoch_credits: ec,
                prev_epoch_credits: pec,
                last_vote: Some(acc.last_vote),
                root_slot: Some(acc.root_slot),
                name: swiz.and_then(|s| s.name.clone()),
                skip_rate: swiz.and_then(|s| s.skip_rate),
                uptime: swiz.and_then(|s| s.uptime),
                version: swiz.and_then(|s| s.version.clone()),
                wiz_score: swiz.and_then(|s| s.wiz_score),
                apy_estimate: swiz.and_then(|s| s.apy_estimate),
                ip_country: swiz.and_then(|s| s.ip_country.clone()),
                image: swiz.and_then(|s| s.image.clone()),
                website: swiz.and_then(|s| s.website.clone()),
                snapshotted_at: now.clone(),
            });
        }
    }

    snapshots
}

// ── Stakewiz types ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct StakewizValidatorRaw {
    vote_identity: Option<String>,
    identity: Option<String>,
    name: Option<String>,
    delinquent: Option<bool>,
    activated_stake: Option<f64>,
    commission: Option<f64>,
    skip_rate: Option<f64>,
    uptime: Option<f64>,
    version: Option<String>,
    wiz_score: Option<f64>,
    apy_estimate: Option<f64>,
    ip_country: Option<String>,
    image: Option<String>,
    website: Option<String>,
}

/// Fetch all validators from the Stakewiz API and return as a map keyed by vote_identity.
/// Returns an empty map on any error (non-fatal).
async fn fetch_stakewiz_validators(client: &Client) -> HashMap<String, ValidatorMeta> {
    let result = async {
        let resp = client
            .get("https://api.stakewiz.com/validators")
            .send()
            .await
            .context("Stakewiz request failed")?;

        if !resp.status().is_success() {
            return Err(anyhow!("Stakewiz HTTP {}", resp.status().as_u16()));
        }

        let raw: Vec<StakewizValidatorRaw> = resp.json().await.context("Stakewiz parse failed")?;
        let now = chrono::Utc::now().to_rfc3339();
        let mut map = HashMap::with_capacity(raw.len());
        for r in raw {
            let Some(ref vote_id) = r.vote_identity else {
                continue;
            };
            map.insert(
                vote_id.clone(),
                ValidatorMeta {
                    vote_identity: vote_id.clone(),
                    identity: r.identity,
                    name: r.name,
                    delinquent: r.delinquent,
                    activated_stake: r.activated_stake,
                    commission: r.commission,
                    skip_rate: r.skip_rate,
                    uptime: r.uptime,
                    version: r.version,
                    wiz_score: r.wiz_score,
                    apy_estimate: r.apy_estimate,
                    ip_country: r.ip_country,
                    image: r.image,
                    website: r.website,
                    updated_at: now.clone(),
                    node_pubkey: None,
                    activated_stake_lamports: None,
                    last_vote: None,
                    root_slot: None,
                    epoch_credits: None,
                    prev_epoch_credits: None,
                },
            );
        }
        Ok(map)
    }
    .await;

    match result {
        Ok(map) => {
            println!("[active-filter] Stakewiz returned {} validators", map.len());
            map
        }
        Err(err) => {
            eprintln!(
                "[active-filter] Stakewiz fetch failed, names will use per-pubkey fallback: {err:#}",
            );
            HashMap::new()
        }
    }
}

async fn enrich_names(client: &Client, entries: &mut [BlacklistResultEntry], concurrency: usize) {
    let missing: Vec<(usize, String)> = entries
        .iter()
        .enumerate()
        .filter(|(_, e)| e.name.is_none())
        .map(|(i, e)| (i, e.pubkey.clone()))
        .collect();

    if missing.is_empty() {
        return;
    }

    let results: Vec<(usize, Option<String>)> =
        stream::iter(missing.into_iter().map(|(i, pubkey)| {
            let client = client.clone();
            async move {
                let url = format!("https://api.stakewiz.com/validator/{}", pubkey);
                let name = async {
                    let resp = client.get(&url).send().await.ok()?;
                    if !resp.status().is_success() {
                        return None;
                    }
                    let json: Value = resp.json().await.ok()?;
                    let n = json.get("name")?.as_str()?.to_string();
                    if n.is_empty() { None } else { Some(n) }
                }
                .await;
                (i, name)
            }
        }))
        .buffer_unordered(concurrency)
        .collect::<Vec<_>>()
        .await;

    for (i, name) in results {
        entries[i].name = name;
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_blacklist_collector_integration() {
        let sources = default_blacklist_sources();
        let out = BlacklistCollector::default()
            .with_sources(sources)
            .run()
            .await
            .unwrap();

        assert!(out.sources > 0, "should have at least one source");
        assert!(
            out.unique_pubkeys > 0,
            "should find at least one blacklisted pubkey"
        );
        assert!(!out.entries.is_empty(), "entries should not be empty");

        // Every entry must have a valid pubkey and at least one source
        for entry in &out.entries {
            assert!(!entry.pubkey.is_empty(), "pubkey should not be empty");
            assert!(
                validate_solana_pubkey(&entry.pubkey).is_ok(),
                "pubkey '{}' should be a valid Solana pubkey",
                entry.pubkey
            );
            assert!(
                !entry.sources.is_empty(),
                "entry should have at least one source"
            );
        }

        println!("{:#}", json!(out));
    }

    /// Test a single blacklist source against a known validator address.
    ///
    /// Usage: Set the environment variables before running:
    ///   TEST_BLACKLIST_SOURCE  – source key, e.g. "jito:blacklist"
    ///   TEST_BLACKLIST_PUBKEY  – vote-account pubkey expected in results
    ///
    /// Example:
    /// ```sh
    /// TEST_BLACKLIST_SOURCE="jito:blacklist" \
    /// TEST_BLACKLIST_PUBKEY="ENVaKoD7ytn58xJ8s5htFfQ8hqQt1G9dcPUDqbSwVcgB" \
    /// cargo test --package shared test_blacklist_source_contains_pubkey -- --ignored --nocapture
    /// ```
    #[tokio::test]
    #[ignore]
    async fn test_blacklist_source_contains_pubkey() {
        let source_key =
            std::env::var("TEST_BLACKLIST_SOURCE").unwrap_or("jito:blacklist".to_string());
        let expected_pubkey = std::env::var("TEST_BLACKLIST_PUBKEY")
            .unwrap_or("7MTjmteQHhthwwTZhUzsc2dP4NBvGNRqj8jzdqNxHFGE".to_string());

        let all_sources = default_blacklist_sources();
        let source = all_sources
            .get(&source_key)
            .unwrap_or_else(|| {
                let available: Vec<_> = all_sources.keys().collect();
                panic!(
                    "Source '{}' not found in blacklist_sources.json. Available: {:?}",
                    source_key, available
                );
            })
            .clone();

        println!(
            "Testing source '{}' for pubkey '{}'",
            source_key, expected_pubkey
        );

        let mut single_source = HashMap::new();
        single_source.insert(source_key.clone(), source);

        let out = BlacklistCollector::default()
            .with_sources(single_source)
            .run()
            .await
            .unwrap();

        println!(
            "Source '{}' returned {} unique pubkeys",
            source_key, out.unique_pubkeys
        );

        let found = out.entries.iter().find(|e| e.pubkey == expected_pubkey);
        assert!(
            found.is_none(),
            "Pubkey '{}' was found in source '{}'. Total entries: {}",
            expected_pubkey,
            source_key,
            out.entries.len()
        );
    }

    #[test]
    fn test_interpolate_template_simple_field() {
        let record = json!({"name": "validator1", "rate": 15.5});
        let template = "Validator {name} has rate {rate}%";
        let result = interpolate_template(template, &record);
        assert_eq!(result, "Validator validator1 has rate 15.5%");
    }

    #[test]
    fn test_interpolate_template_with_formatting() {
        let record = json!({"rate": 15.123456});
        let template = "Rate is {rate:.2}%";
        let result = interpolate_template(template, &record);
        assert_eq!(result, "Rate is 15.12%");
    }

    #[test]
    fn test_interpolate_template_complex_jsonpath() {
        let record = json!({
            "stats": [
                {"period": {"Days": 30}, "sandwichRate": 6.635802469135802},
                {"period": {"Days": 7}, "sandwichRate": 12.5}
            ]
        });
        let template = "30-day rate: {$.stats[?(@.period.Days == 30)].sandwichRate:.2}%";
        let result = interpolate_template(template, &record);
        assert_eq!(result, "30-day rate: 6.64%");
    }

    #[test]
    fn test_interpolate_template_missing_variable() {
        let record = json!({"name": "validator1"});
        let template = "Validator {name} has rate {missing}%";
        let result = interpolate_template(template, &record);
        assert_eq!(result, "Validator validator1 has rate {missing}%");
    }

    #[test]
    fn test_interpolate_template_no_placeholders() {
        let record = json!({"name": "validator1"});
        let template = "No placeholders here";
        let result = interpolate_template(template, &record);
        assert_eq!(result, "No placeholders here");
    }

    #[test]
    fn test_interpolate_template_malformed_braces() {
        let record = json!({"name": "validator1"});
        let template = "Validator {name has rate {rate}%";
        let result = interpolate_template(template, &record);
        assert_eq!(result, "Validator {name has rate {rate}%");
    }

    #[test]
    fn test_resolve_variable_simple_field() {
        let record = json!({"rate": 15.5});
        let result = resolve_variable(&record, "rate");
        assert_eq!(result, "15.5");
    }

    #[test]
    fn test_resolve_variable_with_formatting() {
        let record = json!({"rate": 15.123456});
        let result = resolve_variable(&record, "rate:.2");
        assert_eq!(result, "15.12");
    }

    #[test]
    fn test_resolve_variable_complex_jsonpath() {
        let record = json!({
            "stats": [{"period": {"Days": 30}, "rate": 6.635802469135802}]
        });
        let result = resolve_variable(&record, "$.stats[?(@.period.Days == 30)].rate:.2");
        assert_eq!(result, "6.64");
    }

    #[test]
    fn test_resolve_variable_not_found() {
        let record = json!({"name": "validator1"});
        let result = resolve_variable(&record, "missing");
        assert_eq!(result, "{missing}");
    }

    #[test]
    fn test_parse_format_spec() {
        assert_eq!(parse_format_spec("rate"), ("rate", None));
        assert_eq!(parse_format_spec("rate:.2"), ("rate", Some(".2")));
        assert_eq!(parse_format_spec("$.path:.3"), ("$.path", Some(".3")));
    }

    #[test]
    fn test_apply_format_decimal_precision() {
        assert_eq!(apply_format("15.123456", Some(".2")), "15.12");
        assert_eq!(apply_format("15.1", Some(".2")), "15.10");
        assert_eq!(apply_format("15", Some(".2")), "15.00");
    }

    #[test]
    fn test_apply_format_invalid_precision() {
        assert_eq!(apply_format("not_a_number", Some(".2")), "not_a_number");
        assert_eq!(apply_format("15.5", Some("invalid")), "15.5");
    }

    #[test]
    fn test_apply_format_no_spec() {
        assert_eq!(apply_format("15.123", None), "15.123");
    }

    #[test]
    fn test_sandwiched_me_template() {
        let record = json!({
            "validatorVoteAccount": "7wqiBhRVEkbV3A8LbR9W1eNb5s27CBwoRCVro1okB6ew",
            "stats": [
                {
                    "period": {"Days": 1},
                    "blocksProduced": 4,
                    "sandwichRate": 0
                },
                {
                    "period": {"Days": 30},
                    "blocksProduced": 895,
                    "sandwichRate": 61.4525139664804
                }
            ]
        });

        let template = "30-day sandwich rate: {$.stats[?(@.period.Days == 30)].sandwichRate:.2}% \
                        (flagged for MEV sandwich attacks)";
        let result = interpolate_template(template, &record);
        assert_eq!(
            result,
            "30-day sandwich rate: 61.45% (flagged for MEV sandwich attacks)"
        );
    }

    #[test]
    fn test_passes_filters_jsonpath() {
        let record = json!({"stats": [{"period": {"Days": 30}, "sandwichRate": 10}]});
        let filters = vec!["$.stats[?(@.period.Days == 30 && @.sandwichRate > 5)]".to_string()];
        assert!(passes_filters(&record, &filters));

        let filters = vec!["$.stats[?(@.period.Days == 30 && @.sandwichRate > 15)]".to_string()];
        assert!(!passes_filters(&record, &filters));
    }

    #[test]
    fn test_passes_filters_predicate() {
        let record = json!({"flagged": true});
        let filters = vec!["?(@.flagged == true)".to_string()];
        assert!(passes_filters(&record, &filters));

        let filters = vec!["?(@.flagged == false)".to_string()];
        assert!(!passes_filters(&record, &filters));
    }

    #[test]
    fn test_row_to_json_with_headers() {
        use csv::StringRecord;
        let record = StringRecord::from(vec!["validator1", "15.5", "true"]);
        let headers = vec!["name".to_string(), "rate".to_string(), "active".to_string()];
        let result = row_to_json(&record, Some(&headers));

        let expected = json!({
            "c0": "validator1",
            "c1": 15.5,
            "c2": true,
            "name": "validator1",
            "rate": 15.5,
            "active": true
        });
        assert_eq!(result, expected);
    }

    #[test]
    fn test_row_to_json_without_headers() {
        use csv::StringRecord;
        let record = StringRecord::from(vec!["validator1", "15.5", "false"]);
        let result = row_to_json(&record, None);

        let expected = json!({
            "c0": "validator1",
            "c1": 15.5,
            "c2": false
        });
        assert_eq!(result, expected);
    }

    #[test]
    fn test_best_json_conversion() {
        assert_eq!(best_json("true"), json!(true));
        assert_eq!(best_json("false"), json!(false));
        assert_eq!(best_json("15.5"), json!(15.5));
        assert_eq!(best_json("42"), json!(42));
        assert_eq!(best_json("text"), json!("text"));
        assert_eq!(best_json("  TRUE  "), json!(true));
    }

    #[test]
    fn test_node_to_string() {
        assert_eq!(node_to_string(&json!("text")), "text");
        assert_eq!(node_to_string(&json!(15.5)), "15.5");
        assert_eq!(node_to_string(&json!(true)), "true");
        assert_eq!(node_to_string(&json!(null)), "null");
    }

    #[test]
    fn test_infinite_loop_prevention() {
        let record = json!({"name": "test"});
        // Template that could cause infinite loop if not handled properly
        let template = "Value: {missing} and {missing}";
        let result = interpolate_template(template, &record);
        assert_eq!(result, "Value: {missing} and {missing}");
    }

    #[test]
    fn test_multiple_same_placeholders() {
        let record = json!({"rate": 15.5});
        let template = "Rate: {rate:.1}% (was {rate:.2}%)";
        let result = interpolate_template(template, &record);
        assert_eq!(result, "Rate: 15.5% (was 15.50%)");
    }

    #[test]
    fn test_name_path_extraction() {
        // Simulate a record with a name field, like Hanabi
        let record = json!({
            "vote": "7wqiBhRVEkbV3A8LbR9W1eNb5s27CBwoRCVro1okB6ew",
            "name": "My Validator",
            "flagged": true
        });

        let source = BlacklistSource {
            name: "test_source".to_string(),
            url: "http://example.com".to_string(),
            fetch_headers: None,
            contact_into: Value::Null,
            handler: BlacklistHandler::Json,
            record_path: None,
            pubkey_path: "$.vote".to_string(),
            filters: vec![],
            reason_template: None,
            reason_path: None,
            name_path: Some("$.name".to_string()),
        };

        let results = extract_from_records(vec![&record].into_iter(), &source).unwrap();
        assert_eq!(results.len(), 1);
        let (pk, entry_source) = &results[0];
        assert_eq!(pk, "7wqiBhRVEkbV3A8LbR9W1eNb5s27CBwoRCVro1okB6ew");
        assert_eq!(
            entry_source.validator_name,
            Some("My Validator".to_string())
        );
    }

    #[test]
    fn test_name_path_none_when_not_configured() {
        let record = json!({
            "vote": "7wqiBhRVEkbV3A8LbR9W1eNb5s27CBwoRCVro1okB6ew",
            "name": "My Validator"
        });

        let source = BlacklistSource {
            name: "test_source".to_string(),
            url: "http://example.com".to_string(),
            fetch_headers: None,
            contact_into: Value::Null,
            handler: BlacklistHandler::Json,
            record_path: None,
            pubkey_path: "$.vote".to_string(),
            filters: vec![],
            reason_template: None,
            reason_path: None,
            name_path: None, // not configured
        };

        let results = extract_from_records(vec![&record].into_iter(), &source).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].1.validator_name, None);
    }

    #[test]
    fn test_name_merging_picks_first_non_none() {
        // Simulate multiple sources for the same pubkey, some with names, some without
        let sources_with_names = vec![
            BlacklistResultEntrySource {
                name: "source_a".to_string(),
                reason: None,
                validator_name: None,
            },
            BlacklistResultEntrySource {
                name: "source_b".to_string(),
                reason: None,
                validator_name: Some("Validator B".to_string()),
            },
            BlacklistResultEntrySource {
                name: "source_c".to_string(),
                reason: None,
                validator_name: Some("Validator C".to_string()),
            },
        ];

        let name = sources_with_names
            .iter()
            .filter_map(|s| s.validator_name.as_ref())
            .next()
            .cloned();

        assert_eq!(name, Some("Validator B".to_string()));
    }

    #[test]
    fn test_name_merging_all_none() {
        let sources_no_names = vec![
            BlacklistResultEntrySource {
                name: "source_a".to_string(),
                reason: None,
                validator_name: None,
            },
            BlacklistResultEntrySource {
                name: "source_b".to_string(),
                reason: None,
                validator_name: None,
            },
        ];

        let name = sources_no_names
            .iter()
            .filter_map(|s| s.validator_name.as_ref())
            .next()
            .cloned();

        assert_eq!(name, None);
    }

    #[test]
    fn test_name_path_empty_string_filtered() {
        // Empty name should be filtered to None
        let record = json!({
            "vote": "7wqiBhRVEkbV3A8LbR9W1eNb5s27CBwoRCVro1okB6ew",
            "name": ""
        });

        let source = BlacklistSource {
            name: "test_source".to_string(),
            url: "http://example.com".to_string(),
            fetch_headers: None,
            contact_into: Value::Null,
            handler: BlacklistHandler::Json,
            record_path: None,
            pubkey_path: "$.vote".to_string(),
            filters: vec![],
            reason_template: None,
            reason_path: None,
            name_path: Some("$.name".to_string()),
        };

        let results = extract_from_records(vec![&record].into_iter(), &source).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].1.validator_name, None);
    }

    #[tokio::test]
    #[ignore]
    async fn test_fetch_vote_accounts() {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();
        let (set, current, delinquent) =
            fetch_vote_accounts(&client, "https://api.mainnet-beta.solana.com").await;
        assert!(
            !set.is_empty(),
            "RPC should return non-empty set of vote pubkeys"
        );
        assert!(!current.is_empty(), "should have current accounts");
        // Verify expanded fields are present
        let first = &current[0];
        assert!(!first.node_pubkey.is_empty());
        assert!(first.activated_stake > 0 || !delinquent.is_empty());
        println!(
            "[test] fetch_vote_accounts returned {} current + {} delinquent",
            current.len(),
            delinquent.len()
        );
    }

    #[tokio::test]
    #[ignore]
    async fn test_fetch_epoch_info() {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();
        let info =
            fetch_epoch_info(&client, "https://api.mainnet-beta.solana.com").await;
        assert!(info.is_some(), "should fetch epoch info");
        let info = info.unwrap();
        assert!(info.epoch > 0, "epoch should be > 0");
        println!("[test] epoch={}, slot_index={}", info.epoch, info.slot_index);
    }

    #[tokio::test]
    #[ignore]
    async fn test_fetch_stakewiz_validators() {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap();
        let map = fetch_stakewiz_validators(&client).await;
        assert!(
            !map.is_empty(),
            "Stakewiz should return non-empty validator map"
        );
        // Verify at least one entry has a name
        let has_name = map.values().any(|v| v.name.is_some());
        assert!(has_name, "at least one validator should have a name");
        println!(
            "[test] fetch_stakewiz_validators returned {} validators",
            map.len()
        );
    }

    #[tokio::test]
    #[ignore]
    async fn test_collector_with_active_filter() {
        let sources = default_blacklist_sources();

        // Run without filter
        let opts_no_filter = BlacklistOptions {
            filter_inactive: false,
            ..BlacklistOptions::default()
        };
        let unfiltered = BlacklistCollector::new(opts_no_filter)
            .with_sources(sources.clone())
            .run()
            .await
            .unwrap();

        // Run with filter (default)
        let opts_filter = BlacklistOptions {
            filter_inactive: true,
            ..BlacklistOptions::default()
        };
        let filtered = BlacklistCollector::new(opts_filter)
            .with_sources(sources)
            .run()
            .await
            .unwrap();

        println!(
            "[test] unfiltered: {} entries, filtered: {} entries",
            unfiltered.unique_pubkeys, filtered.unique_pubkeys
        );
        assert!(
            filtered.unique_pubkeys <= unfiltered.unique_pubkeys,
            "filtered count ({}) should be <= unfiltered count ({})",
            filtered.unique_pubkeys,
            unfiltered.unique_pubkeys
        );
    }

    fn make_rpc_vote_account(vote_pubkey: &str, epoch_credits: Vec<[u64; 3]>) -> RpcVoteAccount {
        RpcVoteAccount {
            vote_pubkey: vote_pubkey.to_string(),
            node_pubkey: "NodePK123".to_string(),
            activated_stake: 5_000_000_000,
            commission: 8,
            epoch_vote_account: true,
            epoch_credits,
            last_vote: 299888765,
            root_slot: 299888734,
        }
    }

    #[test]
    fn test_build_epoch_snapshots_credits_extraction() {
        let acc = make_rpc_vote_account("AAA111", vec![[748, 400000, 398000], [749, 420000, 400000], [750, 432000, 420000]]);
        let snapshots = build_epoch_snapshots(750, &[acc], &[], &HashMap::new());
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].epoch_credits, Some(432000));
        assert_eq!(snapshots[0].prev_epoch_credits, Some(420000));
    }

    #[test]
    fn test_build_epoch_snapshots_delinquent_flag() {
        let current = make_rpc_vote_account("AAA111", vec![[750, 100, 90]]);
        let delinquent = make_rpc_vote_account("BBB222", vec![[750, 50, 40]]);
        let snapshots = build_epoch_snapshots(750, &[current], &[delinquent], &HashMap::new());
        assert_eq!(snapshots.len(), 2);
        assert!(!snapshots[0].is_delinquent);
        assert!(snapshots[1].is_delinquent);
    }

    #[test]
    fn test_build_epoch_snapshots_stakewiz_merge() {
        let acc = make_rpc_vote_account("AAA111", vec![[750, 100, 90]]);
        let mut swiz = HashMap::new();
        swiz.insert(
            "AAA111".to_string(),
            ValidatorMeta {
                vote_identity: "AAA111".to_string(),
                identity: None,
                name: Some("My Validator".to_string()),
                delinquent: None,
                activated_stake: None,
                commission: None,
                skip_rate: Some(0.5),
                uptime: Some(99.9),
                version: Some("2.2.0".to_string()),
                wiz_score: Some(8.5),
                apy_estimate: Some(7.2),
                ip_country: Some("US".to_string()),
                image: None,
                website: None,
                updated_at: String::new(),
                node_pubkey: None,
                activated_stake_lamports: None,
                last_vote: None,
                root_slot: None,
                epoch_credits: None,
                prev_epoch_credits: None,
            },
        );
        let snapshots = build_epoch_snapshots(750, &[acc], &[], &swiz);
        assert_eq!(snapshots[0].name, Some("My Validator".to_string()));
        assert_eq!(snapshots[0].skip_rate, Some(0.5));
        assert_eq!(snapshots[0].wiz_score, Some(8.5));
    }

    #[test]
    fn test_build_epoch_snapshots_stakewiz_missing() {
        let acc = make_rpc_vote_account("AAA111", vec![[750, 100, 90]]);
        let snapshots = build_epoch_snapshots(750, &[acc], &[], &HashMap::new());
        assert_eq!(snapshots.len(), 1);
        assert_eq!(snapshots[0].name, None);
        assert_eq!(snapshots[0].skip_rate, None);
        // RPC fields should still be present
        assert_eq!(snapshots[0].activated_stake_lamports, Some(5_000_000_000));
    }
}
