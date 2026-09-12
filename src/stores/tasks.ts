import { computed, ref } from "vue";
import { defineStore } from "pinia";
import * as api from "../services/tauri";
import { emptyTask, type Task, type TaskInput } from "../types/task";

export const useTasksStore = defineStore("tasks", () => {
  const tasks = ref<Task[]>([]);
  const editing = ref<TaskInput>(emptyTask());
  const loading = ref(false);
  const error = ref("");
  const notice = ref("");
  let refreshTimer: number | undefined;

  const runningCount = computed(() => tasks.value.filter((task) => task.running).length);
  const enabledCount = computed(() => tasks.value.filter((task) => task.enabled).length);

  async function refresh() {
    loading.value = true;
    try {
      tasks.value = await api.listTasks();
      error.value = "";
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "无法读取任务";
    } finally {
      loading.value = false;
    }
  }

  function startPolling(interval = 10_000) {
    window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(refresh, interval);
  }

  function stopPolling() {
    window.clearInterval(refreshTimer);
    refreshTimer = undefined;
  }

  function edit(task: Task) {
    const { running: _running, nextRunAt: _nextRunAt, liveLog: _liveLog, ...draft } = task;
    editing.value = { ...draft, id: task.id };
  }

  function reset() {
    editing.value = emptyTask();
  }

  async function save() {
    await api.saveTask(editing.value);
    notice.value = editing.value.id ? "任务已更新" : "任务已创建";
    reset();
    await refresh();
  }

  async function remove(task: Task) {
    await api.deleteTask(task.id);
    if (editing.value.id === task.id) reset();
    notice.value = `已删除「${task.name}」`;
    await refresh();
  }

  async function toggle(task: Task) {
    await api.setTaskEnabled(task.id, !task.enabled);
    await refresh();
  }

  async function run(task: Task) {
    await api.runTask(task.id);
    notice.value = `已启动「${task.name}」`;
    await refresh();
  }

  async function stop(task: Task) {
    await api.stopTask(task.id);
    notice.value = `正在终止「${task.name}」`;
    await refresh();
  }

  async function clearLogs(task: Task) {
    await api.clearTaskLogs(task.id);
    await refresh();
  }

  async function downloadExport() {
    const payload = await api.exportTasks();
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `weischeduler-tasks-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File) {
    const count = await api.importTasks(await file.text());
    notice.value = `已导入 ${count} 个任务`;
    await refresh();
  }

  return { tasks, editing, loading, error, notice, runningCount, enabledCount, refresh, startPolling, stopPolling, edit, reset, save, remove, toggle, run, stop, clearLogs, downloadExport, importFile };
});
