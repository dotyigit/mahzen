use anyhow::Result;
use rusqlite::params;

use crate::core::storage::sqlite::SqliteStorage;
use crate::models::TargetCredentials;

pub fn upsert(storage: &SqliteStorage, target_id: &str, credentials: &TargetCredentials) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        r#"
        INSERT INTO target_credentials(
          target_id, access_key_id, secret_access_key, session_token, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(target_id) DO UPDATE SET
          access_key_id = excluded.access_key_id,
          secret_access_key = excluded.secret_access_key,
          session_token = excluded.session_token,
          updated_at = excluded.updated_at
        "#,
        params![
            target_id,
            credentials.access_key_id,
            credentials.secret_access_key,
            credentials.session_token,
            now,
            now
        ],
    )?;
    Ok(())
}

pub fn get(storage: &SqliteStorage, target_id: &str) -> Result<Option<TargetCredentials>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT access_key_id, secret_access_key, session_token
        FROM target_credentials
        WHERE target_id = ?1
        LIMIT 1
        "#,
    )?;

    let mut rows = stmt.query(params![target_id])?;
    if let Some(row) = rows.next()? {
        return Ok(Some(TargetCredentials {
            access_key_id: row.get(0)?,
            secret_access_key: row.get(1)?,
            session_token: row.get(2)?,
        }));
    }

    Ok(None)
}

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
