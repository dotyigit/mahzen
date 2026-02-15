use anyhow::Result;
use rusqlite::params;

use crate::core::storage::sqlite::SqliteStorage;
use crate::models::{CloneJob, CloneJobItem};

pub fn list_jobs(storage: &SqliteStorage) -> Result<Vec<CloneJob>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id, status, source_target_id, source_bucket, source_prefix,
          dest_target_id, dest_bucket, dest_prefix, conflict_policy,
          is_same_target, enumeration_token, enumeration_complete,
          total_items, completed_items, failed_items, skipped_items,
          total_bytes, transferred_bytes, created_at, updated_at, completed_at
        FROM clone_jobs
        ORDER BY created_at DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(CloneJob {
            id: row.get(0)?,
            status: row.get(1)?,
            source_target_id: row.get(2)?,
            source_bucket: row.get(3)?,
            source_prefix: row.get(4)?,
            dest_target_id: row.get(5)?,
            dest_bucket: row.get(6)?,
            dest_prefix: row.get(7)?,
            conflict_policy: row.get(8)?,
            is_same_target: row.get::<_, i64>(9)? != 0,
            enumeration_token: row.get(10)?,
            enumeration_complete: row.get::<_, i64>(11)? != 0,
            total_items: row.get(12)?,
            completed_items: row.get(13)?,
            failed_items: row.get(14)?,
            skipped_items: row.get(15)?,
            total_bytes: row.get(16)?,
            transferred_bytes: row.get(17)?,
            created_at: row.get(18)?,
            updated_at: row.get(19)?,
            completed_at: row.get(20)?,
        })
    })?;

    Ok(rows.filter_map(|row| row.ok()).collect())
}

pub fn get_job(storage: &SqliteStorage, id: &str) -> Result<Option<CloneJob>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id, status, source_target_id, source_bucket, source_prefix,
          dest_target_id, dest_bucket, dest_prefix, conflict_policy,
          is_same_target, enumeration_token, enumeration_complete,
          total_items, completed_items, failed_items, skipped_items,
          total_bytes, transferred_bytes, created_at, updated_at, completed_at
        FROM clone_jobs
        WHERE id = ?1
        "#,
    )?;

    let mut rows = stmt.query_map(params![id], |row| {
        Ok(CloneJob {
            id: row.get(0)?,
            status: row.get(1)?,
            source_target_id: row.get(2)?,
            source_bucket: row.get(3)?,
            source_prefix: row.get(4)?,
            dest_target_id: row.get(5)?,
            dest_bucket: row.get(6)?,
            dest_prefix: row.get(7)?,
            conflict_policy: row.get(8)?,
            is_same_target: row.get::<_, i64>(9)? != 0,
            enumeration_token: row.get(10)?,
            enumeration_complete: row.get::<_, i64>(11)? != 0,
            total_items: row.get(12)?,
            completed_items: row.get(13)?,
            failed_items: row.get(14)?,
            skipped_items: row.get(15)?,
            total_bytes: row.get(16)?,
            transferred_bytes: row.get(17)?,
            created_at: row.get(18)?,
            updated_at: row.get(19)?,
            completed_at: row.get(20)?,
        })
    })?;

    Ok(rows.next().and_then(|r| r.ok()))
}

pub fn insert_job(storage: &SqliteStorage, job: &CloneJob) -> Result<()> {
    let conn = storage.connection()?;
    conn.execute(
        r#"
        INSERT INTO clone_jobs (
          id, status, source_target_id, source_bucket, source_prefix,
          dest_target_id, dest_bucket, dest_prefix, conflict_policy,
          is_same_target, enumeration_token, enumeration_complete,
          total_items, completed_items, failed_items, skipped_items,
          total_bytes, transferred_bytes, created_at, updated_at, completed_at
        )
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)
        "#,
        params![
            job.id,
            job.status,
            job.source_target_id,
            job.source_bucket,
            job.source_prefix,
            job.dest_target_id,
            job.dest_bucket,
            job.dest_prefix,
            job.conflict_policy,
            job.is_same_target as i64,
            job.enumeration_token,
            job.enumeration_complete as i64,
            job.total_items,
            job.completed_items,
            job.failed_items,
            job.skipped_items,
            job.total_bytes,
            job.transferred_bytes,
            job.created_at,
            job.updated_at,
            job.completed_at,
        ],
    )?;
    Ok(())
}

