use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;

use anyhow::{anyhow, Result};
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;

use crate::core::s3;
use crate::core::storage::repositories::{credentials_repo, index_repo, targets_repo};
use crate::core::storage::sqlite::SqliteStorage;
use crate::models::{BucketIndexObject, IndexProgressEvent};

#[derive(Clone, Debug, PartialEq)]
pub enum IndexSignal {
    Run,
    Cancel,
}

const PROGRESS_THROTTLE_MS: u128 = 300;

pub async fn run_index(
    app: AppHandle,
    storage: Arc<SqliteStorage>,
    mut signal_rx: watch::Receiver<IndexSignal>,
    target_id: String,
    bucket: String,
) {
    let result =
        run_index_inner(&app, &storage, &mut signal_rx, &target_id, &bucket).await;

    if let Err(e) = result {
        log::error!("Index job {}/{} failed: {}", target_id, bucket, e);
        let _ = index_repo::upsert_index_state(&storage, &target_id, &bucket, "error");
        let _ = app.emit(
            "index-status-change",
            serde_json::json!({
                "targetId": target_id,
                "bucket": bucket,
                "status": "error",
                "error": e.to_string(),
            }),
        );
    }
}

async fn run_index_inner(
    app: &AppHandle,
    storage: &Arc<SqliteStorage>,
    signal_rx: &mut watch::Receiver<IndexSignal>,
    target_id: &str,
    bucket: &str,
) -> Result<()> {
    let target = targets_repo::find_by_id(storage, target_id)?
        .ok_or_else(|| anyhow!("Target not found: {target_id}"))?;
    let creds = credentials_repo::get(storage, target_id)?
        .ok_or_else(|| anyhow!("Credentials not found for target: {target_id}"))?;

    // Check if resuming from a previous partial index
    let existing_state = index_repo::get_index_state(storage, target_id, bucket)?;
    let resume_token = existing_state
        .as_ref()
        .and_then(|s| s.continuation_token.clone());
    let mut indexed_objects: i64 = existing_state
        .as_ref()
        .map(|s| s.indexed_objects)
        .unwrap_or(0);
    let mut total_size: i64 = existing_state
        .as_ref()
        .map(|s| s.total_size)
        .unwrap_or(0);

    // If not resuming (fresh index), clear existing objects
    if resume_token.is_none() {
        index_repo::clear_objects(storage, target_id, bucket)?;
        indexed_objects = 0;
        total_size = 0;
    }

    index_repo::upsert_index_state(storage, target_id, bucket, "indexing")?;
    emit_status(app, target_id, bucket, "indexing");

    let client = s3::build_client(&target, &creds).await?;
    let mut continuation_token = resume_token;
    let mut last_progress_emit = Instant::now();

    // Track all unique prefixes to generate folder entries
    let mut known_prefixes: HashSet<String> = HashSet::new();

    loop {
        // Check cancel signal
        if is_cancelled(signal_rx) {
            index_repo::update_index_progress(
                storage,
                target_id,
                bucket,
                indexed_objects,
                total_size,
                continuation_token.as_deref(),
            )?;
            index_repo::upsert_index_state(storage, target_id, bucket, "idle")?;
            emit_status(app, target_id, bucket, "cancelled");
            return Ok(());
        }

        let mut req = client.list_objects_v2().bucket(bucket);
        // No delimiter — flat recursive listing
        if let Some(token) = &continuation_token {
            req = req.continuation_token(token);
        }

        let output = req
            .send()
            .await
            .map_err(|e| anyhow!("S3 list objects failed during indexing: {e}"))?;

        let mut batch = Vec::new();

        if let Some(contents) = output.contents {
            for obj in contents {
                let key = obj.key.unwrap_or_default();
                if key.is_empty() {
                    continue;
                }

                // Skip folder marker objects (zero-byte keys ending with /)
                if key.ends_with('/') {
                    // Still register as a folder entry
                    let parent = compute_parent_prefix(&key);
                    let folder_name = key
                        .trim_end_matches('/')
                        .rsplit('/')
                        .next()
                        .unwrap_or("")
                        .to_string();

                    if !folder_name.is_empty() && known_prefixes.insert(key.clone()) {
                        batch.push(BucketIndexObject {
                            target_id: target_id.to_string(),
                            bucket: bucket.to_string(),
                            key: key.clone(),
                            parent_prefix: parent,
                            name: folder_name,
                            is_folder: true,
                            size: 0,
                            last_modified: None,
                            etag: None,
                            storage_class: None,
                        });
                    }
                    continue;
                }

                let size = obj.size.unwrap_or(0);
                let parent = compute_parent_prefix(&key);
                let name = key.rsplit('/').next().unwrap_or(&key).to_string();

                // Generate virtual folder entries for all ancestor prefixes
                let mut prefix_acc = String::new();
                for segment in key.split('/').collect::<Vec<_>>().iter().rev().skip(1).rev()
                {
                    let parent_of_folder = prefix_acc.clone();
                    prefix_acc.push_str(segment);
                    prefix_acc.push('/');

                    if known_prefixes.insert(prefix_acc.clone()) {
                        batch.push(BucketIndexObject {
                            target_id: target_id.to_string(),
                            bucket: bucket.to_string(),
                            key: prefix_acc.clone(),
                            parent_prefix: parent_of_folder,
                            name: segment.to_string(),
                            is_folder: true,
                            size: 0,
                            last_modified: None,
                            etag: None,
                            storage_class: None,
                        });
                    }
                }

                batch.push(BucketIndexObject {
                    target_id: target_id.to_string(),
                    bucket: bucket.to_string(),
                    key,
                    parent_prefix: parent,
                    name,
                    is_folder: false,
                    size,
                    last_modified: obj.last_modified.map(|dt| dt.to_string()),
                    etag: obj.e_tag,
                    storage_class: obj.storage_class.map(|sc| sc.to_string()),
                });

                indexed_objects += 1;
                total_size += size;
            }
        }

        if !batch.is_empty() {
            index_repo::insert_objects_batch(storage, &batch)?;
        }

        let is_truncated = output.is_truncated == Some(true);
        if is_truncated {
            continuation_token = output.next_continuation_token;
            if continuation_token.is_none() {
                break;
            }
            // Save checkpoint
            index_repo::update_index_progress(
                storage,
                target_id,
                bucket,
                indexed_objects,
                total_size,
                continuation_token.as_deref(),
            )?;
        } else {
            break;
        }

        // Throttled progress emit
        if last_progress_emit.elapsed().as_millis() >= PROGRESS_THROTTLE_MS {
            let _ = app.emit(
                "index-progress",
                IndexProgressEvent {
                    target_id: target_id.to_string(),
                    bucket: bucket.to_string(),
                    status: "indexing".to_string(),
                    indexed_objects,
                    total_size,
                },
            );
            last_progress_emit = Instant::now();
        }
    }

    // Complete
    index_repo::complete_index(storage, target_id, bucket, indexed_objects, total_size)?;
    emit_status(app, target_id, bucket, "idle");

    let _ = app.emit(
        "index-progress",
        IndexProgressEvent {
            target_id: target_id.to_string(),
            bucket: bucket.to_string(),
            status: "idle".to_string(),
            indexed_objects,
            total_size,
        },
    );

    Ok(())
}

fn compute_parent_prefix(key: &str) -> String {
    // For "a/b/c.txt" → "a/b/"
    // For "a/b/" → "a/"
    // For "file.txt" → ""
    let trimmed = key.trim_end_matches('/');
    match trimmed.rfind('/') {
        Some(pos) => trimmed[..=pos].to_string(),
        None => String::new(),
    }
}

fn is_cancelled(signal_rx: &watch::Receiver<IndexSignal>) -> bool {
    *signal_rx.borrow() == IndexSignal::Cancel
}

fn emit_status(app: &AppHandle, target_id: &str, bucket: &str, status: &str) {
    let _ = app.emit(
        "index-status-change",
        serde_json::json!({
            "targetId": target_id,
            "bucket": bucket,
            "status": status,
        }),
    );
}
