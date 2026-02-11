use anyhow::Result;
use rusqlite::params;

use crate::core::storage::sqlite::SqliteStorage;
use crate::models::AppSettings;

pub fn get(storage: &SqliteStorage) -> Result<AppSettings> {
    let conn = storage.connection()?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          theme, font_size, date_format, size_format,
          show_file_icons, compact_mode, animate_transitions,
          double_click_nav, show_hidden, remember_path, auto_refresh,
          confirm_delete, concurrent_uploads, concurrent_downloads,
          multipart_threshold_mb, part_size_mb, auto_retry, retry_count,
          preserve_timestamps, verify_checksum
        FROM app_settings
        WHERE id = 'default'
        LIMIT 1
        "#,
    )?;

    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        Ok(AppSettings {
            theme: row.get(0)?,
            font_size: row.get(1)?,
            date_format: row.get(2)?,
            size_format: row.get(3)?,
            show_file_icons: row.get::<_, i64>(4)? == 1,
            compact_mode: row.get::<_, i64>(5)? == 1,
            animate_transitions: row.get::<_, i64>(6)? == 1,
            double_click_nav: row.get::<_, i64>(7)? == 1,
            show_hidden: row.get::<_, i64>(8)? == 1,
            remember_path: row.get::<_, i64>(9)? == 1,
            auto_refresh: row.get::<_, i64>(10)? == 1,
            confirm_delete: row.get::<_, i64>(11)? == 1,
            concurrent_uploads: row.get(12)?,
            concurrent_downloads: row.get(13)?,
            multipart_threshold_mb: row.get(14)?,
            part_size_mb: row.get(15)?,
            auto_retry: row.get::<_, i64>(16)? == 1,
            retry_count: row.get(17)?,
            preserve_timestamps: row.get::<_, i64>(18)? == 1,
            verify_checksum: row.get::<_, i64>(19)? == 1,
        })
    } else {
        Ok(AppSettings::default())
    }
}

pub fn upsert(storage: &SqliteStorage, settings: &AppSettings) -> Result<AppSettings> {
    let conn = storage.connection()?;
    let now = now_epoch();

    conn.execute(
        r#"
        INSERT INTO app_settings (
          id, theme, font_size, date_format, size_format,
          show_file_icons, compact_mode, animate_transitions,
          double_click_nav, show_hidden, remember_path, auto_refresh,
          confirm_delete, concurrent_uploads, concurrent_downloads,
          multipart_threshold_mb, part_size_mb, auto_retry, retry_count,
          preserve_timestamps, verify_checksum, created_at, updated_at
        )
        VALUES (
          'default', ?1, ?2, ?3, ?4,
          ?5, ?6, ?7,
          ?8, ?9, ?10, ?11,
          ?12, ?13, ?14,
          ?15, ?16, ?17, ?18,
          ?19, ?20, ?21, ?22
        )
        ON CONFLICT(id) DO UPDATE SET
          theme = excluded.theme,
          font_size = excluded.font_size,
          date_format = excluded.date_format,
          size_format = excluded.size_format,
          show_file_icons = excluded.show_file_icons,
          compact_mode = excluded.compact_mode,
          animate_transitions = excluded.animate_transitions,
          double_click_nav = excluded.double_click_nav,
          show_hidden = excluded.show_hidden,
          remember_path = excluded.remember_path,
          auto_refresh = excluded.auto_refresh,
          confirm_delete = excluded.confirm_delete,
          concurrent_uploads = excluded.concurrent_uploads,
          concurrent_downloads = excluded.concurrent_downloads,
          multipart_threshold_mb = excluded.multipart_threshold_mb,
          part_size_mb = excluded.part_size_mb,
          auto_retry = excluded.auto_retry,
          retry_count = excluded.retry_count,
          preserve_timestamps = excluded.preserve_timestamps,
          verify_checksum = excluded.verify_checksum,
          updated_at = excluded.updated_at
        "#,
        params![
            settings.theme,
            settings.font_size,
            settings.date_format,
            settings.size_format,
            if settings.show_file_icons { 1 } else { 0 },
            if settings.compact_mode { 1 } else { 0 },
            if settings.animate_transitions { 1 } else { 0 },
            if settings.double_click_nav { 1 } else { 0 },
            if settings.show_hidden { 1 } else { 0 },
            if settings.remember_path { 1 } else { 0 },
            if settings.auto_refresh { 1 } else { 0 },
            if settings.confirm_delete { 1 } else { 0 },
            settings.concurrent_uploads,
            settings.concurrent_downloads,
            settings.multipart_threshold_mb,
            settings.part_size_mb,
            if settings.auto_retry { 1 } else { 0 },
            settings.retry_count,
            if settings.preserve_timestamps { 1 } else { 0 },
            if settings.verify_checksum { 1 } else { 0 },
            now,
            now
        ],
    )?;

    Ok(settings.clone())
}

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
