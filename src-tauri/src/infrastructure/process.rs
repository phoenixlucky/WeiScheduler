use crate::domain::{service, task::{RunLog, Task}};
use chrono::Utc;
use std::process::Stdio;
use tokio::process::Command;

pub async fn run(task: &Task, execution_id: &str, attempt: u32, max_attempts: u32) -> Result<(RunLog, tokio::process::Child), String> {
    let execution = service::build_execution(task)?;
    let mut command = Command::new(&execution.command);
    command.args(&execution.args).envs(execution.environment.iter().map(|(key, value)| (key, value))).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(directory) = &execution.working_directory { command.current_dir(directory); }
    let child = command.spawn().map_err(|error| format!("启动任务失败: {error}"))?;
    Ok((RunLog { id: service::new_log_id(), execution_id: execution_id.into(), attempt, max_attempts, started_at: Utc::now().to_rfc3339(), finished_at: None, status: "running".into(), command: execution.command, command_args: execution.args, stdout: String::new(), stderr: String::new() }, child))
}
