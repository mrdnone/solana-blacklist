//! SQLite persistence for first-seen dates and validator epoch snapshots.
//!
//! Each pubkey is recorded with the date it was first observed.
//! Subsequent calls to `record_seen` are idempotent — existing dates are never overwritten.

use std::collections::HashMap;
use std::path::Path;

use anyhow::{Context, Result};
use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorMeta {
    pub vote_identity: String,
    pub identity: Option<String>,
    pub name: Option<String>,
    pub delinquent: Option<bool>,
    pub activated_stake: Option<f64>,
    pub commission: Option<f64>,
    pub skip_rate: Option<f64>,
    pub uptime: Option<f64>,
    pub version: Option<String>,
    pub wiz_score: Option<f64>,
    pub apy_estimate: Option<f64>,
    pub ip_country: Option<String>,
    pub image: Option<String>,
    pub website: Option<String>,
    pub updated_at: String,
    // RPC fields
    pub node_pubkey: Option<String>,
    pub activated_stake_lamports: Option<u64>,
    pub last_vote: Option<u64>,
    pub root_slot: Option<u64>,
    pub epoch_credits: Option<u64>,
    pub prev_epoch_credits: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorEpochSnapshot {
    pub vote_identity: String,
    pub epoch: u64,
    // RPC fields
    pub node_pubkey: Option<String>,
    pub activated_stake_lamports: Option<u64>,
    pub commission: Option<f64>,
    pub is_delinquent: bool,
    pub epoch_credits: Option<u64>,
    pub prev_epoch_credits: Option<u64>,
    pub last_vote: Option<u64>,
    pub root_slot: Option<u64>,
    // Stakewiz fields
    pub name: Option<String>,
    pub skip_rate: Option<f64>,
    pub uptime: Option<f64>,
    pub version: Option<String>,
    pub wiz_score: Option<f64>,
    pub apy_estimate: Option<f64>,
    pub ip_country: Option<String>,
    pub image: Option<String>,
    pub website: Option<String>,
    // Housekeeping
    pub snapshotted_at: String,
}

#[derive(Debug, Serialize)]
pub struct EpochSummary {
    pub epoch: u64,
    pub validator_count: u64,
    pub total_stake_lamports: Option<u64>,
    pub avg_commission: Option<f64>,
    pub snapshotted_at: String,
}

pub struct FirstSeenStore {
    conn: Connection,
}

impl FirstSeenStore {
    /// Open (or create) the SQLite database at the given path.
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn =
            Connection::open(path.as_ref()).context("failed to open first_seen SQLite database")?;
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .context("failed to set WAL journal mode")?;

        // Core tables
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS first_seen (
                pubkey TEXT PRIMARY KEY,
                first_seen_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS validators (
                vote_identity   TEXT PRIMARY KEY,
                identity        TEXT,
                name            TEXT,
                delinquent      INTEGER,
                activated_stake REAL,
                commission      REAL,
                skip_rate       REAL,
                uptime          REAL,
                version         TEXT,
                wiz_score       REAL,
                apy_estimate    REAL,
                ip_country      TEXT,
                image           TEXT,
                website         TEXT,
                updated_at      TEXT NOT NULL
            );",
        )
        .context("failed to create tables")?;

        // Add RPC columns to validators (idempotent — ignore "duplicate column" errors)
        let new_columns = [
            "node_pubkey TEXT",
            "activated_stake_lamports INTEGER",
            "last_vote INTEGER",
            "root_slot INTEGER",
            "epoch_credits INTEGER",
            "prev_epoch_credits INTEGER",
        ];
        for col_def in &new_columns {
            let sql = format!("ALTER TABLE validators ADD COLUMN {col_def}");
            if let Err(e) = conn.execute_batch(&sql) {
                let msg = e.to_string();
                if !msg.contains("duplicate column") {
                    return Err(e).context(format!("failed to add column: {col_def}"));
                }
            }
        }

        // Metadata key-value table
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS metadata (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );",
        )
        .context("failed to create metadata table")?;

        // Validator epoch snapshots table
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS validator_epochs (
                vote_identity           TEXT    NOT NULL,
                epoch                   INTEGER NOT NULL,
                node_pubkey             TEXT,
                activated_stake_lamports INTEGER,
                commission              REAL,
                is_delinquent           INTEGER NOT NULL DEFAULT 0,
                epoch_credits           INTEGER,
                prev_epoch_credits      INTEGER,
                last_vote               INTEGER,
                root_slot               INTEGER,
                name                    TEXT,
                skip_rate               REAL,
                uptime                  REAL,
                version                 TEXT,
                wiz_score               REAL,
                apy_estimate            REAL,
                ip_country              TEXT,
                image                   TEXT,
                website                 TEXT,
                snapshotted_at          TEXT NOT NULL,
                PRIMARY KEY (vote_identity, epoch)
            );
            CREATE INDEX IF NOT EXISTS idx_validator_epochs_epoch
                ON validator_epochs (epoch);",
        )
        .context("failed to create validator_epochs table")?;

        Ok(Self { conn })
    }

    // ── Metadata helpers ─────────────────────────────────────────────────────

    pub fn get_last_stored_epoch(&self) -> Result<Option<u64>> {
        let mut stmt = self
            .conn
            .prepare("SELECT value FROM metadata WHERE key = 'last_stored_epoch'")?;
        let mut rows = stmt.query([])?;
        match rows.next()? {
            Some(row) => {
                let val: String = row.get(0)?;
                Ok(Some(val.parse::<u64>().context("parse last_stored_epoch")?))
            }
            None => Ok(None),
        }
    }

    pub fn set_last_stored_epoch(&self, epoch: u64) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_stored_epoch', ?1)",
            rusqlite::params![epoch.to_string()],
        )?;
        Ok(())
    }

    // ── Epoch snapshot persistence ───────────────────────────────────────────

    pub fn insert_epoch_snapshots(&self, snapshots: &[ValidatorEpochSnapshot]) -> Result<()> {
        if snapshots.is_empty() {
            return Ok(());
        }
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR IGNORE INTO validator_epochs (
                    vote_identity, epoch, node_pubkey, activated_stake_lamports,
                    commission, is_delinquent, epoch_credits, prev_epoch_credits,
                    last_vote, root_slot, name, skip_rate, uptime, version,
                    wiz_score, apy_estimate, ip_country, image, website, snapshotted_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
            )?;
            for s in snapshots {
                stmt.execute(rusqlite::params![
                    s.vote_identity,
                    s.epoch,
                    s.node_pubkey,
                    s.activated_stake_lamports,
                    s.commission,
                    s.is_delinquent as i32,
                    s.epoch_credits,
                    s.prev_epoch_credits,
                    s.last_vote,
                    s.root_slot,
                    s.name,
                    s.skip_rate,
                    s.uptime,
                    s.version,
                    s.wiz_score,
                    s.apy_estimate,
                    s.ip_country,
                    s.image,
                    s.website,
                    s.snapshotted_at,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    pub fn get_validator_epochs(&self, vote_identity: &str) -> Result<Vec<ValidatorEpochSnapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT vote_identity, epoch, node_pubkey, activated_stake_lamports,
                    commission, is_delinquent, epoch_credits, prev_epoch_credits,
                    last_vote, root_slot, name, skip_rate, uptime, version,
                    wiz_score, apy_estimate, ip_country, image, website, snapshotted_at
             FROM validator_epochs WHERE vote_identity = ?1 ORDER BY epoch DESC",
        )?;
        let rows = stmt.query_map(rusqlite::params![vote_identity], |row| {
            Ok(ValidatorEpochSnapshot {
                vote_identity: row.get(0)?,
                epoch: row.get(1)?,
                node_pubkey: row.get(2)?,
                activated_stake_lamports: row.get(3)?,
                commission: row.get(4)?,
                is_delinquent: row.get::<_, i32>(5)? != 0,
                epoch_credits: row.get(6)?,
                prev_epoch_credits: row.get(7)?,
                last_vote: row.get(8)?,
                root_slot: row.get(9)?,
                name: row.get(10)?,
                skip_rate: row.get(11)?,
                uptime: row.get(12)?,
                version: row.get(13)?,
                wiz_score: row.get(14)?,
                apy_estimate: row.get(15)?,
                ip_country: row.get(16)?,
                image: row.get(17)?,
                website: row.get(18)?,
                snapshotted_at: row.get(19)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    pub fn get_epoch_snapshots(&self, epoch: u64) -> Result<Vec<ValidatorEpochSnapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT vote_identity, epoch, node_pubkey, activated_stake_lamports,
                    commission, is_delinquent, epoch_credits, prev_epoch_credits,
                    last_vote, root_slot, name, skip_rate, uptime, version,
                    wiz_score, apy_estimate, ip_country, image, website, snapshotted_at
             FROM validator_epochs WHERE epoch = ?1 ORDER BY vote_identity",
        )?;
        let rows = stmt.query_map(rusqlite::params![epoch], |row| {
            Ok(ValidatorEpochSnapshot {
                vote_identity: row.get(0)?,
                epoch: row.get(1)?,
                node_pubkey: row.get(2)?,
                activated_stake_lamports: row.get(3)?,
                commission: row.get(4)?,
                is_delinquent: row.get::<_, i32>(5)? != 0,
                epoch_credits: row.get(6)?,
                prev_epoch_credits: row.get(7)?,
                last_vote: row.get(8)?,
                root_slot: row.get(9)?,
                name: row.get(10)?,
                skip_rate: row.get(11)?,
                uptime: row.get(12)?,
                version: row.get(13)?,
                wiz_score: row.get(14)?,
                apy_estimate: row.get(15)?,
                ip_country: row.get(16)?,
                image: row.get(17)?,
                website: row.get(18)?,
                snapshotted_at: row.get(19)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    pub fn list_stored_epochs(&self) -> Result<Vec<EpochSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT epoch, COUNT(*) as validator_count,
                    SUM(activated_stake_lamports) as total_stake,
                    AVG(commission) as avg_commission,
                    MIN(snapshotted_at) as snapshotted_at
             FROM validator_epochs
             GROUP BY epoch
             ORDER BY epoch DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(EpochSummary {
                epoch: row.get(0)?,
                validator_count: row.get(1)?,
                total_stake_lamports: row.get(2)?,
                avg_commission: row.get(3)?,
                snapshotted_at: row.get(4)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    // ── Validator current-state queries ──────────────────────────────────────

    pub fn get_validator(&self, vote_identity: &str) -> Result<Option<ValidatorMeta>> {
        let mut stmt = self.conn.prepare(
            "SELECT vote_identity, identity, name, delinquent, activated_stake,
                    commission, skip_rate, uptime, version, wiz_score,
                    apy_estimate, ip_country, image, website, updated_at,
                    node_pubkey, activated_stake_lamports, last_vote, root_slot,
                    epoch_credits, prev_epoch_credits
             FROM validators WHERE vote_identity = ?1",
        )?;
        let mut rows = stmt.query(rusqlite::params![vote_identity])?;
        match rows.next()? {
            Some(row) => Ok(Some(ValidatorMeta {
                vote_identity: row.get(0)?,
                identity: row.get(1)?,
                name: row.get(2)?,
                delinquent: row.get::<_, Option<bool>>(3)?,
                activated_stake: row.get(4)?,
                commission: row.get(5)?,
                skip_rate: row.get(6)?,
                uptime: row.get(7)?,
                version: row.get(8)?,
                wiz_score: row.get(9)?,
                apy_estimate: row.get(10)?,
                ip_country: row.get(11)?,
                image: row.get(12)?,
                website: row.get(13)?,
                updated_at: row.get(14)?,
                node_pubkey: row.get(15)?,
                activated_stake_lamports: row.get(16)?,
                last_vote: row.get(17)?,
                root_slot: row.get(18)?,
                epoch_credits: row.get(19)?,
                prev_epoch_credits: row.get(20)?,
            })),
            None => Ok(None),
        }
    }

    // ── Existing methods ─────────────────────────────────────────────────────

    /// Look up first-seen dates for a batch of pubkeys.
    /// Returns a `HashMap<pubkey, date_string>`.
    pub fn get_dates(&self, pubkeys: &[&str]) -> Result<HashMap<String, String>> {
        if pubkeys.is_empty() {
            return Ok(HashMap::new());
        }

        let placeholders: Vec<&str> = pubkeys.iter().map(|_| "?").collect();
        let sql = format!(
            "SELECT pubkey, first_seen_at FROM first_seen WHERE pubkey IN ({})",
            placeholders.join(", ")
        );

        let mut stmt = self.conn.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::types::ToSql> = pubkeys
            .iter()
            .map(|pk| pk as &dyn rusqlite::types::ToSql)
            .collect();

        let rows = stmt.query_map(params.as_slice(), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut result = HashMap::new();
        for row in rows {
            let (pk, date) = row?;
            result.insert(pk, date);
        }
        Ok(result)
    }

    /// Record pubkeys seen now. Only inserts rows for pubkeys not already present.
    pub fn record_seen(&self, pubkeys: &[&str]) -> Result<()> {
        if pubkeys.is_empty() {
            return Ok(());
        }

        let today = Utc::now().format("%Y-%m-%d").to_string();
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR IGNORE INTO first_seen (pubkey, first_seen_at) VALUES (?1, ?2)",
            )?;
            for pk in pubkeys {
                stmt.execute(rusqlite::params![pk, &today])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// Upsert Stakewiz validator metadata in a single transaction.
    pub fn upsert_validators(&self, records: &[ValidatorMeta]) -> Result<()> {
        if records.is_empty() {
            return Ok(());
        }

        let tx = self.conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT OR REPLACE INTO validators (
                    vote_identity, identity, name, delinquent, activated_stake,
                    commission, skip_rate, uptime, version, wiz_score,
                    apy_estimate, ip_country, image, website, updated_at,
                    node_pubkey, activated_stake_lamports, last_vote, root_slot,
                    epoch_credits, prev_epoch_credits
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)",
            )?;
            for r in records {
                stmt.execute(rusqlite::params![
                    r.vote_identity,
                    r.identity,
                    r.name,
                    r.delinquent,
                    r.activated_stake,
                    r.commission,
                    r.skip_rate,
                    r.uptime,
                    r.version,
                    r.wiz_score,
                    r.apy_estimate,
                    r.ip_country,
                    r.image,
                    r.website,
                    r.updated_at,
                    r.node_pubkey,
                    r.activated_stake_lamports,
                    r.last_vote,
                    r.root_slot,
                    r.epoch_credits,
                    r.prev_epoch_credits,
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_db_path() -> std::path::PathBuf {
        let dir = std::env::temp_dir();
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        dir.join(format!("first_seen_test_{}_{}.db", std::process::id(), ts))
    }

    fn make_validator_meta(vote_identity: &str, name: Option<&str>) -> ValidatorMeta {
        ValidatorMeta {
            vote_identity: vote_identity.to_string(),
            identity: Some("identity123".to_string()),
            name: name.map(|n| n.to_string()),
            delinquent: Some(false),
            activated_stake: Some(1_000_000.0),
            commission: Some(10.0),
            skip_rate: Some(1.5),
            uptime: Some(99.9),
            version: Some("2.2.0".to_string()),
            wiz_score: Some(8.5),
            apy_estimate: Some(7.2),
            ip_country: Some("US".to_string()),
            image: Some("https://example.com/img.png".to_string()),
            website: Some("https://example.com".to_string()),
            updated_at: "2026-04-15T00:00:00Z".to_string(),
            node_pubkey: None,
            activated_stake_lamports: None,
            last_vote: None,
            root_slot: None,
            epoch_credits: None,
            prev_epoch_credits: None,
        }
    }

    fn make_snapshot(vote_identity: &str, epoch: u64) -> ValidatorEpochSnapshot {
        ValidatorEpochSnapshot {
            vote_identity: vote_identity.to_string(),
            epoch,
            node_pubkey: Some("NodePK123".to_string()),
            activated_stake_lamports: Some(5_000_000_000),
            commission: Some(8.0),
            is_delinquent: false,
            epoch_credits: Some(432000),
            prev_epoch_credits: Some(430000),
            last_vote: Some(299888765),
            root_slot: Some(299888734),
            name: Some("Test Validator".to_string()),
            skip_rate: Some(0.5),
            uptime: Some(99.9),
            version: Some("2.2.0".to_string()),
            wiz_score: Some(8.5),
            apy_estimate: Some(7.2),
            ip_country: Some("US".to_string()),
            image: None,
            website: None,
            snapshotted_at: "2026-04-15T00:00:00Z".to_string(),
        }
    }

    // ── Original tests ───────────────────────────────────────────────────────

    #[test]
    fn test_open_creates_table() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let _store = FirstSeenStore::open(&path).expect("should open");
        let conn = Connection::open(&path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM first_seen", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_record_seen_and_get_dates_round_trip() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        let pubkeys = vec!["AAA111", "BBB222", "CCC333"];
        store.record_seen(&pubkeys).unwrap();

        let dates = store.get_dates(&pubkeys).unwrap();
        assert_eq!(dates.len(), 3);

        let today = Utc::now().format("%Y-%m-%d").to_string();
        for pk in &pubkeys {
            assert_eq!(dates.get(*pk).unwrap(), &today);
        }

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_record_seen_idempotency() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        store
            .conn
            .execute(
                "INSERT INTO first_seen (pubkey, first_seen_at) VALUES (?1, ?2)",
                rusqlite::params!["OLD_PK", "2020-01-01"],
            )
            .unwrap();

        store.record_seen(&["OLD_PK"]).unwrap();

        let dates = store.get_dates(&["OLD_PK"]).unwrap();
        assert_eq!(dates.get("OLD_PK").unwrap(), "2020-01-01");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_get_dates_empty_input() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");
        let dates = store.get_dates(&[]).unwrap();
        assert!(dates.is_empty());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_record_seen_empty_input() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");
        store.record_seen(&[]).unwrap();
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_validators_table_created() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let _store = FirstSeenStore::open(&path).expect("should open");
        let conn = Connection::open(&path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM validators", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_upsert_validators_round_trip() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        let records = vec![
            make_validator_meta("AAA111", Some("Validator A")),
            make_validator_meta("BBB222", Some("Validator B")),
        ];
        store.upsert_validators(&records).unwrap();

        let conn = &store.conn;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM validators", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 2);

        let name: String = conn
            .query_row(
                "SELECT name FROM validators WHERE vote_identity = ?1",
                rusqlite::params!["AAA111"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "Validator A");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_upsert_validators_replaces_existing() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        let records = vec![make_validator_meta("AAA111", Some("Old Name"))];
        store.upsert_validators(&records).unwrap();

        let records = vec![make_validator_meta("AAA111", Some("New Name"))];
        store.upsert_validators(&records).unwrap();

        let conn = &store.conn;
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM validators", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 1);

        let name: String = conn
            .query_row(
                "SELECT name FROM validators WHERE vote_identity = ?1",
                rusqlite::params!["AAA111"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "New Name");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_upsert_validators_empty() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");
        store.upsert_validators(&[]).unwrap();

        let count: i64 = store
            .conn
            .query_row("SELECT COUNT(*) FROM validators", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);

        let _ = std::fs::remove_file(&path);
    }

    // ── New epoch snapshot tests ─────────────────────────────────────────────

    #[test]
    fn test_metadata_table_created() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let _store = FirstSeenStore::open(&path).expect("should open");
        let conn = Connection::open(&path).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM metadata", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_set_and_get_last_stored_epoch() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        store.set_last_stored_epoch(750).unwrap();
        assert_eq!(store.get_last_stored_epoch().unwrap(), Some(750));

        store.set_last_stored_epoch(751).unwrap();
        assert_eq!(store.get_last_stored_epoch().unwrap(), Some(751));

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_get_last_stored_epoch_absent() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");
        assert_eq!(store.get_last_stored_epoch().unwrap(), None);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_insert_epoch_snapshots_round_trip() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        let snapshots = vec![
            make_snapshot("AAA111", 750),
            make_snapshot("BBB222", 750),
            make_snapshot("CCC333", 750),
        ];
        store.insert_epoch_snapshots(&snapshots).unwrap();

        let results = store.get_epoch_snapshots(750).unwrap();
        assert_eq!(results.len(), 3);
        assert_eq!(results[0].vote_identity, "AAA111");
        assert_eq!(results[0].epoch_credits, Some(432000));

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_insert_epoch_snapshots_idempotent() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        let snapshots = vec![make_snapshot("AAA111", 750)];
        store.insert_epoch_snapshots(&snapshots).unwrap();
        store.insert_epoch_snapshots(&snapshots).unwrap();

        let results = store.get_epoch_snapshots(750).unwrap();
        assert_eq!(results.len(), 1);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_get_validator_epochs() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        let snapshots = vec![
            make_snapshot("AAA111", 749),
            make_snapshot("AAA111", 750),
            make_snapshot("BBB222", 750),
        ];
        store.insert_epoch_snapshots(&snapshots).unwrap();

        let results = store.get_validator_epochs("AAA111").unwrap();
        assert_eq!(results.len(), 2);
        // Ordered DESC by epoch
        assert_eq!(results[0].epoch, 750);
        assert_eq!(results[1].epoch, 749);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_list_stored_epochs() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        let snapshots = vec![
            make_snapshot("AAA111", 749),
            make_snapshot("BBB222", 749),
            make_snapshot("AAA111", 750),
        ];
        store.insert_epoch_snapshots(&snapshots).unwrap();

        let epochs = store.list_stored_epochs().unwrap();
        assert_eq!(epochs.len(), 2);
        // Ordered DESC
        assert_eq!(epochs[0].epoch, 750);
        assert_eq!(epochs[0].validator_count, 1);
        assert_eq!(epochs[1].epoch, 749);
        assert_eq!(epochs[1].validator_count, 2);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_upsert_validators_with_rpc_fields() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let store = FirstSeenStore::open(&path).expect("should open");

        let mut meta = make_validator_meta("AAA111", Some("Test"));
        meta.node_pubkey = Some("NodePK".to_string());
        meta.activated_stake_lamports = Some(5_000_000_000);
        meta.last_vote = Some(12345);
        meta.root_slot = Some(12340);
        meta.epoch_credits = Some(432000);
        meta.prev_epoch_credits = Some(430000);

        store.upsert_validators(&[meta]).unwrap();

        let v = store.get_validator("AAA111").unwrap().unwrap();
        assert_eq!(v.node_pubkey.as_deref(), Some("NodePK"));
        assert_eq!(v.activated_stake_lamports, Some(5_000_000_000));
        assert_eq!(v.last_vote, Some(12345));
        assert_eq!(v.root_slot, Some(12340));
        assert_eq!(v.epoch_credits, Some(432000));
        assert_eq!(v.prev_epoch_credits, Some(430000));

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_validator_epochs_index_exists() {
        let path = temp_db_path();
        let _ = std::fs::remove_file(&path);
        let _store = FirstSeenStore::open(&path).expect("should open");
        let conn = Connection::open(&path).unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_validator_epochs_epoch'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        let _ = std::fs::remove_file(&path);
    }
}
