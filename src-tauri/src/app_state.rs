use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;

use crate::core::storage::sqlite::SqliteStorage;

pub struct AppState {
    pub storage: Arc<SqliteStorage>,
}

impl AppState {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let storage = SqliteStorage::new(db_path)?;
        Ok(Self {
            storage: Arc::new(storage),
        })
    }
}