pub fn update_job_status(storage: &SqliteStorage, id: &str, status: &str) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        "UPDATE clone_jobs SET status = ?1, updated_at = ?2 WHERE id = ?3",
        params![status, now, id],
    )?;
    Ok(())
}

pub fn update_job_progress(
    storage: &SqliteStorage,
    id: &str,
    completed_items: i64,
    failed_items: i64,
    skipped_items: i64,
    transferred_bytes: i64,
) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        r#"UPDATE clone_jobs SET
            completed_items = ?1, failed_items = ?2, skipped_items = ?3,
            transferred_bytes = ?4, updated_at = ?5
           WHERE id = ?6"#,
        params![completed_items, failed_items, skipped_items, transferred_bytes, now, id],
    )?;
    Ok(())
}

pub fn complete_job(storage: &SqliteStorage, id: &str, status: &str) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        "UPDATE clone_jobs SET status = ?1, completed_at = ?2, updated_at = ?2 WHERE id = ?3",
        params![status, now, id],
    )?;
    Ok(())
}

pub fn save_enumeration_state(
    storage: &SqliteStorage,
    id: &str,
    token: Option<&str>,
    total_items: i64,
    total_bytes: i64,
    complete: bool,
) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        r#"UPDATE clone_jobs SET
            enumeration_token = ?1, total_items = ?2, total_bytes = ?3,
            enumeration_complete = ?4, updated_at = ?5
           WHERE id = ?6"#,
        params![token, total_items, total_bytes, complete as i64, now, id],
    )?;
    Ok(())
}

pub fn delete_job(storage: &SqliteStorage, id: &str) -> Result<()> {
    let conn = storage.connection()?;
    conn.execute("DELETE FROM clone_jobs WHERE id = ?1", params![id])?;
    Ok(())
}

// --- Clone Job Items ---

pub fn insert_items_batch(storage: &SqliteStorage, items: &[CloneJobItem]) -> Result<()> {
    let mut conn = storage.connection()?;
    let tx = conn.transaction()?;
    for item in items {
        tx.execute(
            r#"INSERT OR IGNORE INTO clone_job_items
               (id, job_id, source_key, dest_key, size, source_etag,
                source_last_modified, status, retry_count, created_at, updated_at)
               VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)"#,
            params![
                item.id,
                item.job_id,
                item.source_key,
                item.dest_key,
                item.size,
                item.source_etag,
                item.source_last_modified,
                item.status,
                item.retry_count,
                item.created_at,
                item.updated_at,
            ],
        )?;
    }
    tx.commit()?;
    Ok(())
}

