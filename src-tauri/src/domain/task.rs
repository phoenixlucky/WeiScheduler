use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub id: Option<String>,
    pub name: String,
    #[serde(default = "default_runner_type")]
    pub runner_type: String,
    #[serde(default, alias = "pythonPath")]
    pub command_path: String,
    #[serde(default)]
    pub conda_target: String,
    #[serde(default)]
    pub script_path: String,
    #[serde(default)]
    pub args: String,
    #[serde(default)]
    pub time_arg_name: String,
    #[serde(default)]
    pub time_arg_value: String,
    #[serde(default)]
    pub working_directory: String,
    #[serde(default)]
    pub environment: Vec<EnvironmentVariable>,
    #[serde(default)]
    pub retry_count: u32,
    #[serde(default = "default_retry_delay_seconds")]
    pub retry_delay_seconds: u64,
    pub schedule: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    #[serde(default = "default_runner_type")]
    pub runner_type: String,
    #[serde(default, alias = "pythonPath")]
    pub command_path: String,
    #[serde(default)]
    pub conda_target: String,
    #[serde(default)]
    pub script_path: String,
    #[serde(default)]
    pub args: String,
    #[serde(default)]
    pub time_arg_name: String,
    #[serde(default)]
    pub time_arg_value: String,
    #[serde(default)]
    pub working_directory: String,
    #[serde(default)]
    pub environment: Vec<EnvironmentVariable>,
    #[serde(default)]
    pub retry_count: u32,
    #[serde(default = "default_retry_delay_seconds")]
    pub retry_delay_seconds: u64,
    #[serde(default)]
    pub schedule: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    pub last_run_at: Option<String>,
    #[serde(default = "default_status")]
    pub last_status: String,
    #[serde(default)]
    pub last_error: String,
    #[serde(default)]
    pub logs: Vec<RunLog>,
}

fn default_runner_type() -> String { "python".into() }
fn default_status() -> String { "never".into() }
fn default_retry_delay_seconds() -> u64 { 60 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentVariable {
    pub key: String,
    #[serde(default)]
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunLog {
    pub id: String,
    #[serde(default)]
    pub execution_id: String,
    #[serde(default = "default_attempt")]
    pub attempt: u32,
    #[serde(default = "default_attempt")]
    pub max_attempts: u32,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: String,
    pub command: String,
    pub command_args: Vec<String>,
    pub stdout: String,
    pub stderr: String,
}

fn default_attempt() -> u32 { 1 }

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskView {
    #[serde(flatten)]
    pub task: Task,
    pub running: bool,
    pub next_run_at: Option<String>,
    pub live_log: Option<RunLog>,
}

#[derive(Debug, Clone)]
pub struct Execution {
    pub command: String,
    pub args: Vec<String>,
    pub working_directory: Option<String>,
    pub environment: Vec<(String, String)>,
}
