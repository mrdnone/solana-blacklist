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
    collections::{BTreeMap, BTreeSet, HashMap},
    time::Duration,
};

use anyhow::{anyhow, Context, Result};
use futures::stream::{self, StreamExt};
use jsonpath_lib as jsonpath;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map as JMap, Value as Json, Value};

use crate::utils::validate_solana_pubkey;

pub const BLACKLIST_SOURCES_JSON: &str = include_str!("blacklist_sources.json");

pub fn default_blacklist_sources() -> BlacklistSources {
    serde_json::from_str::<BlacklistSources>(BLACKLIST_SOURCES_JSON)
        .expect("Failed to load blacklist sources")
}

pub type BlacklistSources = HashMap<String, BlacklistSource>;

#[derive(Default)]
pub struct BlacklistCollector {
    opts: BlacklistOptions,
    sources: BlacklistSources,
}

impl BlacklistCollector {
    pub fn new(opts: BlacklistOptions) -> Self {
        Self { opts, sources: Default::default() }
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
        let entries = map
            .into_iter()
            .map(|(k, v)| BlacklistResultEntry { pubkey: k, sources: v.into_iter().collect() })
            .collect::<Vec<_>>();

        Ok(BlacklistResult { unique_pubkeys: entries.len(), sources: self.sources.len(), entries })
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
}

#[derive(Debug, Clone)]
pub struct BlacklistOptions {
    pub concurrency: usize,
    pub timeout_secs: u64,
}

impl Default for BlacklistOptions {
    fn default() -> Self {
        Self { concurrency: 8, timeout_secs: 20 }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct BlacklistResult {
    pub unique_pubkeys: usize,
    pub sources: usize,
    pub entries: Vec<BlacklistResultEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BlacklistResultEntry {
    pub pubkey: String,
    pub sources: Vec<BlacklistResultEntrySource>,
}

#[derive(Debug, Clone, Ord, PartialOrd, Eq, PartialEq, Serialize)]
pub struct BlacklistResultEntrySource {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
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
    extract_from_records(records.into_iter().filter(|r| passes_filters(r, &s.filters)), s)
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
        Some(rdr.headers()?.iter().map(|h| h.to_string()).collect::<Vec<_>>())
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
            jsonpath::select(record, ft).map(|v| !v.is_empty()).unwrap_or(false)
        } else if ft.starts_with("?(") || ft.starts_with("[?(") {
            let wrap = json!([record]);
            let path =
                if ft.starts_with("[?(") { format!("${}", ft) } else { format!("$[{}]", ft) };
            jsonpath::select(&wrap, &path).map(|v| !v.is_empty()).unwrap_or(false)
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

        for n in pks {
            let pk = node_to_string(n);
            if validate_solana_pubkey(pk.trim()).is_err() {
                continue;
            }
            out.push((
                pk.to_string(),
                BlacklistResultEntrySource { name: s.name.clone(), reason: reason.clone() },
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_blacklist_collector_integration() {
        let sources = default_blacklist_sources();
        let out = BlacklistCollector::default().with_sources(sources).run().await.unwrap();

        assert!(out.sources > 0, "should have at least one source");
        assert!(out.unique_pubkeys > 0, "should find at least one blacklisted pubkey");
        assert!(!out.entries.is_empty(), "entries should not be empty");

        // Every entry must have a valid pubkey and at least one source
        for entry in &out.entries {
            assert!(!entry.pubkey.is_empty(), "pubkey should not be empty");
            assert!(
                validate_solana_pubkey(&entry.pubkey).is_ok(),
                "pubkey '{}' should be a valid Solana pubkey",
                entry.pubkey
            );
            assert!(!entry.sources.is_empty(), "entry should have at least one source");
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
        let source_key = std::env::var("TEST_BLACKLIST_SOURCE").unwrap_or("jito:blacklist".to_string());
        let expected_pubkey = std::env::var("TEST_BLACKLIST_PUBKEY").unwrap_or("7MTjmteQHhthwwTZhUzsc2dP4NBvGNRqj8jzdqNxHFGE".to_string());

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

        println!("Testing source '{}' for pubkey '{}'", source_key, expected_pubkey);

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
            expected_pubkey, source_key, out.entries.len()
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
        assert_eq!(result, "30-day sandwich rate: 61.45% (flagged for MEV sandwich attacks)");
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
}
