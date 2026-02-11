mod app_state;
mod commands;
mod core;
mod models;

use std::fs;

use app_state::AppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("mahzen.sqlite");
            let state = AppState::new(db_path)?;
            app.manage(state);

            let open_item = MenuItem::with_id(app, "open-main", "Open Mahzen", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit-app", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("mahzen-tray")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open-main" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "quit-app" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::targets::targets_list,
            commands::targets::targets_upsert,
            commands::targets::targets_delete,
            commands::targets::target_credentials_get,
            commands::targets::target_credentials_upsert,
            commands::targets::target_buckets_list,
            commands::targets::target_connection_test,
            commands::objects::target_objects_list,
            commands::objects::target_objects_list_page,
            commands::objects::target_object_upload,
            commands::objects::target_object_download,
            commands::objects::target_objects_delete,
            commands::objects::target_folder_create,
            commands::objects::target_bucket_stats,
            commands::objects::target_objects_list_recursive,
            commands::objects::target_objects_download_zip,
            commands::objects::target_object_presign,
            commands::files::list_directory_files,
            commands::settings::settings_get,
            commands::settings::settings_upsert,
            commands::sync::sync_profiles_list,
            commands::sync::sync_profiles_upsert,
            commands::sync::sync_profiles_delete,
            commands::transfers::transfer_queue_list,
            commands::transfers::transfer_queue_upsert,
            commands::transfers::transfer_queue_delete,
            commands::transfers::transfer_queue_clear_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
