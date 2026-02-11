use tauri::State;

use crate::app_state::AppState;
use crate::core::storage::repositories::settings_repo;
use crate::models::AppSettings;

#[tauri::command]
pub fn settings_get(state: State<'_, AppState>) -> Result<AppSettings, String> {
    settings_repo::get(&state.storage).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn settings_upsert(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    settings_repo::upsert(&state.storage, &settings).map_err(|e| e.to_string())
}
