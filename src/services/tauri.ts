import { invoke } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import type { Task, TaskInput } from "../types/task";

export const isTauri = () => Boolean(window.__TAURI_INTERNALS__);

const demoTasks: Task[] = [
  { id: "demo-order-callback", name: "订单状态回传", runnerType: "python", commandPath: "C:\\Python311\\python.exe", condaTarget: "", scriptPath: "D:\\jobs\\order_sync.py", args: "--source prod", timeArgName: "", timeArgValue: "", workingDirectory: "D:\\jobs", environment: [], retryCount: 2, retryDelaySeconds: 60, schedule: "55 * * * *", enabled: true, createdAt: "2026-09-01T08:00:00+08:00", updatedAt: "2026-09-14T14:55:00+08:00", lastRunAt: "2026-09-14T14:55:00+08:00", lastStatus: "success", lastError: "", logs: [], running: false, nextRunAt: "2026-09-14T15:55:00+08:00" },
  { id: "demo-order-extract", name: "订单状态提取", runnerType: "conda-name", commandPath: "conda", condaTarget: "data-prod", scriptPath: "D:\\jobs\\extract_orders.py", args: "--days 1", timeArgName: "", timeArgValue: "", workingDirectory: "D:\\jobs", environment: [], retryCount: 1, retryDelaySeconds: 30, schedule: "*/15 * * * *", enabled: true, createdAt: "2026-09-02T09:00:00+08:00", updatedAt: "2026-09-14T14:45:00+08:00", lastRunAt: "2026-09-14T14:45:00+08:00", lastStatus: "success", lastError: "", logs: [], running: false, nextRunAt: "2026-09-14T15:00:00+08:00" },
  { id: "demo-rate-fetch", name: "汇率抓取", runnerType: "executable", commandPath: "node", condaTarget: "", scriptPath: "", args: "scripts/fetch-rates.js", timeArgName: "", timeArgValue: "", workingDirectory: "D:\\jobs\\rates", environment: [], retryCount: 0, retryDelaySeconds: 60, schedule: "0 */3 * * *", enabled: true, createdAt: "2026-09-03T10:00:00+08:00", updatedAt: "2026-09-14T12:00:00+08:00", lastRunAt: "2026-09-14T12:00:00+08:00", lastStatus: "success", lastError: "", logs: [], running: false, nextRunAt: "2026-09-14T15:00:00+08:00" },
  { id: "demo-crm-sync", name: "客户系统同步", runnerType: "python", commandPath: "C:\\Python311\\python.exe", condaTarget: "", scriptPath: "D:\\jobs\\sync_crm.py", args: "--full", timeArgName: "", timeArgValue: "", workingDirectory: "D:\\jobs", environment: [], retryCount: 1, retryDelaySeconds: 60, schedule: "0 * * * *", enabled: true, createdAt: "2026-09-04T11:00:00+08:00", updatedAt: "2026-09-14T14:00:00+08:00", lastRunAt: "2026-09-14T14:00:00+08:00", lastStatus: "success", lastError: "", logs: [], running: true, nextRunAt: "2026-09-14T15:00:00+08:00", liveLog: { id: "demo-live-log", executionId: "demo-execution", attempt: 1, maxAttempts: 2, startedAt: "2026-09-14T14:00:00+08:00", status: "running", command: "python.exe", commandArgs: ["sync_crm.py", "--full"], stdout: "正在同步客户数据…", stderr: "" } },
  { id: "demo-crawler-clean", name: "爬虫数据清洗", runnerType: "cmd", commandPath: "cmd.exe", condaTarget: "", scriptPath: "D:\\jobs\\clean_crawler.bat", args: "", timeArgName: "", timeArgValue: "", workingDirectory: "D:\\jobs", environment: [], retryCount: 0, retryDelaySeconds: 60, schedule: "0 */6 * * *", enabled: false, createdAt: "2026-09-05T12:00:00+08:00", updatedAt: "2026-09-14T06:00:00+08:00", lastRunAt: "2026-09-14T06:00:00+08:00", lastStatus: "stopped", lastError: "", logs: [], running: false, nextRunAt: null },
  { id: "demo-report-failed", name: "日报生成", runnerType: "python", commandPath: "C:\\Python311\\python.exe", condaTarget: "", scriptPath: "D:\\jobs\\daily_report.py", args: "--date today", timeArgName: "", timeArgValue: "", workingDirectory: "D:\\jobs", environment: [], retryCount: 1, retryDelaySeconds: 120, schedule: "0 9 * * 1-5", enabled: true, createdAt: "2026-09-06T13:00:00+08:00", updatedAt: "2026-09-14T09:02:00+08:00", lastRunAt: "2026-09-14T09:02:00+08:00", lastStatus: "failed", lastError: "报表数据源连接超时", logs: [], running: false, nextRunAt: "2026-09-15T09:00:00+08:00" },
];

