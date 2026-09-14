use super::task::{Execution, Task, TaskInput};
use chrono::Utc;
use cron::Schedule;
use std::path::Path;
use std::str::FromStr;
use uuid::Uuid;

const MAX_RETRY_COUNT: u32 = 5;
const MAX_RETRY_DELAY_SECONDS: u64 = 86_400;

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
    if !["python", "conda-name", "conda-path", "cmd", "executable"].contains(&input.runner_type.as_str()) {
        return Err("执行方式无效".into());
    }
    if input.runner_type == "python" && input.command_path.trim().is_empty() { return Err("Python 环境路径不能为空".into()); }
    if input.runner_type.starts_with("conda") && input.conda_target.trim().is_empty() { return Err("Conda 目标不能为空".into()); }
    if input.runner_type == "executable" && input.command_path.trim().is_empty() { return Err("可执行程序路径不能为空".into()); }
    if !input.runner_type.eq("executable") && input.script_path.trim().is_empty() { return Err(if input.runner_type == "cmd" { "CMD 命令不能为空" } else { "Python 脚本路径不能为空" }.into()); }
    if input.retry_count > MAX_RETRY_COUNT { return Err(format!("重试次数不能超过 {MAX_RETRY_COUNT}")); }
    if input.retry_delay_seconds > MAX_RETRY_DELAY_SECONDS { return Err(format!("重试间隔不能超过 {MAX_RETRY_DELAY_SECONDS} 秒")); }
    let mut environment_keys = std::collections::HashSet::new();
    for variable in &input.environment {
        let key = variable.key.trim();
        if key.is_empty() { return Err("环境变量名称不能为空".into()); }
        if key.contains('=') || key.contains('\0') { return Err(format!("环境变量名称无效：{key}")); }
        if variable.value.contains('\0') { return Err(format!("环境变量值无效：{key}")); }
        if !environment_keys.insert(key.to_ascii_lowercase()) { return Err(format!("环境变量重复：{key}")); }
    }
    validate_schedule(&input.schedule)
}

pub fn validate_task(task: &Task) -> Result<(), String> {
    validate_input(&TaskInput {
        id: Some(task.id.clone()), name: task.name.clone(), runner_type: task.runner_type.clone(), command_path: task.command_path.clone(), conda_target: task.conda_target.clone(), script_path: task.script_path.clone(), args: task.args.clone(), time_arg_name: task.time_arg_name.clone(), time_arg_value: task.time_arg_value.clone(), working_directory: task.working_directory.clone(), environment: task.environment.clone(), retry_count: task.retry_count, retry_delay_seconds: task.retry_delay_seconds, schedule: task.schedule.clone(), enabled: task.enabled,
    })
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
        environment: input.environment.into_iter().map(|variable| super::task::EnvironmentVariable { key: variable.key.trim().into(), value: variable.value }).collect(),
        retry_count: input.retry_count,
        retry_delay_seconds: input.retry_delay_seconds,
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
        "python" => { args.insert(0, task.script_path.clone()); Ok(Execution { command: task.command_path.clone(), args, working_directory, environment: environment(task) }) }
        "conda-name" | "conda-path" => {
            let mode = if task.runner_type == "conda-name" { "-n" } else { "-p" };
            let user_args = args;
            args = vec!["run".into(), "--no-capture-output".into(), mode.into(), task.conda_target.clone(), "python".into(), task.script_path.clone()];
            args.extend(user_args);
            Ok(Execution { command: if task.command_path.is_empty() { "conda".into() } else { task.command_path.clone() }, args, working_directory, environment: environment(task) })
        }
        "cmd" => Ok(Execution { command: "cmd.exe".into(), args: vec!["/C".into(), task.script_path.clone()], working_directory, environment: environment(task) }),
        "executable" => Ok(Execution { command: task.command_path.clone(), args, working_directory, environment: environment(task) }),
        _ => Err("执行方式无效".into()),
    }
}

fn environment(task: &Task) -> Vec<(String, String)> {
    task.environment.iter().map(|variable| (variable.key.clone(), variable.value.clone())).collect()
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::task::{EnvironmentVariable, Task};

    fn executable_task() -> Task {
        Task {
            id: "task_test".into(), name: "测试程序".into(), runner_type: "executable".into(),
            command_path: "node".into(), conda_target: String::new(), script_path: String::new(),
            args: "script.js --name \"hello world\"".into(), time_arg_name: String::new(), time_arg_value: String::new(),
            working_directory: "C:\\jobs".into(), environment: vec![EnvironmentVariable { key: "MODE".into(), value: "test".into() }],
            retry_count: 2, retry_delay_seconds: 60, schedule: "0 9 * * *".into(), enabled: true,
            created_at: String::new(), updated_at: String::new(), last_run_at: None, last_status: "never".into(), last_error: String::new(), logs: vec![],
        }
    }

    #[test]
    fn builds_direct_executable_with_arguments_and_environment() {
        let execution = build_execution(&executable_task()).expect("execution should build");
        assert_eq!(execution.command, "node");
        assert_eq!(execution.args, vec!["script.js", "--name", "hello world"]);
        assert_eq!(execution.working_directory.as_deref(), Some("C:\\jobs"));
        assert_eq!(execution.environment, vec![("MODE".into(), "test".into())]);
    }

    #[test]
    fn validates_retry_and_environment_limits() {
        let mut input = TaskInput {
            id: None, name: "test".into(), runner_type: "executable".into(), command_path: "node".into(), conda_target: String::new(), script_path: String::new(), args: String::new(), time_arg_name: String::new(), time_arg_value: String::new(), working_directory: String::new(), environment: vec![EnvironmentVariable { key: "PATH=BAD".into(), value: String::new() }], retry_count: 0, retry_delay_seconds: 60, schedule: "0 9 * * *".into(), enabled: true,
        };
        assert!(validate_input(&input).is_err());
        input.environment[0].key = "MODE".into();
        input.retry_count = MAX_RETRY_COUNT + 1;
        assert!(validate_input(&input).is_err());
    }
}
