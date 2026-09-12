mod commands;
mod domain;
mod infrastructure;

use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(commands::AppState::new().expect("failed to initialize WeiScheduler data store"));
    let scheduler_state = state.clone();
    tauri::Builder::default()
        .manage(state)
        .setup(move |_app| {
            tauri::async_runtime::spawn(commands::scheduler_loop(scheduler_state));
            Ok(())
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
