use crate::{domain::{service, task::{RunLog, Task, TaskInput, TaskView}}, infrastructure::{crypto, process, storage::Repository}};
use chrono::Utc;
use serde_json::{json, Value};
use std::{collections::{HashMap, HashSet}, sync::Arc};
use tokio::{process::Child, sync::{Mutex, Notify}, time::{sleep, Duration}};

pub struct AppState {
    pub repository: Repository,
    pub processes: Mutex<HashMap<String, Arc<Mutex<Option<Child>>>>>,
    pub live_logs: Mutex<HashMap<String, RunLog>>,
    pub active_tasks: Mutex<HashSet<String>>,
    pub stop_signals: Mutex<HashMap<String, Arc<Notify>>>,
    pub stop_requested: Mutex<HashSet<String>>,
    pub triggered_minutes: Mutex<HashMap<String, String>>,
}

impl AppState {
    pub fn new() -> Result<Self, String> { Ok(Self { repository: Repository::new()?, processes: Mutex::new(HashMap::new()), live_logs: Mutex::new(HashMap::new()), active_tasks: Mutex::new(HashSet::new()), stop_signals: Mutex::new(HashMap::new()), stop_requested: Mutex::new(HashSet::new()), triggered_minutes: Mutex::new(HashMap::new()) }) }
}

pub type SharedState = Arc<AppState>;

#[tauri::command]
pub async fn list_tasks(state: tauri::State<'_, SharedState>) -> Result<Vec<TaskView>, String> {
    let tasks = state.repository.list()?;
    let active_tasks = state.active_tasks.lock().await;
    let live_logs = state.live_logs.lock().await;
    Ok(tasks.into_iter().map(|task| TaskView { next_run_at: if task.enabled { service::next_run(&task.schedule) } else { None }, running: active_tasks.contains(&task.id), live_log: live_logs.get(&task.id).cloned(), task }).collect())
}

#[tauri::command]
pub async fn save_task(state: tauri::State<'_, SharedState>, task: TaskInput) -> Result<Task, String> {
    state.repository.transaction(|tasks| {
        let existing = tasks.iter().find(|item| task.id.as_deref() == Some(item.id.as_str()));
        let task = service::task_from_input(task, existing)?;
        if let Some(index) = tasks.iter().position(|item| item.id == task.id) { tasks[index] = task.clone(); } else { tasks.push(task.clone()); }
        Ok(task)
    })
}

#[tauri::command]
pub async fn delete_task(state: tauri::State<'_, SharedState>, task_id: String) -> Result<(), String> {
    if state.active_tasks.lock().await.contains(&task_id) { return Err("任务正在运行，无法删除".into()); }
    if state.repository.list()?.iter().all(|task| task.id != task_id) { return Err("任务不存在".into()); }
    state.repository.delete(&task_id)
}

