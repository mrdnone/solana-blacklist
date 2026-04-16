//! SQLite persistence for first-seen dates.
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
        Ok(Self { conn })
    }

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
                    apy_estimate, ip_country, image, website, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
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

    #[test]
    fn test_open_creates_table() {
        let path = temp_db_path();
        // Ensure the file does not already exist
        let _ = std::fs::remove_file(&path);
        let _store = FirstSeenStore::open(&path).expect("should open");
        // Verify the table exists by opening a raw connection
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

        // Insert a pubkey with a known past date to verify it's not overwritten
        store
            .conn
            .execute(
                "INSERT INTO first_seen (pubkey, first_seen_at) VALUES (?1, ?2)",
                rusqlite::params!["OLD_PK", "2020-01-01"],
            )
            .unwrap();

        // record_seen with the same pubkey should NOT update the date
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
        store.record_seen(&[]).unwrap(); // should not error
        let _ = std::fs::remove_file(&path);
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
        }
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
        store.upsert_validators(&[]).unwrap(); // should not error

        let count: i64 = store
            .conn
            .query_row("SELECT COUNT(*) FROM validators", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);

        let _ = std::fs::remove_file(&path);
    }
}