pub fn list_pending_items(
    storage: &SqliteStorage,
    job_id: &str,
    limit: i64,
) -> Result<Vec<CloneJobItem>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT id, job_id, source_key, dest_key, size, source_etag,
               source_last_modified, status, error_message, retry_count,
               created_at, updated_at
        FROM clone_job_items
        WHERE job_id = ?1 AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT ?2
        "#,
    )?;

    let rows = stmt.query_map(params![job_id, limit], |row| {
        Ok(CloneJobItem {
            id: row.get(0)?,
            job_id: row.get(1)?,
            source_key: row.get(2)?,
            dest_key: row.get(3)?,
            size: row.get(4)?,
            source_etag: row.get(5)?,
            source_last_modified: row.get(6)?,
            status: row.get(7)?,
            error_message: row.get(8)?,
            retry_count: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn list_items(
    storage: &SqliteStorage,
    job_id: &str,
    status_filter: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<CloneJobItem>> {
    let conn = storage.connection()?;

    let (sql, params_vec): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match status_filter {
        Some(status) => (
            r#"
            SELECT id, job_id, source_key, dest_key, size, source_etag,
                   source_last_modified, status, error_message, retry_count,
                   created_at, updated_at
            FROM clone_job_items
            WHERE job_id = ?1 AND status = ?2
            ORDER BY created_at ASC
            LIMIT ?3 OFFSET ?4
            "#
            .to_string(),
            vec![
                Box::new(job_id.to_string()),
                Box::new(status.to_string()),
                Box::new(limit),
                Box::new(offset),
            ],
        ),
        None => (
            r#"
            SELECT id, job_id, source_key, dest_key, size, source_etag,
                   source_last_modified, status, error_message, retry_count,
                   created_at, updated_at
            FROM clone_job_items
            WHERE job_id = ?1
            ORDER BY created_at ASC
            LIMIT ?2 OFFSET ?3
            "#
            .to_string(),
            vec![
                Box::new(job_id.to_string()),
                Box::new(limit),
                Box::new(offset),
            ],
        ),
    };

    let mut stmt = conn.prepare(&sql)?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(CloneJobItem {
            id: row.get(0)?,
            job_id: row.get(1)?,
            source_key: row.get(2)?,
            dest_key: row.get(3)?,
            size: row.get(4)?,
            source_etag: row.get(5)?,
            source_last_modified: row.get(6)?,
            status: row.get(7)?,
            error_message: row.get(8)?,
            retry_count: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn update_item_status(
    storage: &SqliteStorage,
    item_id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        r#"UPDATE clone_job_items
           SET status = ?1, error_message = ?2, updated_at = ?3
           WHERE id = ?4"#,
        params![status, error_message, now, item_id],
    )?;
    Ok(())
}

pub fn reset_active_items(storage: &SqliteStorage, job_id: &str) -> Result<i64> {
    let conn = storage.connection()?;
    let now = now_epoch();
    let count = conn.execute(
        "UPDATE clone_job_items SET status = 'pending', updated_at = ?1 WHERE job_id = ?2 AND status = 'active'",
        params![now, job_id],
    )?;
    Ok(count as i64)
}

pub fn reset_failed_items(storage: &SqliteStorage, job_id: &str) -> Result<i64> {
    let conn = storage.connection()?;
    let now = now_epoch();
    let count = conn.execute(
        "UPDATE clone_job_items SET status = 'pending', error_message = NULL, updated_at = ?1 WHERE job_id = ?2 AND status = 'failed'",
        params![now, job_id],
    )?;
    Ok(count as i64)
}

pub struct ItemStatusCounts {
    pub completed: i64,
    pub failed: i64,
    pub skipped: i64,
    pub pending: i64,
    pub _active: i64,
    pub total_transferred_bytes: i64,
}

pub fn count_items_by_status(storage: &SqliteStorage, job_id: &str) -> Result<ItemStatusCounts> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN status = 'completed' THEN size ELSE 0 END), 0)
        FROM clone_job_items
        WHERE job_id = ?1
        "#,
    )?;

    let counts = stmt.query_row(params![job_id], |row| {
        Ok(ItemStatusCounts {
            completed: row.get(0)?,
            failed: row.get(1)?,
            skipped: row.get(2)?,
            pending: row.get(3)?,
            _active: row.get(4)?,
            total_transferred_bytes: row.get(5)?,
        })
    })?;

    Ok(counts)
}

pub fn find_jobs_by_status(storage: &SqliteStorage, statuses: &[&str]) -> Result<Vec<CloneJob>> {
    let conn = storage.connection()?;
    let placeholders: Vec<String> = statuses.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        r#"
        SELECT
          id, status, source_target_id, source_bucket, source_prefix,
          dest_target_id, dest_bucket, dest_prefix, conflict_policy,
          is_same_target, enumeration_token, enumeration_complete,
          total_items, completed_items, failed_items, skipped_items,
          total_bytes, transferred_bytes, created_at, updated_at, completed_at
        FROM clone_jobs
        WHERE status IN ({})
        "#,
        placeholders.join(", ")
    );

    let mut stmt = conn.prepare(&sql)?;
    let params: Vec<&dyn rusqlite::types::ToSql> = statuses.iter().map(|s| s as &dyn rusqlite::types::ToSql).collect();
    let rows = stmt.query_map(params.as_slice(), |row| {
        Ok(CloneJob {
            id: row.get(0)?,
            status: row.get(1)?,
            source_target_id: row.get(2)?,
            source_bucket: row.get(3)?,
            source_prefix: row.get(4)?,
            dest_target_id: row.get(5)?,
            dest_bucket: row.get(6)?,
            dest_prefix: row.get(7)?,
            conflict_policy: row.get(8)?,
            is_same_target: row.get::<_, i64>(9)? != 0,
            enumeration_token: row.get(10)?,
            enumeration_complete: row.get::<_, i64>(11)? != 0,
            total_items: row.get(12)?,
            completed_items: row.get(13)?,
            failed_items: row.get(14)?,
            skipped_items: row.get(15)?,
            total_bytes: row.get(16)?,
            transferred_bytes: row.get(17)?,
            created_at: row.get(18)?,
            updated_at: row.get(19)?,
            completed_at: row.get(20)?,
        })
    })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