let browserTasks = demoTasks.map((task) => ({ ...task, environment: [...task.environment] }));

export async function listTasks(): Promise<Task[]> {
  if (!isTauri()) return browserTasks.map((task) => ({ ...task, environment: [...task.environment] }));
  return invoke<Task[]>("list_tasks");
}

export function saveTask(task: TaskInput): Promise<Task> {
  if (!isTauri()) {
    const now = new Date().toISOString();
    const existingIndex = task.id ? browserTasks.findIndex((item) => item.id === task.id) : -1;
    const saved: Task = { ...task, id: task.id || `demo-${Date.now()}`, createdAt: existingIndex >= 0 ? browserTasks[existingIndex].createdAt : now, updatedAt: now, lastRunAt: existingIndex >= 0 ? browserTasks[existingIndex].lastRunAt : null, lastStatus: existingIndex >= 0 ? browserTasks[existingIndex].lastStatus : "never", lastError: existingIndex >= 0 ? browserTasks[existingIndex].lastError : "", logs: existingIndex >= 0 ? browserTasks[existingIndex].logs : [], running: existingIndex >= 0 ? browserTasks[existingIndex].running : false, nextRunAt: task.enabled ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null };
    if (existingIndex >= 0) browserTasks[existingIndex] = saved;
    else browserTasks.push(saved);
    return Promise.resolve(saved);
  }
  return invoke<Task>("save_task", { task });
}

export function deleteTask(id: string): Promise<void> {
  if (!isTauri()) { browserTasks = browserTasks.filter((task) => task.id !== id); return Promise.resolve(); }
  return invoke("delete_task", { taskId: id });
}

export function runTask(id: string): Promise<void> {
  if (!isTauri()) { browserTasks = browserTasks.map((task) => task.id === id ? { ...task, running: true, lastStatus: "running" } : task); return Promise.resolve(); }
  return invoke("run_task", { taskId: id });
}

export function stopTask(id: string): Promise<void> {
  if (!isTauri()) { browserTasks = browserTasks.map((task) => task.id === id ? { ...task, running: false, lastStatus: "stopped" } : task); return Promise.resolve(); }
  return invoke("stop_task", { taskId: id });
}

export function setTaskEnabled(id: string, enabled: boolean): Promise<Task> {
  if (!isTauri()) { const task = browserTasks.find((item) => item.id === id); if (!task) return Promise.reject(new Error("任务不存在")); task.enabled = enabled; task.nextRunAt = enabled ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null; return Promise.resolve(task); }
  return invoke<Task>("set_task_enabled", { taskId: id, enabled });
}

export function clearTaskLogs(id: string): Promise<void> {
  if (!isTauri()) { browserTasks = browserTasks.map((task) => task.id === id ? { ...task, logs: [], lastError: "" } : task); return Promise.resolve(); }
  return invoke("clear_task_logs", { taskId: id });
}

export function exportTasks(): Promise<string> {
  if (!isTauri()) return Promise.resolve(JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), tasks: browserTasks }, null, 2));
  return invoke<string>("export_tasks");
}

export function importTasks(payload: string): Promise<number> {
  if (!isTauri()) { const value = JSON.parse(payload) as { tasks?: Task[] } | Task[]; const imported = Array.isArray(value) ? value : value.tasks || []; browserTasks = imported; return Promise.resolve(imported.length); }
  return invoke<number>("import_tasks", { payload });
}

export function openDataDirectory(): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return invoke("open_data_directory");
}

export function dataDirectory(): Promise<string> {
  return invoke<string>("data_directory");
}

export async function isAutoStartEnabled(): Promise<boolean> {
  if (!isTauri()) return false;
  return isEnabled();
}

export async function setAutoStartEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  if (!isTauri()) throw new Error("开机自启动仅支持桌面应用");
  if (enabled) await enable();
  else await disable();
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}
