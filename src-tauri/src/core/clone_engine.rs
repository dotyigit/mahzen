use std::sync::Arc;
use std::time::Instant;

use anyhow::{anyhow, Result};
use tauri::{AppHandle, Emitter};
use tokio::sync::{watch, Semaphore};
use uuid::Uuid;

use crate::core::s3;
use crate::core::storage::repositories::{clone_repo, credentials_repo, targets_repo};
use crate::core::storage::sqlite::SqliteStorage;
use crate::models::{CloneJobItem, CloneProgressEvent, StorageTarget, TargetCredentials};

#[derive(Clone, Debug, PartialEq)]
pub enum CloneSignal {
    Run,
    Pause,
    Cancel,
}

const SAME_TARGET_CONCURRENCY: usize = 20;
const CROSS_TARGET_CONCURRENCY: usize = 4;
const BATCH_SIZE: i64 = 100;
const PROGRESS_THROTTLE_MS: u128 = 200;

pub async fn run_clone_job(
    app: AppHandle,
    storage: Arc<SqliteStorage>,
    mut signal_rx: watch::Receiver<CloneSignal>,
    job_id: String,
) {
    let result = run_clone_job_inner(&app, &storage, &mut signal_rx, &job_id).await;

    if let Err(e) = result {
        log::error!("Clone job {} failed: {}", job_id, e);
        let _ = clone_repo::complete_job(&storage, &job_id, "failed");
        let _ = app.emit(
            "clone-status-change",
            serde_json::json!({"jobId": job_id, "status": "failed", "error": e.to_string()}),
        );
    }
}

async fn run_clone_job_inner(
    app: &AppHandle,
    storage: &Arc<SqliteStorage>,
    signal_rx: &mut watch::Receiver<CloneSignal>,
    job_id: &str,
) -> Result<()> {
    let job = clone_repo::get_job(storage, job_id)?
        .ok_or_else(|| anyhow!("Clone job not found: {job_id}"))?;

    let source_target = targets_repo::find_by_id(storage, &job.source_target_id)?
        .ok_or_else(|| anyhow!("Source target not found"))?;
    let source_creds = credentials_repo::get(storage, &job.source_target_id)?
        .ok_or_else(|| anyhow!("Source target credentials not found"))?;

    let dest_target = targets_repo::find_by_id(storage, &job.dest_target_id)?
        .ok_or_else(|| anyhow!("Destination target not found"))?;
    let dest_creds = credentials_repo::get(storage, &job.dest_target_id)?
        .ok_or_else(|| anyhow!("Destination target credentials not found"))?;

    // Phase 1: Enumeration (if not complete)
    if !job.enumeration_complete {
        if check_signal(signal_rx, storage, app, job_id).await? {
            return Ok(());
        }
        clone_repo::update_job_status(storage, job_id, "enumerating")?;
        emit_status_change(app, job_id, "enumerating");

        enumerate_source(
            app,
            storage,
            signal_rx,
            job_id,
            &source_target,
            &source_creds,
            &job.source_bucket,
            &job.source_prefix,
            &job.dest_prefix,
            job.enumeration_token.as_deref(),
        )
        .await?;
    }

    // Phase 2: Execution
    if check_signal(signal_rx, storage, app, job_id).await? {
        return Ok(());
    }
    clone_repo::update_job_status(storage, job_id, "running")?;
    emit_status_change(app, job_id, "running");

    let concurrency = if job.is_same_target {
        SAME_TARGET_CONCURRENCY
    } else {
        CROSS_TARGET_CONCURRENCY
    };

    let temp_dir = std::env::temp_dir();
    let mut last_progress_emit = Instant::now();

    loop {
        if check_signal(signal_rx, storage, app, job_id).await? {
            return Ok(());
        }

        let batch = clone_repo::list_pending_items(storage, job_id, BATCH_SIZE)?;
        if batch.is_empty() {
            break;
        }

        // Mark items as active
        for item in &batch {
            let _ = clone_repo::update_item_status(storage, &item.id, "active", None);
        }

        let semaphore = Arc::new(Semaphore::new(concurrency));
        let mut handles = Vec::new();
        let mut batch_item_ids: Vec<String> = Vec::new();

        for item in batch {
            batch_item_ids.push(item.id.clone());

            let permit = semaphore
                .clone()
                .acquire_owned()
                .await
                .map_err(|e| anyhow!("Semaphore error: {e}"))?;

            let st = source_target.clone();
            let sc = source_creds.clone();
            let dt = dest_target.clone();
            let dc = dest_creds.clone();
            let is_same = job.is_same_target;
            let conflict_policy = job.conflict_policy.clone();
            let source_bucket = job.source_bucket.clone();
            let dest_bucket = job.dest_bucket.clone();
            let td = temp_dir.clone();

            let handle = tokio::spawn(async move {
                let result = process_item(
                    &item,
                    &conflict_policy,
                    is_same,
                    &st,
                    &sc,
                    &source_bucket,
                    &dt,
                    &dc,
                    &dest_bucket,
                    &td,
                )
                .await;
                drop(permit);
                (item, result)
            });
            handles.push(handle);
        }

        // Collect results
        let mut processed_ids = std::collections::HashSet::new();
        for handle in handles {
            match handle.await {
                Ok((item, Ok(outcome))) => {
                    processed_ids.insert(item.id.clone());
                    match outcome {
                        ItemOutcome::Completed => {
                            let _ = clone_repo::update_item_status(
                                storage, &item.id, "completed", None,
                            );
                        }
                        ItemOutcome::Skipped => {
                            let _ = clone_repo::update_item_status(
                                storage, &item.id, "skipped", None,
                            );
                        }
                    }
                }
                Ok((item, Err(e))) => {
                    processed_ids.insert(item.id.clone());
                    let _ = clone_repo::update_item_status(
                        storage,
                        &item.id,
                        "failed",
                        Some(&e.to_string()),
                    );
                }
                Err(e) => {
                    log::error!("Clone task join error: {e}");
                }
            }
        }

        // Safety net: mark any items that weren't processed (e.g., task panic) as failed
        for id in &batch_item_ids {
            if !processed_ids.contains(id) {
                let _ = clone_repo::update_item_status(
                    storage,
                    id,
                    "failed",
                    Some("Task failed unexpectedly"),
                );
            }
        }

        // Update aggregate progress
        let counts = clone_repo::count_items_by_status(storage, job_id)?;
        let _ = clone_repo::update_job_progress(
            storage,
            job_id,
            counts.completed,
            counts.failed,
            counts.skipped,
            counts.total_transferred_bytes,
        );

        if last_progress_emit.elapsed().as_millis() >= PROGRESS_THROTTLE_MS {
            let job = clone_repo::get_job(storage, job_id)?
                .ok_or_else(|| anyhow!("Job disappeared"))?;
            emit_progress(app, &job);
            last_progress_emit = Instant::now();
        }
    }

    // Final status
    let counts = clone_repo::count_items_by_status(storage, job_id)?;
    let _ = clone_repo::update_job_progress(
        storage,
        job_id,
        counts.completed,
        counts.failed,
        counts.skipped,
        counts.total_transferred_bytes,
    );

    let final_status = if counts.failed > 0 && counts.pending == 0 {
        "completed"
    } else if counts.pending == 0 {
        "completed"
    } else {
        "failed"
    };

    clone_repo::complete_job(storage, job_id, final_status)?;
    emit_status_change(app, job_id, final_status);

    // Final progress emit
    if let Ok(Some(job)) = clone_repo::get_job(storage, job_id) {
        emit_progress(app, &job);
    }

    Ok(())
}

