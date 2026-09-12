import { invoke } from "@tauri-apps/api/core";
import type { Task, TaskInput } from "../types/task";

const isTauri = () => Boolean(window.__TAURI_INTERNALS__);

export async function listTasks(): Promise<Task[]> {
  if (!isTauri()) return [];
  return invoke<Task[]>("list_tasks");
}

export function saveTask(task: TaskInput): Promise<Task> {
  return invoke<Task>("save_task", { task });
}

export function deleteTask(id: string): Promise<void> {
  return invoke("delete_task", { taskId: id });
}

export function runTask(id: string): Promise<void> {
  return invoke("run_task", { taskId: id });
}

export function stopTask(id: string): Promise<void> {
  return invoke("stop_task", { taskId: id });
}

export function setTaskEnabled(id: string, enabled: boolean): Promise<Task> {
  return invoke<Task>("set_task_enabled", { taskId: id, enabled });
}

export function clearTaskLogs(id: string): Promise<void> {
  return invoke("clear_task_logs", { taskId: id });
}

export function exportTasks(): Promise<string> {
  return invoke<string>("export_tasks");
}

export function importTasks(payload: string): Promise<number> {
  return invoke<number>("import_tasks", { payload });
}

export function openDataDirectory(): Promise<void> {
  return invoke("open_data_directory");
}

export function dataDirectory(): Promise<string> {
  return invoke<string>("data_directory");
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}
