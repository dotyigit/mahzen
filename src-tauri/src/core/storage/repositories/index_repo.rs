use anyhow::Result;
use rusqlite::params;

use crate::core::storage::sqlite::SqliteStorage;
use crate::models::{BucketIndexObject, BucketIndexState, S3ObjectEntry, S3ObjectListPage};

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

// --- Index State ---

pub fn get_index_state(
    storage: &SqliteStorage,
    target_id: &str,
    bucket: &str,
) -> Result<Option<BucketIndexState>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT target_id, bucket, status, total_objects, indexed_objects, total_size,
               continuation_token, last_indexed_at, created_at, updated_at
        FROM bucket_index_state
        WHERE target_id = ?1 AND bucket = ?2
        "#,
    )?;

    let result = stmt.query_row(params![target_id, bucket], |row| {
        Ok(BucketIndexState {
            target_id: row.get(0)?,
            bucket: row.get(1)?,
            status: row.get(2)?,
            total_objects: row.get(3)?,
            indexed_objects: row.get(4)?,
            total_size: row.get(5)?,
            continuation_token: row.get(6)?,
            last_indexed_at: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    });

    match result {
        Ok(state) => Ok(Some(state)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn list_index_states(storage: &SqliteStorage) -> Result<Vec<BucketIndexState>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT target_id, bucket, status, total_objects, indexed_objects, total_size,
               continuation_token, last_indexed_at, created_at, updated_at
        FROM bucket_index_state
        ORDER BY updated_at DESC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(BucketIndexState {
            target_id: row.get(0)?,
            bucket: row.get(1)?,
            status: row.get(2)?,
            total_objects: row.get(3)?,
            indexed_objects: row.get(4)?,
            total_size: row.get(5)?,
            continuation_token: row.get(6)?,
            last_indexed_at: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

pub fn upsert_index_state(
    storage: &SqliteStorage,
    target_id: &str,
    bucket: &str,
    status: &str,
) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        r#"
        INSERT INTO bucket_index_state (target_id, bucket, status, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?4)
        ON CONFLICT(target_id, bucket) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at
        "#,
        params![target_id, bucket, status, now],
    )?;
    Ok(())
}

pub fn update_index_progress(
    storage: &SqliteStorage,
    target_id: &str,
    bucket: &str,
    indexed_objects: i64,
    total_size: i64,
    continuation_token: Option<&str>,
) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        r#"
        UPDATE bucket_index_state
        SET indexed_objects = ?3, total_size = ?4,
            continuation_token = ?5, updated_at = ?6
        WHERE target_id = ?1 AND bucket = ?2
        "#,
        params![target_id, bucket, indexed_objects, total_size, continuation_token, now],
    )?;
    Ok(())
}

pub fn complete_index(
    storage: &SqliteStorage,
    target_id: &str,
    bucket: &str,
    total_objects: i64,
    total_size: i64,
) -> Result<()> {
    let conn = storage.connection()?;
    let now = now_epoch();
    conn.execute(
        r#"
        UPDATE bucket_index_state
        SET status = 'idle', total_objects = ?3, indexed_objects = ?3,
            total_size = ?4, continuation_token = NULL,
            last_indexed_at = ?5, updated_at = ?5
        WHERE target_id = ?1 AND bucket = ?2
        "#,
        params![target_id, bucket, total_objects, total_size, now],
    )?;
    Ok(())
}

pub fn delete_index(storage: &SqliteStorage, target_id: &str, bucket: &str) -> Result<()> {
    let conn = storage.connection()?;
    conn.execute(
        "DELETE FROM bucket_index_objects WHERE target_id = ?1 AND bucket = ?2",
        params![target_id, bucket],
    )?;
    conn.execute(
        "DELETE FROM bucket_index_state WHERE target_id = ?1 AND bucket = ?2",
        params![target_id, bucket],
    )?;
    Ok(())
}

// --- Index Objects ---

pub fn clear_objects(storage: &SqliteStorage, target_id: &str, bucket: &str) -> Result<()> {
    let conn = storage.connection()?;
    conn.execute(
        "DELETE FROM bucket_index_objects WHERE target_id = ?1 AND bucket = ?2",
        params![target_id, bucket],
    )?;
    Ok(())
}

pub fn insert_objects_batch(
    storage: &SqliteStorage,
    objects: &[BucketIndexObject],
) -> Result<()> {
    let conn = storage.connection()?;
    let tx = conn.unchecked_transaction()?;
    {
        let mut stmt = tx.prepare(
            r#"
            INSERT OR REPLACE INTO bucket_index_objects
              (target_id, bucket, key, parent_prefix, name, is_folder, size, last_modified, etag, storage_class)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
        )?;
        for obj in objects {
            stmt.execute(params![
                obj.target_id,
                obj.bucket,
                obj.key,
                obj.parent_prefix,
                obj.name,
                obj.is_folder as i64,
                obj.size,
                obj.last_modified,
                obj.etag,
                obj.storage_class,
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Browse indexed objects at a given prefix with sorting and pagination.
/// Returns results in S3ObjectListPage format for seamless frontend integration.
pub fn browse(
    storage: &SqliteStorage,
    target_id: &str,
    bucket: &str,
    parent_prefix: &str,
    sort_field: &str,
    sort_dir: &str,
    limit: i64,
    offset: i64,
) -> Result<S3ObjectListPage> {
    let conn = storage.connection()?;

    // Count total items at this prefix for has_more
    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM bucket_index_objects WHERE target_id = ?1 AND bucket = ?2 AND parent_prefix = ?3",
        params![target_id, bucket, parent_prefix],
        |row| row.get(0),
    )?;

    let order_clause = match sort_field {
        "size" => format!("is_folder DESC, size {sort_dir}, name ASC"),
        "lastModified" => format!("is_folder DESC, last_modified {sort_dir}, name ASC"),
        "storageClass" => format!("is_folder DESC, storage_class {sort_dir}, name ASC"),
        _ => format!("is_folder DESC, name {sort_dir}"),
    };

    let query = format!(
        r#"
        SELECT key, parent_prefix, name, is_folder, size, last_modified, etag, storage_class
        FROM bucket_index_objects
        WHERE target_id = ?1 AND bucket = ?2 AND parent_prefix = ?3
        ORDER BY {order_clause}
        LIMIT ?4 OFFSET ?5
        "#
    );

    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map(params![target_id, bucket, parent_prefix, limit, offset], |row| {
        let is_folder: i64 = row.get(3)?;
        Ok(S3ObjectEntry {
            key: row.get(0)?,
            name: row.get(2)?,
            size: row.get(4)?,
            last_modified: row.get(5)?,
            etag: row.get(6)?,
            storage_class: row.get(7)?,
            is_folder: is_folder != 0,
            content_type: None,
        })
    })?;

    let mut entries = Vec::new();
    for row in rows {
        entries.push(row?);
    }

    let is_truncated = (offset + limit) < total;

    Ok(S3ObjectListPage {
        entries,
        next_continuation_token: if is_truncated {
            Some((offset + limit).to_string())
        } else {
            None
        },
        is_truncated,
    })
}

/// Search objects by name or key pattern within an indexed bucket.
/// Matches against both the file name and the full key (path), so queries
/// like "image.png" and "assets/images/image.png" both work.
pub fn search(
    storage: &SqliteStorage,
    target_id: &str,
    bucket: &str,
    query: &str,
    limit: i64,
) -> Result<Vec<S3ObjectEntry>> {
    let conn = storage.connection()?;
    let pattern = format!("%{query}%");
    let mut stmt = conn.prepare(
        r#"
        SELECT key, name, is_folder, size, last_modified, etag, storage_class
        FROM bucket_index_objects
        WHERE target_id = ?1 AND bucket = ?2
          AND (name LIKE ?3 OR key LIKE ?3)
          AND is_folder = 0
        ORDER BY name ASC
        LIMIT ?4
        "#,
    )?;

    let rows = stmt.query_map(params![target_id, bucket, pattern, limit], |row| {
        let is_folder: i64 = row.get(2)?;
        Ok(S3ObjectEntry {
            key: row.get(0)?,
            name: row.get(1)?,
            size: row.get(3)?,
            last_modified: row.get(4)?,
            etag: row.get(5)?,
            storage_class: row.get(6)?,
            is_folder: is_folder != 0,
            content_type: None,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

/// Add a single object to the index (for live updates after upload/delete).
pub fn upsert_object(storage: &SqliteStorage, obj: &BucketIndexObject) -> Result<()> {
    let conn = storage.connection()?;
    conn.execute(
        r#"
        INSERT OR REPLACE INTO bucket_index_objects
          (target_id, bucket, key, parent_prefix, name, is_folder, size, last_modified, etag, storage_class)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        "#,
        params![
            obj.target_id,
            obj.bucket,
            obj.key,
            obj.parent_prefix,
            obj.name,
            obj.is_folder as i64,
            obj.size,
            obj.last_modified,
            obj.etag,
            obj.storage_class,
        ],
    )?;
    Ok(())
}

/// Remove objects from the index by key prefix (for live updates after delete).
pub fn remove_objects(
    storage: &SqliteStorage,
    target_id: &str,
    bucket: &str,
    keys: &[String],
) -> Result<()> {
    let conn = storage.connection()?;
    for key in keys {
        conn.execute(
            "DELETE FROM bucket_index_objects WHERE target_id = ?1 AND bucket = ?2 AND key = ?3",
            params![target_id, bucket, key],
        )?;
    }
    Ok(())
}
