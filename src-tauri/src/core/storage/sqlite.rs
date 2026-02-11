use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};

use anyhow::{Context, Result};
use rusqlite::Connection;

use crate::core::storage::migrations::run_migrations;

pub struct SqliteStorage {
    conn: Mutex<Connection>,
}

impl SqliteStorage {
    pub fn new(path: PathBuf) -> Result<Self> {
        let conn = Connection::open(path).context("failed to open sqlite database")?;
        run_migrations(&conn).context("failed to run sqlite migrations")?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn connection(&self) -> Result<MutexGuard<'_, Connection>> {
        self.conn.lock().map_err(|_| anyhow::anyhow!("database lock poisoned"))
    }
}

