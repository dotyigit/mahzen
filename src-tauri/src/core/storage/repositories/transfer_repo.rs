use anyhow::Result;
use rusqlite::params;

use crate::core::storage::sqlite::SqliteStorage;
use crate::models::TransferQueueItem;

pub fn list(storage: &SqliteStorage) -> Result<Vec<TransferQueueItem>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id, direction, target_id, bucket, key, source_path, destination_path,
          total_bytes, transferred_bytes, status, retry_count, created_at, updated_at
        FROM transfer_queue
        ORDER BY created_at DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(TransferQueueItem {
            id: row.get(0)?,
            direction: row.get(1)?,
            target_id: row.get(2)?,
            bucket: row.get(3)?,
            key: row.get(4)?,
            source_path: row.get(5)?,
            destination_path: row.get(6)?,
            total_bytes: row.get(7)?,
            transferred_bytes: row.get(8)?,
            status: row.get(9)?,
            retry_count: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
        })
    })?;

    Ok(rows.filter_map(|row| row.ok()).collect())
}

pub fn upsert(storage: &SqliteStorage, item: TransferQueueItem) -> Result<TransferQueueItem> {
    let conn = storage.connection()?;
    let now = now_epoch();

    conn.execute(
        r#"
        INSERT INTO transfer_queue (
          id, direction, target_id, bucket, key, source_path, destination_path,
          total_bytes, transferred_bytes, status, retry_count, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        ON CONFLICT(id) DO UPDATE SET
          direction = excluded.direction,
          target_id = excluded.target_id,
          bucket = excluded.bucket,
          key = excluded.key,
          source_path = excluded.source_path,
          destination_path = excluded.destination_path,
          total_bytes = excluded.total_bytes,
          transferred_bytes = excluded.transferred_bytes,
          status = excluded.status,
          retry_count = excluded.retry_count,
          updated_at = excluded.updated_at
        "#,
        params![
            item.id,
            item.direction,
            item.target_id,
            item.bucket,
            item.key,
            item.source_path,
            item.destination_path,
            item.total_bytes,
            item.transferred_bytes,
            item.status,
            item.retry_count,
            item.created_at,
            now
        ],
    )?;

    Ok(TransferQueueItem {
        updated_at: now,
        ..item
    })
}

pub fn delete_one(storage: &SqliteStorage, id: String) -> Result<()> {
    let conn = storage.connection()?;
    conn.execute("DELETE FROM transfer_queue WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn clear_terminal(storage: &SqliteStorage) -> Result<()> {
    let conn = storage.connection()?;
    conn.execute(
        "DELETE FROM transfer_queue WHERE status IN ('completed', 'failed', 'cancelled')",
        [],
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

