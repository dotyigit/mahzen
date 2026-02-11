use tauri::State;

use crate::app_state::AppState;
use crate::core::s3;
use crate::core::storage::repositories::{credentials_repo, targets_repo};
use crate::models::{BucketStats, S3ObjectEntry};

fn resolve_target_and_credentials(
    state: &AppState,
    target_id: &str,
) -> Result<(crate::models::StorageTarget, crate::models::TargetCredentials), String> {
    let target = targets_repo::find_by_id(&state.storage, target_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Target not found.".to_string())?;
    let credentials = credentials_repo::get(&state.storage, target_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Credentials not found for target.".to_string())?;
    Ok((target, credentials))
}

#[tauri::command]
pub async fn target_objects_list(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    prefix: String,
) -> Result<Vec<S3ObjectEntry>, String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::list_objects(&target, &credentials, &bucket, &prefix)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_object_upload(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    key: String,
    source_path: String,
) -> Result<(), String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::put_object(&target, &credentials, &bucket, &key, &source_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_object_download(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    key: String,
    dest_path: String,
) -> Result<(), String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::get_object(&target, &credentials, &bucket, &key, &dest_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_objects_delete(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    keys: Vec<String>,
) -> Result<(), String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::delete_objects(&target, &credentials, &bucket, keys)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_folder_create(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    key: String,
) -> Result<(), String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::create_folder(&target, &credentials, &bucket, &key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_bucket_stats(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
) -> Result<BucketStats, String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::bucket_stats(&target, &credentials, &bucket)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_object_presign(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    key: String,
    expires_in_secs: u64,
) -> Result<String, String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::presign_object(&target, &credentials, &bucket, &key, expires_in_secs)
        .await
        .map_err(|e| e.to_string())
}