async fn enumerate_source(
    app: &AppHandle,
    storage: &Arc<SqliteStorage>,
    signal_rx: &mut watch::Receiver<CloneSignal>,
    job_id: &str,
    source_target: &StorageTarget,
    source_creds: &TargetCredentials,
    source_bucket: &str,
    source_prefix: &str,
    dest_prefix: &str,
    resume_token: Option<&str>,
) -> Result<()> {
    let client = s3::build_client(source_target, source_creds).await?;
    let mut continuation_token: Option<String> = resume_token.map(|s| s.to_string());
    let mut total_items: i64 = 0;
    let mut total_bytes: i64 = 0;

    // If resuming, load current counts
    if resume_token.is_some() {
        if let Some(job) = clone_repo::get_job(storage, job_id)? {
            total_items = job.total_items;
            total_bytes = job.total_bytes;
        }
    }

    let now = now_epoch();

    loop {
        if check_signal(signal_rx, storage, app, job_id).await? {
            return Ok(());
        }

        let mut req = client
            .list_objects_v2()
            .bucket(source_bucket)
            .prefix(source_prefix);

        if let Some(token) = &continuation_token {
            req = req.continuation_token(token);
        }

        let output = req
            .send()
            .await
            .map_err(|e| anyhow!("S3 list objects failed during enumeration: {e}"))?;

        let mut batch_items = Vec::new();

        if let Some(contents) = output.contents {
            for obj in contents {
                let key = obj.key.unwrap_or_default();
                if key.is_empty() || key.ends_with('/') {
                    continue;
                }

                let size = obj.size.unwrap_or(0);
                let dest_key = compute_dest_key(&key, source_prefix, dest_prefix);

                batch_items.push(CloneJobItem {
                    id: Uuid::now_v7().to_string(),
                    job_id: job_id.to_string(),
                    source_key: key,
                    dest_key,
                    size,
                    source_etag: obj.e_tag,
                    source_last_modified: obj.last_modified.map(|dt| dt.to_string()),
                    status: "pending".to_string(),
                    error_message: None,
                    retry_count: 0,
                    created_at: now,
                    updated_at: now,
                });

                total_items += 1;
                total_bytes += size;
            }
        }

        if !batch_items.is_empty() {
            clone_repo::insert_items_batch(storage, &batch_items)?;
        }

        let is_truncated = output.is_truncated == Some(true);
        if is_truncated {
            continuation_token = output.next_continuation_token;
            if continuation_token.is_none() {
                break;
            }
            // Save enumeration checkpoint
            clone_repo::save_enumeration_state(
                storage,
                job_id,
                continuation_token.as_deref(),
                total_items,
                total_bytes,
                false,
            )?;
        } else {
            break;
        }

        // Emit progress during enumeration
        if let Ok(Some(job)) = clone_repo::get_job(storage, job_id) {
            emit_progress(app, &job);
        }
    }

    // Mark enumeration complete
    clone_repo::save_enumeration_state(storage, job_id, None, total_items, total_bytes, true)?;
    Ok(())
}

