use std::sync::Arc;

use tauri::State;
use tokio::sync::watch;
use uuid::Uuid;

use crate::app_state::AppState;
use crate::core::clone_engine::{self, CloneSignal};
use crate::core::storage::repositories::clone_repo;
use crate::models::{CloneJob, CloneJobItem};

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub async fn clone_start(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    source_target_id: String,
    source_bucket: String,
    source_prefix: String,
    dest_target_id: String,
    dest_bucket: String,
    dest_prefix: String,
    conflict_policy: String,
) -> Result<CloneJob, String> {
    let now = now_epoch();
    let is_same_target = source_target_id == dest_target_id;

    let job = CloneJob {
        id: Uuid::now_v7().to_string(),
        status: "pending".to_string(),
        source_target_id,
        source_bucket,
        source_prefix,
        dest_target_id,
        dest_bucket,
        dest_prefix,
        conflict_policy,
        is_same_target,
        enumeration_token: None,
        enumeration_complete: false,
        total_items: 0,
        completed_items: 0,
        failed_items: 0,
        skipped_items: 0,
        total_bytes: 0,
        transferred_bytes: 0,
        created_at: now,
        updated_at: now,
        completed_at: None,
    };

    clone_repo::insert_job(&state.storage, &job).map_err(|e| e.to_string())?;

    // Create signal channel and spawn engine
    let (signal_tx, signal_rx) = watch::channel(CloneSignal::Run);
    {
        let mut signals = state.clone_signals.lock().await;
        signals.insert(job.id.clone(), signal_tx);
    }

    let storage = Arc::clone(&state.storage);
    let job_id = job.id.clone();
    tokio::spawn(async move {
        clone_engine::run_clone_job(app, storage, signal_rx, job_id).await;
    });

    Ok(job)
}

#[tauri::command]
pub async fn clone_pause(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), String> {
    let signals = state.clone_signals.lock().await;
    if let Some(tx) = signals.get(&job_id) {
        let _ = tx.send(CloneSignal::Pause);
        Ok(())
    } else {
        Err("Clone job not running".to_string())
    }
}

#[tauri::command]
pub async fn clone_resume(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    job_id: String,
) -> Result<(), String> {
    // Reset any active items back to pending
    clone_repo::reset_active_items(&state.storage, &job_id).map_err(|e| e.to_string())?;

    // Check if there's already a signal for this job (paused)
    {
        let signals = state.clone_signals.lock().await;
        if let Some(tx) = signals.get(&job_id) {
            let _ = tx.send(CloneSignal::Run);
            return Ok(());
        }
    }

    // No existing signal — create a new one and spawn engine
    let (signal_tx, signal_rx) = watch::channel(CloneSignal::Run);
    {
        let mut signals = state.clone_signals.lock().await;
        signals.insert(job_id.clone(), signal_tx);
    }

    let storage = Arc::clone(&state.storage);
    let jid = job_id.clone();
    tokio::spawn(async move {
        clone_engine::run_clone_job(app, storage, signal_rx, jid).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn clone_cancel(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<(), String> {
    let mut signals = state.clone_signals.lock().await;
    if let Some(tx) = signals.remove(&job_id) {
        let _ = tx.send(CloneSignal::Cancel);
    } else {
        // Job not running, just update status directly
        clone_repo::update_job_status(&state.storage, &job_id, "cancelled")
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn clone_job_list(state: State<'_, AppState>) -> Result<Vec<CloneJob>, String> {
    clone_repo::list_jobs(&state.storage).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clone_job_get(state: State<'_, AppState>, job_id: String) -> Result<Option<CloneJob>, String> {
    clone_repo::get_job(&state.storage, &job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clone_job_delete(state: State<'_, AppState>, job_id: String) -> Result<(), String> {
    clone_repo::delete_job(&state.storage, &job_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clone_retry_failed(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    job_id: String,
) -> Result<(), String> {
    clone_repo::reset_failed_items(&state.storage, &job_id).map_err(|e| e.to_string())?;

    // Re-run the job
    let (signal_tx, signal_rx) = watch::channel(CloneSignal::Run);
    {
        let mut signals = state.clone_signals.lock().await;
        signals.insert(job_id.clone(), signal_tx);
    }

    let storage = Arc::clone(&state.storage);
    let jid = job_id.clone();
    tokio::spawn(async move {
        clone_engine::run_clone_job(app, storage, signal_rx, jid).await;
    });

    Ok(())
}

#[tauri::command]
pub fn clone_job_items_list(
    state: State<'_, AppState>,
    job_id: String,
    status_filter: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<CloneJobItem>, String> {
    clone_repo::list_items(
        &state.storage,
        &job_id,
        status_filter.as_deref(),
        limit.unwrap_or(100),
        offset.unwrap_or(0),
    )
    .map_err(|e| e.to_string())
}
