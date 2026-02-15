use tauri::State;
use tokio::sync::watch;

use crate::app_state::AppState;
use crate::core::index_engine::{self, IndexSignal};
use crate::core::storage::repositories::index_repo;
use crate::models::{BucketIndexState, S3ObjectEntry, S3ObjectListPage};

fn index_key(target_id: &str, bucket: &str) -> String {
    format!("{target_id}:{bucket}")
}

#[tauri::command]
pub async fn index_start(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    target_id: String,
    bucket: String,
    fresh: bool,
) -> Result<BucketIndexState, String> {
    let key = index_key(&target_id, &bucket);

    // Cancel any existing indexing for this bucket
    {
        let mut signals = state.index_signals.lock().await;
        if let Some(tx) = signals.remove(&key) {
            let _ = tx.send(IndexSignal::Cancel);
        }
    }

    // If fresh reindex, clear existing data
    if fresh {
        index_repo::delete_index(&state.storage, &target_id, &bucket)
            .map_err(|e| e.to_string())?;
    }

    // Create/update index state
    index_repo::upsert_index_state(&state.storage, &target_id, &bucket, "indexing")
        .map_err(|e| e.to_string())?;

    let index_state = index_repo::get_index_state(&state.storage, &target_id, &bucket)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to create index state".to_string())?;

    // Create signal channel and spawn engine
    let (signal_tx, signal_rx) = watch::channel(IndexSignal::Run);
    {
        let mut signals = state.index_signals.lock().await;
        signals.insert(key, signal_tx);
    }

    let storage = state.storage.clone();
    let tid = target_id.clone();
    let bkt = bucket.clone();
    tokio::spawn(async move {
        index_engine::run_index(app, storage, signal_rx, tid, bkt).await;
    });

    Ok(index_state)
}

#[tauri::command]
pub async fn index_cancel(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
) -> Result<(), String> {
    let key = index_key(&target_id, &bucket);
    let mut signals = state.index_signals.lock().await;
    if let Some(tx) = signals.remove(&key) {
        let _ = tx.send(IndexSignal::Cancel);
    }
    Ok(())
}

#[tauri::command]
pub async fn index_delete(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
) -> Result<(), String> {
    // Cancel if running
    let key = index_key(&target_id, &bucket);
    {
        let mut signals = state.index_signals.lock().await;
        if let Some(tx) = signals.remove(&key) {
            let _ = tx.send(IndexSignal::Cancel);
        }
    }
    index_repo::delete_index(&state.storage, &target_id, &bucket)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn index_state_get(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
) -> Result<Option<BucketIndexState>, String> {
    index_repo::get_index_state(&state.storage, &target_id, &bucket)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn index_state_list(
    state: State<'_, AppState>,
) -> Result<Vec<BucketIndexState>, String> {
    index_repo::list_index_states(&state.storage).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn index_browse(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    parent_prefix: String,
    sort_field: String,
    sort_dir: String,
    limit: i64,
    offset: i64,
) -> Result<S3ObjectListPage, String> {
    // Validate sort_dir to prevent SQL injection
    let sort_dir = if sort_dir.to_uppercase() == "DESC" {
        "DESC"
    } else {
        "ASC"
    };

    index_repo::browse(
        &state.storage,
        &target_id,
        &bucket,
        &parent_prefix,
        &sort_field,
        sort_dir,
        limit,
        offset,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn index_search(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    query: String,
    limit: i64,
) -> Result<Vec<S3ObjectEntry>, String> {
    index_repo::search(&state.storage, &target_id, &bucket, &query, limit)
        .map_err(|e| e.to_string())
}
