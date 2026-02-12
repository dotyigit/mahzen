use anyhow::Result;
use rusqlite::params;

use crate::core::storage::sqlite::SqliteStorage;
use crate::models::CachedBucketStats;

pub fn list(storage: &SqliteStorage) -> Result<Vec<CachedBucketStats>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        "SELECT target_id, bucket, object_count, total_size, cached_at FROM bucket_stats_cache",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(CachedBucketStats {
            target_id: row.get(0)?,
            bucket: row.get(1)?,
            object_count: row.get(2)?,
            total_size: row.get(3)?,
            cached_at: row.get(4)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn upsert(
    storage: &SqliteStorage,
    target_id: &str,
    bucket: &str,
    object_count: i64,
    total_size: i64,
) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();

    conn.execute(
        r#"
        INSERT INTO bucket_stats_cache (target_id, bucket, object_count, total_size, cached_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT(target_id, bucket) DO UPDATE SET
          object_count = excluded.object_count,
          total_size = excluded.total_size,
          cached_at = excluded.cached_at
        "#,
        params![target_id, bucket, object_count, total_size, now],
    )?;

    Ok(())
}

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