enum ItemOutcome {
    Completed,
    Skipped,
}

async fn process_item(
    item: &CloneJobItem,
    conflict_policy: &str,
    is_same_target: bool,
    source_target: &StorageTarget,
    source_creds: &TargetCredentials,
    source_bucket: &str,
    dest_target: &StorageTarget,
    dest_creds: &TargetCredentials,
    dest_bucket: &str,
    temp_dir: &std::path::Path,
) -> Result<ItemOutcome> {
    // Conflict resolution
    match conflict_policy {
        "skip" => {
            if let Some(_) =
                s3::head_object(dest_target, dest_creds, dest_bucket, &item.dest_key).await?
            {
                return Ok(ItemOutcome::Skipped);
            }
        }
        "overwriteIfNewer" => {
            if let Some((_, dest_last_modified)) =
                s3::head_object(dest_target, dest_creds, dest_bucket, &item.dest_key).await?
            {
                if let (Some(dest_lm), Some(src_lm)) =
                    (dest_last_modified.as_deref(), item.source_last_modified.as_deref())
                {
                    if dest_lm >= src_lm {
                        return Ok(ItemOutcome::Skipped);
                    }
                }
            }
        }
        // "overwrite" - always proceed
        _ => {}
    }

    // Execute copy
    if is_same_target {
        s3::copy_object(
            source_target,
            source_creds,
            source_bucket,
            &item.source_key,
            dest_bucket,
            &item.dest_key,
            item.size,
        )
        .await?;
    } else {
        s3::cross_target_copy(
            source_target,
            source_creds,
            source_bucket,
            &item.source_key,
            dest_target,
            dest_creds,
            dest_bucket,
            &item.dest_key,
            temp_dir,
            |_, _| {},
        )
        .await?;
    }

    Ok(ItemOutcome::Completed)
}

fn compute_dest_key(source_key: &str, source_prefix: &str, dest_prefix: &str) -> String {
    let relative = source_key.strip_prefix(source_prefix).unwrap_or(source_key);
    format!("{}{}", dest_prefix, relative)
}

async fn check_signal(
    signal_rx: &mut watch::Receiver<CloneSignal>,
    storage: &Arc<SqliteStorage>,
    app: &AppHandle,
    job_id: &str,
) -> Result<bool> {
    let current = { signal_rx.borrow().clone() };
    match current {
        CloneSignal::Run => Ok(false),
        CloneSignal::Pause => {
            clone_repo::update_job_status(storage, job_id, "paused")?;
            emit_status_change(app, job_id, "paused");

            // Wait for signal change
            loop {
                let _ = signal_rx.changed().await;
                let next = { signal_rx.borrow().clone() };
                match next {
                    CloneSignal::Run => {
                        clone_repo::update_job_status(storage, job_id, "running")?;
                        emit_status_change(app, job_id, "running");
                        return Ok(false);
                    }
                    CloneSignal::Cancel => {
                        clone_repo::update_job_status(storage, job_id, "cancelled")?;
                        emit_status_change(app, job_id, "cancelled");
                        return Ok(true);
                    }
                    CloneSignal::Pause => continue,
                }
            }
        }
        CloneSignal::Cancel => {
            clone_repo::update_job_status(storage, job_id, "cancelled")?;
            emit_status_change(app, job_id, "cancelled");
            Ok(true)
        }
    }
}

fn emit_status_change(app: &AppHandle, job_id: &str, status: &str) {
    let _ = app.emit(
        "clone-status-change",
        serde_json::json!({"jobId": job_id, "status": status}),
    );
}

fn emit_progress(app: &AppHandle, job: &crate::models::CloneJob) {
    let _ = app.emit(
        "clone-progress",
        CloneProgressEvent {
            job_id: job.id.clone(),
            status: job.status.clone(),
            total_items: job.total_items,
            completed_items: job.completed_items,
            failed_items: job.failed_items,
            skipped_items: job.skipped_items,
            total_bytes: job.total_bytes,
            transferred_bytes: job.transferred_bytes,
            current_key: None,
        },
    );
}

fn now_epoch() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
