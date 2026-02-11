use tauri::State;

use crate::app_state::AppState;
use crate::core::storage::repositories::transfer_repo;
use crate::models::TransferQueueItem;

#[tauri::command]
pub fn transfer_queue_list(state: State<'_, AppState>) -> Result<Vec<TransferQueueItem>, String> {
    transfer_repo::list(&state.storage).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn transfer_queue_upsert(
    state: State<'_, AppState>,
    item: TransferQueueItem,
) -> Result<TransferQueueItem, String> {
    transfer_repo::upsert(&state.storage, item).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn transfer_queue_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    transfer_repo::delete_one(&state.storage, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn transfer_queue_clear_terminal(state: State<'_, AppState>) -> Result<(), String> {
    transfer_repo::clear_terminal(&state.storage).map_err(|e| e.to_string())
}

