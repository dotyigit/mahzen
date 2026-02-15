use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{watch, Mutex as TokioMutex};

use crate::core::clone_engine::CloneSignal;
use crate::core::index_engine::IndexSignal;
use crate::core::storage::sqlite::SqliteStorage;

pub struct AppState {
    pub storage: Arc<SqliteStorage>,
    pub clone_signals: Arc<TokioMutex<HashMap<String, watch::Sender<CloneSignal>>>>,
    pub index_signals: Arc<TokioMutex<HashMap<String, watch::Sender<IndexSignal>>>>,
}

impl AppState {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        let storage = SqliteStorage::new(db_path)?;
        Ok(Self {
            storage: Arc::new(storage),
            clone_signals: Arc::new(TokioMutex::new(HashMap::new())),
            index_signals: Arc::new(TokioMutex::new(HashMap::new())),
        })
    }
}
