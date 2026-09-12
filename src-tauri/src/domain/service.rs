use super::task::{Execution, Task, TaskInput};
use chrono::Utc;
use cron::Schedule;
use std::path::Path;
use std::str::FromStr;
use uuid::Uuid;

pub fn validate_schedule(expression: &str) -> Result<(), String> {
    let expression = expression.trim();
    let parts: Vec<&str> = expression.split_whitespace().collect();
    if parts.len() != 5 {
        return Err("Cron 表达式必须包含 5 段".into());
    }
    Schedule::from_str(&format!("0 {expression}"))
        .map(|_| ())
        .map_err(|_| "Cron 表达式无效".into())
}

pub fn validate_input(input: &TaskInput) -> Result<(), String> {
    if input.name.trim().is_empty() { return Err("任务名称不能为空".into()); }
    if !["python", "conda-name", "conda-path", "cmd"].contains(&input.runner_type.as_str()) {
        return Err("执行方式无效".into());
    }
    if input.runner_type == "python" && input.command_path.trim().is_empty() { return Err("Python 环境路径不能为空".into()); }
    if input.runner_type.starts_with("conda") && input.conda_target.trim().is_empty() { return Err("Conda 目标不能为空".into()); }
    if input.script_path.trim().is_empty() { return Err(if input.runner_type == "cmd" { "CMD 命令不能为空" } else { "Python 脚本路径不能为空" }.into()); }
    validate_schedule(&input.schedule)
}

pub fn task_from_input(input: TaskInput, existing: Option<&Task>) -> Result<Task, String> {
    validate_input(&input)?;
    let now = Utc::now().to_rfc3339();
    Ok(Task {
        id: input.id.or_else(|| existing.map(|task| task.id.clone())).unwrap_or_else(|| format!("task_{}", Utc::now().timestamp_millis())),
        name: input.name.trim().into(),
        runner_type: input.runner_type,
        command_path: input.command_path.trim().into(),
        conda_target: input.conda_target.trim().into(),
        script_path: input.script_path.trim().into(),
        args: input.args.trim().into(),
        time_arg_name: input.time_arg_name.trim().into(),
        time_arg_value: input.time_arg_value.trim().into(),
        working_directory: input.working_directory.trim().into(),
        schedule: input.schedule.trim().into(),
        enabled: input.enabled,
        created_at: existing.map(|task| task.created_at.clone()).unwrap_or_else(|| now.clone()),
        updated_at: now,
        last_run_at: existing.and_then(|task| task.last_run_at.clone()),
        last_status: existing.map(|task| task.last_status.clone()).unwrap_or_else(|| "never".into()),
        last_error: existing.map(|task| task.last_error.clone()).unwrap_or_default(),
        logs: existing.map(|task| task.logs.clone()).unwrap_or_default(),
    })
}

pub fn build_execution(task: &Task) -> Result<Execution, String> {
    let mut args = split_args(&task.args);
    if !task.time_arg_name.is_empty() {
        args.push(task.time_arg_name.clone());
        args.push(format_time_arg(&task.time_arg_value));
    }
    let working_directory = working_directory(task);
    match task.runner_type.as_str() {
        "python" => { args.insert(0, task.script_path.clone()); Ok(Execution { command: task.command_path.clone(), args, working_directory }) }
        "conda-name" | "conda-path" => {
            let mode = if task.runner_type == "conda-name" { "-n" } else { "-p" };
            let user_args = args;
            args = vec!["run".into(), "--no-capture-output".into(), mode.into(), task.conda_target.clone(), "python".into(), task.script_path.clone()];
            args.extend(user_args);
            Ok(Execution { command: if task.command_path.is_empty() { "conda".into() } else { task.command_path.clone() }, args, working_directory })
        }
        "cmd" => Ok(Execution { command: "cmd.exe".into(), args: vec!["/C".into(), task.script_path.clone()], working_directory }),
        _ => Err("执行方式无效".into()),
    }
}

fn working_directory(task: &Task) -> Option<String> {
    if !task.working_directory.is_empty() { return Some(task.working_directory.clone()); }
    Path::new(&task.script_path).parent().map(|path| path.to_string_lossy().into_owned()).filter(|path| !path.is_empty())
}

fn format_time_arg(value: &str) -> String {
    if value.is_empty() { Utc::now().format("%Y-%m-%dT%H:%M:00").to_string() }
    else if value.len() == 16 && value.chars().nth(10) == Some('T') { format!("{value}:00") }
    else { value.to_owned() }
}

fn split_args(value: &str) -> Vec<String> {
    let mut output = Vec::new(); let mut current = String::new(); let mut quoted = false;
    for ch in value.chars() {
        match ch { '"' => quoted = !quoted, c if c.is_whitespace() && !quoted => { if !current.is_empty() { output.push(std::mem::take(&mut current)); } }, c => current.push(c) }
    }
    if !current.is_empty() { output.push(current); } output
}

pub fn next_run(expression: &str) -> Option<String> {
    let schedule = Schedule::from_str(&format!("0 {expression}")).ok()?;
    schedule.upcoming(Utc).next().map(|date| date.to_rfc3339())
}

pub fn is_due(expression: &str, now: chrono::DateTime<Utc>) -> bool {
    let Ok(schedule) = Schedule::from_str(&format!("0 {expression}")) else { return false };
    schedule.after(&(now - chrono::Duration::seconds(30))).next().is_some_and(|date| date <= now)
}

pub fn new_log_id() -> String { Uuid::new_v4().to_string() }
