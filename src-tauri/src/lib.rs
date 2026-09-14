mod commands;
mod domain;
mod infrastructure;

use std::sync::Arc;

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(commands::AppState::new().expect("failed to initialize WeiScheduler data store"));
    let scheduler_state = state.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .manage(state)
        .setup(move |_app| {
            #[cfg(desktop)]
            {
                let show_item = MenuItem::with_id(_app, "show", "显示主窗口", true, None::<&str>)?;
                let separator = PredefinedMenuItem::separator(_app)?;
                let quit_item = MenuItem::with_id(_app, "quit", "退出程序", true, None::<&str>)?;
                let menu = Menu::with_items(_app, &[&show_item, &separator, &quit_item])?;

                TrayIconBuilder::with_id("main-tray")
                    .icon(_app.default_window_icon().cloned().expect("default window icon is required"))
                    .tooltip("WJ 超级调度器")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "show" => show_main_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            show_main_window(tray.app_handle());
                        }
                    })
                    .build(_app)?;
            }

            tauri::async_runtime::spawn(commands::scheduler_loop(scheduler_state));
            Ok(())
        })
        .on_window_event(|window, event| {
            #[cfg(desktop)]
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                WindowEvent::Resized(_) if window.is_minimized().unwrap_or(false) => {
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_tasks,
            commands::save_task,
            commands::delete_task,
            commands::run_task,
            commands::stop_task,
            commands::set_task_enabled,
            commands::clear_task_logs,
            commands::export_tasks,
            commands::import_tasks,
            commands::data_directory,
            commands::open_data_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running WeiScheduler");
}

#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