#[tauri::command]
pub async fn run_task(state: tauri::State<'_, SharedState>, task_id: String) -> Result<(), String> { run_task_inner(state.inner().clone(), task_id).await }

pub async fn run_task_inner(state: SharedState, task_id: String) -> Result<(), String> {
    let task = state.repository.list()?.into_iter().find(|item| item.id == task_id).ok_or_else(|| "任务不存在".to_string())?;
    {
        let mut active_tasks = state.active_tasks.lock().await;
        if !active_tasks.insert(task_id.clone()) { return Err("任务正在运行中".into()); }
    }
    let signal = Arc::new(Notify::new());
    state.stop_signals.lock().await.insert(task_id.clone(), signal.clone());
    let task_id_for_worker = task_id.clone();
    tokio::spawn(async move { execute_task(state, task_id_for_worker, task, signal).await; });
    Ok(())
}

async fn execute_task(state: SharedState, task_id: String, task: Task, stop_signal: Arc<Notify>) {
    let execution_id = service::new_log_id();
    let max_attempts = task.retry_count.saturating_add(1);
    let mut final_status = "failed";
    let mut final_error = String::new();

    for attempt in 1..=max_attempts {
        if take_stop_request(&state, &task_id).await {
            final_status = "stopped";
            break;
        }

        match process::run(&task, &execution_id, attempt, max_attempts).await {
            Ok((log, child)) => {
                state.live_logs.lock().await.insert(task_id.clone(), log.clone());
                state.processes.lock().await.insert(task_id.clone(), Arc::new(Mutex::new(Some(child))));
                let child = state.processes.lock().await.get(&task_id).cloned();
                let output = match child {
                    Some(child) => match child.lock().await.take() {
                        Some(process) => process.wait_with_output().await.map_err(|error| error.to_string()),
                        None => Err("任务进程不存在".into()),
                    },
                    None => Err("任务进程不存在".into()),
                };
                state.processes.lock().await.remove(&task_id);
                let stopped = take_stop_request(&state, &task_id).await;
                let (status, stdout, stderr) = match output {
                    Ok(output) => (if stopped { "stopped" } else if output.status.success() { "success" } else { "failed" }, String::from_utf8_lossy(&output.stdout).into_owned(), String::from_utf8_lossy(&output.stderr).into_owned()),
                    Err(error) => (if stopped { "stopped" } else { "failed" }, String::new(), error),
                };
                let finished_at = Utc::now().to_rfc3339();
                let finished_log = RunLog { finished_at: Some(finished_at.clone()), status: status.into(), stdout, stderr: stderr.clone(), ..log };
                persist_attempt(&state, &task_id, &finished_log, &finished_at, status, &stderr).await;
                final_status = status;
                final_error = stderr;
                if status != "failed" || attempt == max_attempts { break; }
            }
            Err(error) => {
                let finished_at = Utc::now().to_rfc3339();
                let (command, command_args) = service::build_execution(&task).map(|execution| (execution.command, execution.args)).unwrap_or_default();
                let failed_log = RunLog { id: service::new_log_id(), execution_id: execution_id.clone(), attempt, max_attempts, started_at: finished_at.clone(), finished_at: Some(finished_at.clone()), status: "failed".into(), command, command_args, stdout: String::new(), stderr: error.clone() };
                persist_attempt(&state, &task_id, &failed_log, &finished_at, "failed", &error).await;
                final_status = "failed";
                final_error = error;
                if attempt == max_attempts { break; }
            }
        }

        let _ = state.repository.update_task(&task_id, |stored| {
            stored.last_status = "retrying".into();
            stored.last_error = final_error.clone();
        });
        if wait_for_retry_or_stop(&state, &task_id, &stop_signal, task.retry_delay_seconds).await {
            final_status = "stopped";
            break;
        }
    }

    let _ = state.repository.update_task(&task_id, |stored| {
        stored.last_status = final_status.into();
        stored.last_error = if final_status == "failed" { final_error.clone() } else { String::new() };
    });
    state.processes.lock().await.remove(&task_id);
    state.live_logs.lock().await.remove(&task_id);
    state.stop_signals.lock().await.remove(&task_id);
    state.stop_requested.lock().await.remove(&task_id);
    state.active_tasks.lock().await.remove(&task_id);
}

async fn persist_attempt(state: &SharedState, task_id: &str, log: &RunLog, finished_at: &str, status: &str, stderr: &str) {
    let _ = state.repository.update_task(task_id, |task| {
        task.last_run_at = Some(finished_at.into());
        task.last_status = status.into();
        task.last_error = if status == "failed" { stderr.into() } else { String::new() };
        task.logs.insert(0, log.clone());
        task.logs.truncate(30);
    });
}

async fn take_stop_request(state: &SharedState, task_id: &str) -> bool {
    state.stop_requested.lock().await.remove(task_id)
}

async fn wait_for_retry_or_stop(state: &SharedState, task_id: &str, signal: &Notify, seconds: u64) -> bool {
    if state.stop_requested.lock().await.contains(task_id) { return true; }
    tokio::select! {
        _ = sleep(Duration::from_secs(seconds)) => false,
        _ = signal.notified() => true,
    }
}

#[tauri::command]
pub async fn stop_task(state: tauri::State<'_, SharedState>, task_id: String) -> Result<(), String> {
    let child = state.processes.lock().await.get(&task_id).cloned();
    let signal = state.stop_signals.lock().await.get(&task_id).cloned();
    if child.is_none() && signal.is_none() { return Err("任务未在运行".to_string()); }
    state.stop_requested.lock().await.insert(task_id.clone());
    if let Some(log) = state.live_logs.lock().await.get_mut(&task_id) { log.status = "stopping".into(); }
    if let Some(signal) = signal { signal.notify_waiters(); }
    let result = if let Some(child) = child {
        let mut process = child.lock().await;
        match process.as_mut() { Some(process) => process.kill().await, None => Ok(()) }
    } else { Ok(()) };
    result.map_err(|error| format!("终止任务失败: {error}"))
}

#[tauri::command]
pub async fn set_task_enabled(state: tauri::State<'_, SharedState>, task_id: String, enabled: bool) -> Result<Task, String> {
    state.repository.update_task(&task_id, |task| {
        task.enabled = enabled;
        task.updated_at = Utc::now().to_rfc3339();
    })
}

#[tauri::command]
pub async fn clear_task_logs(state: tauri::State<'_, SharedState>, task_id: String) -> Result<(), String> {
    state.repository.update_task(&task_id, |task| {
        task.logs.clear();
        task.last_error.clear();
    }).map(|_| ())
}

#[tauri::command]
pub async fn export_tasks(state: tauri::State<'_, SharedState>) -> Result<String, String> {
    let tasks = state.repository.list()?;
    let canonical = serde_json::to_string(&tasks).map_err(|error| error.to_string())?;
    serde_json::to_string_pretty(&json!({ "version": 3, "exportedAt": Utc::now().to_rfc3339(), "checksum": crypto::sha256_hex(&canonical), "tasks": tasks })).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn import_tasks(state: tauri::State<'_, SharedState>, payload: String) -> Result<usize, String> {
    let value: Value = serde_json::from_str(&payload).map_err(|error| format!("导入 JSON 无效: {error}"))?;
    let raw_tasks = value.as_array().cloned().or_else(|| value.get("tasks").and_then(Value::as_array).cloned()).ok_or_else(|| "导入内容不能为空".to_string())?;
    if raw_tasks.is_empty() { return Err("导入内容不能为空".into()); }
    state.repository.transaction(|current| {
        let mut imported = 0;
        for raw in raw_tasks {
            let mut task = parse_import_task(raw)?;
            service::validate_task(&task)?;
            if let Some(existing) = current.iter().find(|item| item.name == task.name || item.id == task.id) { task.id = existing.id.clone(); task.created_at = existing.created_at.clone(); }
            current.retain(|item| item.id != task.id); current.push(task); imported += 1;
        }
        Ok(imported)
    })
}

fn parse_import_task(raw: Value) -> Result<Task, String> {
    let mut object = raw.as_object().cloned().ok_or_else(|| "导入任务格式无效".to_string())?;

    // The legacy Electron format called this field pythonPath. It was used
    // for both Python and Conda command paths.
    let command_path_is_empty = object.get("commandPath").and_then(Value::as_str).map(str::is_empty).unwrap_or(true);
    if command_path_is_empty {
        if let Some(python_path) = object.get("pythonPath").cloned() {
            object.insert("commandPath".into(), python_path);
        }
    }
    object.remove("pythonPath");
    object.entry("runnerType").or_insert_with(|| json!("python"));
    object.entry("args").or_insert_with(|| json!(""));
    object.entry("timeArgName").or_insert_with(|| json!(""));
    object.entry("timeArgValue").or_insert_with(|| json!(""));
    object.entry("workingDirectory").or_insert_with(|| json!(""));
    object.entry("condaTarget").or_insert_with(|| json!(""));
    object.entry("environment").or_insert_with(|| json!([]));
    object.entry("retryCount").or_insert_with(|| json!(0));
    object.entry("retryDelaySeconds").or_insert_with(|| json!(60));
    object.entry("enabled").or_insert_with(|| json!(false));

    let normalized = Value::Object(object);
    if let Ok(task) = serde_json::from_value::<Task>(normalized.clone()) {
        service::validate_task(&task)?;
        return Ok(task);
    }
    let input = serde_json::from_value::<TaskInput>(normalized).map_err(|error| format!("导入任务格式无效: {error}"))?;
    service::task_from_input(input, None)
}

#[tauri::command]
pub fn data_directory(state: tauri::State<'_, SharedState>) -> Result<String, String> { Ok(state.repository.path().parent().and_then(|path| path.parent()).unwrap_or(state.repository.path()).to_string_lossy().into_owned()) }

#[tauri::command]
pub fn open_data_directory(state: tauri::State<'_, SharedState>) -> Result<(), String> {
    let path = data_directory(state)?;
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let program = "xdg-open";
    std::process::Command::new(program).arg(&path).spawn().map_err(|error| error.to_string())?;
    Ok(())
}

pub async fn scheduler_loop(state: SharedState) {
    loop {
        let now = Utc::now();
        if let Ok(tasks) = state.repository.list() {
            for task in tasks.into_iter().filter(|task| task.enabled) {
                let minute = now.format("%Y-%m-%dT%H:%M").to_string();
                let due = service::is_due(&task.schedule, now);
                let mut triggered = state.triggered_minutes.lock().await;
                if due && triggered.get(&task.id) != Some(&minute) {
                    triggered.insert(task.id.clone(), minute);
                    drop(triggered);
                    let _ = run_task_inner(state.clone(), task.id).await;
                }
            }
        }
        sleep(Duration::from_secs(30)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::parse_import_task;
    use serde_json::json;

    #[test]
    fn imports_legacy_python_path_payload() {
        let task = parse_import_task(json!({
            "name": "旧版任务",
            "pythonPath": "C:\\Python\\python.exe",
            "scriptPath": "C:\\jobs\\job.py",
            "schedule": "0 9 * * *",
            "enabled": true
        })).expect("legacy task should import");

        assert_eq!(task.command_path, "C:\\Python\\python.exe");
        assert_eq!(task.runner_type, "python");
        assert_eq!(task.schedule, "0 9 * * *");
    }

    #[test]
    fn imports_new_defaults_for_legacy_task() {
        let task = parse_import_task(json!({
            "name": "旧版可执行任务",
            "runnerType": "executable",
            "commandPath": "node",
            "schedule": "0 9 * * *",
            "enabled": true
        })).expect("task should import");

        assert!(task.environment.is_empty());
        assert_eq!(task.retry_count, 0);
        assert_eq!(task.retry_delay_seconds, 60);
    }
}
