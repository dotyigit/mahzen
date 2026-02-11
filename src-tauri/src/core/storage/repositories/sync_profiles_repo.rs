use anyhow::Result;
use rusqlite::params;
use serde_json::Value;

use crate::core::storage::sqlite::SqliteStorage;
use crate::models::SyncProfile;

pub fn list(storage: &SqliteStorage) -> Result<Vec<SyncProfile>> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id, name, target_id, local_root_path, bucket, prefix,
          schedule_interval_minutes, conflict_policy, delete_policy,
          include_globs_json, exclude_globs_json, enabled, last_run_at, next_run_at, updated_at
        FROM sync_profiles
        ORDER BY name COLLATE NOCASE ASC
        "#,
    )?;

    let rows = stmt.query_map([], |row| {
        let include_globs_json: String = row.get(9)?;
        let exclude_globs_json: String = row.get(10)?;
        let include_globs = serde_json::from_str::<Vec<String>>(&include_globs_json).unwrap_or_default();
        let exclude_globs = serde_json::from_str::<Vec<String>>(&exclude_globs_json).unwrap_or_default();

        Ok(SyncProfile {
            id: row.get(0)?,
            name: row.get(1)?,
            target_id: row.get(2)?,
            local_root_path: row.get(3)?,
            bucket: row.get(4)?,
            prefix: row.get(5)?,
            schedule_interval_minutes: row.get(6)?,
            conflict_policy: row.get(7)?,
            delete_policy: row.get(8)?,
            include_globs,
            exclude_globs,
            enabled: row.get::<_, i64>(11)? == 1,
            last_run_at: row.get(12)?,
            next_run_at: row.get(13)?,
            updated_at: row.get(14)?,
        })
    })?;

    Ok(rows.filter_map(|row| row.ok()).collect())
}

pub fn upsert(storage: &SqliteStorage, profile: SyncProfile) -> Result<SyncProfile> {
    let conn = storage.connection()?;
    let now = now_epoch();
    let include_globs_json: Value = serde_json::to_value(&profile.include_globs)?;
    let exclude_globs_json: Value = serde_json::to_value(&profile.exclude_globs)?;

    conn.execute(
        r#"
        INSERT INTO sync_profiles (
          id, name, target_id, local_root_path, bucket, prefix, schedule_interval_minutes,
          conflict_policy, delete_policy, include_globs_json, exclude_globs_json, enabled,
          last_run_at, next_run_at, created_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          target_id = excluded.target_id,
          local_root_path = excluded.local_root_path,
          bucket = excluded.bucket,
          prefix = excluded.prefix,
          schedule_interval_minutes = excluded.schedule_interval_minutes,
          conflict_policy = excluded.conflict_policy,
          delete_policy = excluded.delete_policy,
          include_globs_json = excluded.include_globs_json,
          exclude_globs_json = excluded.exclude_globs_json,
          enabled = excluded.enabled,
          last_run_at = excluded.last_run_at,
          next_run_at = excluded.next_run_at,
          updated_at = excluded.updated_at
        "#,
        params![
            profile.id,
            profile.name,
            profile.target_id,
            profile.local_root_path,
            profile.bucket,
            profile.prefix,
            profile.schedule_interval_minutes,
            profile.conflict_policy,
            profile.delete_policy,
            include_globs_json.to_string(),
            exclude_globs_json.to_string(),
            if profile.enabled { 1 } else { 0 },
            profile.last_run_at,
            profile.next_run_at,
            now,
            now
        ],
    )?;

    Ok(SyncProfile {
        updated_at: now,
        ..profile
    })
}

pub fn delete_many(storage: &SqliteStorage, ids: Vec<String>) -> Result<()> {
    let mut conn = storage.connection()?;
    let tx = conn.transaction()?;

    for id in ids {
        tx.execute("DELETE FROM sync_profiles WHERE id = ?1", params![id])?;
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

