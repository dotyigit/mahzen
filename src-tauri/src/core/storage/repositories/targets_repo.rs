use anyhow::Result;
use rusqlite::params;
use serde_json::Value;

use crate::core::storage::sqlite::SqliteStorage;
use crate::models::StorageTarget;

pub fn list(storage: &SqliteStorage) -> Result<Vec<StorageTarget>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id, name, provider, endpoint, region,
          force_path_style, default_bucket, pinned_buckets_json,
          skip_destructive_confirmations, updated_at,
          EXISTS(SELECT 1 FROM target_credentials c WHERE c.target_id = targets.id) AS has_credentials
        FROM targets
        ORDER BY name COLLATE NOCASE ASC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        let pinned_buckets_json: String = row.get(7)?;
        let pinned_buckets = serde_json::from_str::<Vec<String>>(&pinned_buckets_json).unwrap_or_default();

        Ok(StorageTarget {
            id: row.get(0)?,
            name: row.get(1)?,
            provider: row.get(2)?,
            endpoint: row.get(3)?,
            region: row.get(4)?,
            force_path_style: row.get::<_, i64>(5)? == 1,
            default_bucket: row.get(6)?,
            pinned_buckets,
            skip_destructive_confirmations: row.get::<_, i64>(8)? == 1,
            has_credentials: row.get::<_, i64>(10)? == 1,
            updated_at: row.get(9)?,
        })
    })?;

    Ok(rows.filter_map(|row| row.ok()).collect())
}

pub fn upsert(storage: &SqliteStorage, target: StorageTarget) -> Result<StorageTarget> {
    let conn = storage.connection()?;
    let now = now_epoch();
    let pinned_buckets_json: Value = serde_json::to_value(&target.pinned_buckets)?;

    conn.execute(
        r#"
        INSERT INTO targets (
          id, name, provider, endpoint, region, force_path_style, default_bucket,
          pinned_buckets_json, skip_destructive_confirmations, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          provider = excluded.provider,
          endpoint = excluded.endpoint,
          region = excluded.region,
          force_path_style = excluded.force_path_style,
          default_bucket = excluded.default_bucket,
          pinned_buckets_json = excluded.pinned_buckets_json,
          skip_destructive_confirmations = excluded.skip_destructive_confirmations,
          updated_at = excluded.updated_at
        "#,
        params![
            target.id,
            target.name,
            target.provider,
            target.endpoint,
            target.region,
            if target.force_path_style { 1 } else { 0 },
            target.default_bucket,
            pinned_buckets_json.to_string(),
            if target.skip_destructive_confirmations { 1 } else { 0 },
            now,
            now
        ],
    )?;

    Ok(StorageTarget {
        has_credentials: target.has_credentials,
        updated_at: now,
        ..target
    })
}

pub fn find_by_id(storage: &SqliteStorage, id: &str) -> Result<Option<StorageTarget>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id, name, provider, endpoint, region,
          force_path_style, default_bucket, pinned_buckets_json,
          skip_destructive_confirmations, updated_at,
          EXISTS(SELECT 1 FROM target_credentials c WHERE c.target_id = targets.id) AS has_credentials
        FROM targets
        WHERE id = ?1
        LIMIT 1
        "#,
    )?;

    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        let pinned_buckets_json: String = row.get(7)?;
        let pinned_buckets = serde_json::from_str::<Vec<String>>(&pinned_buckets_json).unwrap_or_default();

        return Ok(Some(StorageTarget {
            id: row.get(0)?,
            name: row.get(1)?,
            provider: row.get(2)?,
            endpoint: row.get(3)?,
            region: row.get(4)?,
            force_path_style: row.get::<_, i64>(5)? == 1,
            default_bucket: row.get(6)?,
            pinned_buckets,
            skip_destructive_confirmations: row.get::<_, i64>(8)? == 1,
            updated_at: row.get(9)?,
            has_credentials: row.get::<_, i64>(10)? == 1,
        }));
    }
    Ok(None)
}

pub fn delete_many(storage: &SqliteStorage, ids: Vec<String>) -> Result<()> {
    let mut conn = storage.connection()?;
    let tx = conn.transaction()?;

    for id in ids {
        tx.execute("DELETE FROM targets WHERE id = ?1", params![id])?;
    }

    tx.commit()?;
    Ok(())
}

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
