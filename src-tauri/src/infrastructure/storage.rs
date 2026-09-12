use crate::domain::task::Task;
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, sync::{Arc, Mutex}, time::{SystemTime, UNIX_EPOCH}};

#[derive(Debug, Serialize, Deserialize)]
struct Store { tasks: Vec<Task> }

#[derive(Clone)]
pub struct Repository {
    file: PathBuf,
    // UI commands and the scheduler share this lock for read-modify-write.
    write_lock: Arc<Mutex<()>>,
}

impl Repository {
    pub fn new() -> Result<Self, String> {
        let root = std::env::var_os("WEISCHEDULER_DATA_DIR")
            .map(PathBuf::from)
            .or_else(portable_data_dir)
            .or_else(|| dirs::data_dir().map(|path| path.join("WeiScheduler")))
            .ok_or_else(|| "无法定位应用数据目录".to_string())?.join("data");
        fs::create_dir_all(&root).map_err(|error| format!("创建数据目录失败: {error}"))?;
        let file = root.join("tasks.json");
        migrate_legacy_store(&file)?;
        if !file.exists() { fs::write(&file, r#"{"tasks":[]}"#).map_err(|error| format!("初始化任务存储失败: {error}"))?; }
        Ok(Self { file, write_lock: Arc::new(Mutex::new(())) })
    }

    pub fn path(&self) -> &PathBuf { &self.file }

    pub fn list(&self) -> Result<Vec<Task>, String> {
        let _guard = self.write_lock.lock().map_err(|_| "任务存储锁已损坏".to_string())?;
        self.read_unlocked()
    }

    pub fn transaction<F, R>(&self, update: F) -> Result<R, String>
    where
        F: FnOnce(&mut Vec<Task>) -> Result<R, String>,
    {
        let _guard = self.write_lock.lock().map_err(|_| "任务存储锁已损坏".to_string())?;
        let mut tasks = self.read_unlocked()?;
        let result = update(&mut tasks)?;
        self.write_unlocked(&tasks)?;
        Ok(result)
    }

    fn read_unlocked(&self) -> Result<Vec<Task>, String> {
        let content = fs::read_to_string(&self.file).map_err(|error| format!("读取任务存储失败: {error}"))?;
        let store: Store = serde_json::from_str(&content).map_err(|error| {
            let backup = self.file.with_extension(format!("json.broken-{}", unique_suffix()));
            let _ = fs::copy(&self.file, &backup);
            format!("任务存储格式错误: {error}；原文件已保留，备份: {}", backup.display())
        })?;
        Ok(store.tasks)
    }

    pub fn update_task<F>(&self, id: &str, update: F) -> Result<Task, String>
    where
        F: FnOnce(&mut Task),
    {
        let _guard = self.write_lock.lock().map_err(|_| "任务存储锁已损坏".to_string())?;
        let mut tasks = self.read_unlocked()?;
        let task = tasks.iter_mut().find(|task| task.id == id).ok_or_else(|| "任务不存在".to_string())?;
        update(task);
        let updated = task.clone();
        self.write_unlocked(&tasks)?;
        Ok(updated)
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let _guard = self.write_lock.lock().map_err(|_| "任务存储锁已损坏".to_string())?;
        let tasks = self.read_unlocked()?.into_iter().filter(|task| task.id != id).collect::<Vec<_>>();
        self.write_unlocked(&tasks)
    }

    fn write_unlocked(&self, tasks: &[Task]) -> Result<(), String> {
        let content = serde_json::to_string_pretty(&Store { tasks: tasks.to_vec() }).map_err(|error| error.to_string())?;
        let tmp = self.file.with_extension(format!("json.tmp-{}-{}", std::process::id(), unique_suffix()));
        fs::write(&tmp, content).map_err(|error| format!("写入任务存储失败: {error}"))?;
        commit_temp_file(&tmp, &self.file)
    }
}

/// A portable package contains this marker next to the executable. Checking
/// it here keeps the portable build portable even when the user starts the
/// executable directly instead of using a launcher script.
fn portable_data_dir() -> Option<PathBuf> {
    let executable = std::env::current_exe().ok()?;
    let directory = executable.parent()?;
    let marker = directory.join("portable.mode");
    marker.is_file().then(|| directory.to_path_buf())
}

fn commit_temp_file(tmp: &Path, target: &Path) -> Result<(), String> {
    #[cfg(not(windows))]
    {
        fs::rename(tmp, target).map_err(|error| { let _ = fs::remove_file(tmp); format!("提交任务存储失败: {error}") })
    }

    #[cfg(windows)]
    {
        if !target.exists() {
            return fs::rename(tmp, target).map_err(|error| { let _ = fs::remove_file(tmp); format!("提交任务存储失败: {error}") });
        }

        // Windows does not replace an existing destination with std::fs::rename.
        // Keep a recoverable backup while swapping the fully-written temp file.
        let backup = target.with_extension(format!("json.replace-{}", unique_suffix()));
        fs::rename(target, &backup).map_err(|error| { let _ = fs::remove_file(tmp); format!("准备提交任务存储失败: {error}") })?;
        if let Err(error) = fs::rename(tmp, target) {
            let _ = fs::rename(&backup, target);
            let _ = fs::remove_file(tmp);
            return Err(format!("提交任务存储失败: {error}"));
        }
        let _ = fs::remove_file(backup);
        Ok(())
    }
}

fn unique_suffix() -> u128 { SystemTime::now().duration_since(UNIX_EPOCH).map(|duration| duration.as_nanos()).unwrap_or_default() }

fn migrate_legacy_store(target: &PathBuf) -> Result<(), String> {
    if target.exists() {
        let current = fs::read_to_string(target).map_err(|error| format!("读取现有任务存储失败: {error}"))?;
        let current_store: Store = match serde_json::from_str(&current) {
            Ok(store) => store,
            Err(_) => return Ok(()),
        };
        if !current_store.tasks.is_empty() { return Ok(()); }
    }

    let mut candidates = Vec::new();
    if let Ok(current_dir) = std::env::current_dir() { candidates.push(current_dir.join("data").join("tasks.json")); }
    if let Ok(executable) = std::env::current_exe() { candidates.push(executable.parent().unwrap_or(executable.as_path()).join("data").join("tasks.json")); }
    for candidate in candidates {
        if candidate == *target || !candidate.exists() { continue; }
        let content = match fs::read_to_string(&candidate) { Ok(content) => content, Err(_) => continue };
        let store: Store = match serde_json::from_str(&content) { Ok(store) => store, Err(_) => continue };
        if store.tasks.is_empty() { continue; }
        if target.exists() {
            let backup = target.with_extension(format!("json.pre-migration-{}", unique_suffix()));
            fs::copy(target, &backup).map_err(|error| format!("备份现有任务存储失败: {error}"))?;
        }
        fs::write(target, content).map_err(|error| format!("迁移旧任务存储失败: {error}"))?;
        break;
    }
    Ok(())
}
