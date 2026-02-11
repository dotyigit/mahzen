use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA temp_store = MEMORY;
        PRAGMA mmap_size = 268435456;

        CREATE TABLE IF NOT EXISTS targets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          region TEXT,
          force_path_style INTEGER NOT NULL DEFAULT 1,
          default_bucket TEXT,
          pinned_buckets_json TEXT NOT NULL DEFAULT '[]',
          skip_destructive_confirmations INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_targets_name ON targets(name);

        CREATE TABLE IF NOT EXISTS target_credentials (
          target_id TEXT PRIMARY KEY,
          access_key_id TEXT NOT NULL,
          secret_access_key TEXT NOT NULL,
          session_token TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY(target_id) REFERENCES targets(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sync_profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          target_id TEXT NOT NULL,
          local_root_path TEXT NOT NULL,
          bucket TEXT NOT NULL,
          prefix TEXT NOT NULL DEFAULT '',
          schedule_interval_minutes INTEGER,
          conflict_policy TEXT NOT NULL DEFAULT 'newestMtimeWins',
          delete_policy TEXT NOT NULL DEFAULT 'noPropagation',
          include_globs_json TEXT NOT NULL DEFAULT '[]',
          exclude_globs_json TEXT NOT NULL DEFAULT '[]',
          enabled INTEGER NOT NULL DEFAULT 1,
          last_run_at INTEGER,
          next_run_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY(target_id) REFERENCES targets(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_sync_profiles_target ON sync_profiles(target_id);
        CREATE INDEX IF NOT EXISTS idx_sync_profiles_next_run ON sync_profiles(next_run_at);

        CREATE TABLE IF NOT EXISTS transfer_queue (
          id TEXT PRIMARY KEY,
          direction TEXT NOT NULL,
          target_id TEXT NOT NULL,
          bucket TEXT NOT NULL,
          key TEXT NOT NULL,
          source_path TEXT,
          destination_path TEXT,
          total_bytes INTEGER,
          transferred_bytes INTEGER,
          status TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY(target_id) REFERENCES targets(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_transfer_queue_status ON transfer_queue(status);
        CREATE INDEX IF NOT EXISTS idx_transfer_queue_created_at ON transfer_queue(created_at);

        CREATE TABLE IF NOT EXISTS app_settings (
          id TEXT PRIMARY KEY DEFAULT 'default',
          theme TEXT NOT NULL DEFAULT 'dark',
          font_size INTEGER NOT NULL DEFAULT 12,
          date_format TEXT NOT NULL DEFAULT 'relative',
          size_format TEXT NOT NULL DEFAULT 'binary',
          show_file_icons INTEGER NOT NULL DEFAULT 1,
          compact_mode INTEGER NOT NULL DEFAULT 0,
          animate_transitions INTEGER NOT NULL DEFAULT 1,
          double_click_nav INTEGER NOT NULL DEFAULT 1,
          show_hidden INTEGER NOT NULL DEFAULT 0,
          remember_path INTEGER NOT NULL DEFAULT 1,
          auto_refresh INTEGER NOT NULL DEFAULT 0,
          confirm_delete INTEGER NOT NULL DEFAULT 1,
          concurrent_uploads INTEGER NOT NULL DEFAULT 3,
          concurrent_downloads INTEGER NOT NULL DEFAULT 5,
          multipart_threshold_mb INTEGER NOT NULL DEFAULT 100,
          part_size_mb INTEGER NOT NULL DEFAULT 8,
          auto_retry INTEGER NOT NULL DEFAULT 1,
          retry_count INTEGER NOT NULL DEFAULT 3,
          preserve_timestamps INTEGER NOT NULL DEFAULT 1,
          verify_checksum INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        "#,
    )?;

    Ok(())
}
