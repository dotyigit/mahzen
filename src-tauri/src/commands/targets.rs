use tauri::State;

use crate::app_state::AppState;
use crate::core::s3;
use crate::core::storage::repositories::{credentials_repo, targets_repo};
use crate::models::{S3BucketSummary, S3ConnectionResult, StorageTarget, TargetCredentials};

#[tauri::command]
pub fn targets_list(state: State<'_, AppState>) -> Result<Vec<StorageTarget>, String> {
    targets_repo::list(&state.storage).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn targets_upsert(state: State<'_, AppState>, target: StorageTarget) -> Result<StorageTarget, String> {
    targets_repo::upsert(&state.storage, target).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn targets_delete(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    targets_repo::delete_many(&state.storage, ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn target_credentials_get(state: State<'_, AppState>, target_id: String) -> Result<Option<TargetCredentials>, String> {
    credentials_repo::get(&state.storage, &target_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn target_credentials_upsert(
    state: State<'_, AppState>,
    target_id: String,
    credentials: TargetCredentials,
) -> Result<(), String> {
    credentials_repo::upsert(&state.storage, &target_id, &credentials).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_buckets_list(state: State<'_, AppState>, target_id: String) -> Result<Vec<S3BucketSummary>, String> {
    let target = targets_repo::find_by_id(&state.storage, &target_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Target not found.".to_string())?;

    // If scoped to a single bucket, return it directly without calling ListBuckets
    if let Some(ref bucket_name) = target.scoped_bucket {
        return Ok(vec![S3BucketSummary {
            name: bucket_name.clone(),
            created_at: None,
        }]);
    }

    let credentials = credentials_repo::get(&state.storage, &target_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Credentials not found for target.".to_string())?;

    s3::list_buckets(&target, &credentials).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_connection_test(
    state: State<'_, AppState>,
    target_id: String,
) -> Result<S3ConnectionResult, String> {
    let target = targets_repo::find_by_id(&state.storage, &target_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Target not found.".to_string())?;
    let credentials = credentials_repo::get(&state.storage, &target_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Credentials not found for target.".to_string())?;

    // For scoped-bucket targets, test with ListObjects instead of ListBuckets
    if let Some(ref bucket_name) = target.scoped_bucket {
        s3::list_objects_page(&target, &credentials, bucket_name, "", 1, None)
            .await
            .map_err(|e| e.to_string())?;

        return Ok(S3ConnectionResult {
            ok: true,
            message: format!("Connected to bucket '{}'.", bucket_name),
            bucket_count: 1,
        });
    }

    let buckets = s3::list_buckets(&target, &credentials)
        .await
        .map_err(|e| e.to_string())?;

    Ok(S3ConnectionResult {
        ok: true,
        message: format!("Connected successfully. {} bucket(s) found.", buckets.len()),
        bucket_count: buckets.len(),
    })
}
