use serde::Serialize;
use tauri::{Emitter, State};

use crate::app_state::AppState;
use crate::core::s3;
use crate::core::storage::repositories::{credentials_repo, targets_repo};
use crate::models::{BucketStats, S3ObjectEntry, S3ObjectListPage};
use log::info;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    transfer_id: String,
    bytes_done: u64,
    bytes_total: u64,
}

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
pub async fn target_objects_list_page(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    prefix: String,
    max_keys: i32,
    continuation_token: Option<String>,
) -> Result<S3ObjectListPage, String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::list_objects_page(&target, &credentials, &bucket, &prefix, max_keys, continuation_token)
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
    app: tauri::AppHandle,
    target_id: String,
    bucket: String,
    key: String,
    dest_path: String,
    transfer_id: String,
) -> Result<(), String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;

    let app_clone = app.clone();
    let tid = transfer_id.clone();

    s3::get_object(
        &target,
        &credentials,
        &bucket,
        &key,
        &dest_path,
        move |done, total| {
            let _ = app_clone.emit(
                "download-progress",
                DownloadProgress {
                    transfer_id: tid.clone(),
                    bytes_done: done,
                    bytes_total: total,
                },
            );
        },
    )
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
pub async fn target_objects_list_recursive(
    state: State<'_, AppState>,
    target_id: String,
    bucket: String,
    prefix: String,
) -> Result<Vec<S3ObjectEntry>, String> {
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;
    s3::list_objects_recursive(&target, &credentials, &bucket, &prefix)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn target_objects_download_zip(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    target_id: String,
    bucket: String,
    keys: Vec<String>,
    base_prefix: String,
    dest_path: String,
    transfer_id: String,
    total_size: u64,
) -> Result<u64, String> {
    info!("Downloading {} objects as ZIP to {}", keys.len(), dest_path);
    let (target, credentials) = resolve_target_and_credentials(&state, &target_id)?;

    let app_clone = app.clone();
    let tid = transfer_id.clone();

    s3::download_objects_as_zip(
        &target,
        &credentials,
        &bucket,
        keys,
        &base_prefix,
        &dest_path,
        total_size,
        move |done, total| {
            let _ = app_clone.emit(
                "download-progress",
                DownloadProgress {
                    transfer_id: tid.clone(),
                    bytes_done: done,
                    bytes_total: total,
                },
            );
        },
    )
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
