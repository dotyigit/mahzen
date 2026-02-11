use tauri::State;

use crate::app_state::AppState;
use crate::core::storage::repositories::sync_profiles_repo;
use crate::models::SyncProfile;

#[tauri::command]
pub fn sync_profiles_list(state: State<'_, AppState>) -> Result<Vec<SyncProfile>, String> {
    sync_profiles_repo::list(&state.storage).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sync_profiles_upsert(state: State<'_, AppState>, profile: SyncProfile) -> Result<SyncProfile, String> {
    sync_profiles_repo::upsert(&state.storage, profile).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sync_profiles_delete(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    sync_profiles_repo::delete_many(&state.storage, ids).map_err(|e| e.to_string())
}

