const taskForm = document.getElementById("task-form");
const taskList = document.getElementById("task-list");
const resetButton = document.getElementById("reset-form");
const refreshButton = document.getElementById("refresh-list");
const exportButton = document.getElementById("export-tasks");
const importButton = document.getElementById("import-tasks");
const importFileInput = document.getElementById("import-file");
const autoRefreshEnabledInput = document.getElementById("auto-refresh-enabled");
const autoRefreshIntervalInput = document.getElementById("auto-refresh-interval");
const formTitle = document.getElementById("form-title");
const taskTemplate = document.getElementById("task-template");
const scheduleInput = document.getElementById("schedule");
const cronMinuteInput = document.getElementById("cron-minute");
const cronHourInput = document.getElementById("cron-hour");
const cronDayInput = document.getElementById("cron-day");
const cronMonthInput = document.getElementById("cron-month");
const cronWeekdayInput = document.getElementById("cron-weekday");
const heroTotal = document.getElementById("hero-total");
const heroRunning = document.getElementById("hero-running");
const heroEnabled = document.getElementById("hero-enabled");
const AUTO_REFRESH_ENABLED_KEY = "weischeduler:auto-refresh-enabled";
const AUTO_REFRESH_INTERVAL_KEY = "weischeduler:auto-refresh-interval";
let loadTimer = null;
const expandedTaskIds = new Set();
const cronPartInputs = [cronMinuteInput, cronHourInput, cronDayInput, cronMonthInput, cronWeekdayInput];

// Simple-mode elements
const cronSimple = document.getElementById("cron-simple");
const cronAdvanced = document.getElementById("cron-advanced");
const cronModeTabs = document.querySelectorAll(".cron-mode-tab");
const cronFreqTabs = document.querySelectorAll(".cron-freq-tab");
const cronPanels = document.querySelectorAll(".cron-panel");

const cronSliderEveryN = document.getElementById("cron-slider-every-n");
const cronEveryNDisplay = document.getElementById("cron-every-n-display");
const cronSliderHourly = document.getElementById("cron-slider-hourly");
const cronHourlyDisplay = document.getElementById("cron-hourly-display");
const cronSliderMonthly = document.getElementById("cron-slider-monthly");
const cronMonthlyDisplay = document.getElementById("cron-monthly-display");

const cronDailyTime = document.getElementById("cron-daily-time");
const cronWeeklyTime = document.getElementById("cron-weekly-time");
const cronMonthlyTime = document.getElementById("cron-monthly-time");

const cronWeekdayGrid = document.getElementById("cron-weekday-grid");
const cronWeekdayBtns = cronWeekdayGrid?.querySelectorAll(".cron-weekday-btn");

let cronSimpleMode = true;

const beijingDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatDisplayTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : beijingDateTimeFormatter.format(date).replace(/\//g, "-");
}

function getAutoRefreshEnabled() {
  return autoRefreshEnabledInput.checked;
}

function getAutoRefreshInterval() {
  const interval = Number(autoRefreshIntervalInput.value);
  return Number.isFinite(interval) && interval > 0 ? interval : 10000;
}

function persistAutoRefreshPreferences() {
  window.localStorage.setItem(AUTO_REFRESH_ENABLED_KEY, String(getAutoRefreshEnabled()));
  window.localStorage.setItem(AUTO_REFRESH_INTERVAL_KEY, String(getAutoRefreshInterval()));
}

function hydrateAutoRefreshPreferences() {
  const savedEnabled = window.localStorage.getItem(AUTO_REFRESH_ENABLED_KEY);
  const savedInterval = window.localStorage.getItem(AUTO_REFRESH_INTERVAL_KEY);
  if (savedEnabled !== null) autoRefreshEnabledInput.checked = savedEnabled === "true";
  if (savedInterval && [...autoRefreshIntervalInput.options].some((o) => o.value === savedInterval)) {
    autoRefreshIntervalInput.value = savedInterval;
  }
}

function clearLoadTimer() {
  if (loadTimer) { window.clearTimeout(loadTimer); loadTimer = null; }
}

function scheduleAutoRefresh() {
  clearLoadTimer();
  if (!getAutoRefreshEnabled()) return;
  loadTimer = window.setTimeout(() => {
    loadTasks().catch((error) => {
      taskList.innerHTML = `<div class="empty-state">${error.message}</div>`;
    });
  }, getAutoRefreshInterval());
}

/* ─── Form helpers ────────────────────────────────────────────────── */

function formToPayload() {
  const formData = new FormData(taskForm);
  return {
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    runnerType: formData.get("runnerType"),
    commandPath: formData.get("commandPath"),
    condaTarget: formData.get("condaTarget"),
    scriptPath: formData.get("scriptPath"),
    args: formData.get("args"),
    timeArgName: formData.get("timeArgName"),
    timeArgValue: formData.get("timeArgValue"),
    workingDirectory: formData.get("workingDirectory"),
    schedule: formData.get("schedule"),
    enabled: document.getElementById("enabled").checked,
  };
}

function updateRunnerFields() {
  const runnerType = document.getElementById("runnerType").value;
  const condaRow = document.getElementById("conda-target-row");
  const commandPathRow = document.getElementById("command-path-row");
  const commandPath = document.getElementById("commandPath");
  const condaTarget = document.getElementById("condaTarget");
  const label = document.getElementById("command-path-label");

  if (runnerType === "python") {
    commandPathRow.style.display = "";
    condaRow.style.display = "none";
    commandPath.required = true;
    commandPath.placeholder = "例如：D:\\miniconda3\\envs\\py3143\\python.exe";
    label.textContent = "Python 路径";
    condaTarget.required = false;
  } else {
    commandPathRow.style.display = "";
    condaRow.style.display = "";
    commandPath.required = false;
    commandPath.placeholder = "可选：Miniconda 根目录或 conda.exe 路径";
    label.textContent = "Conda 命令路径";
    condaTarget.required = true;
  }
}

function resetForm() {
  taskForm.reset();
  document.getElementById("task-id").value = "";
  document.getElementById("enabled").checked = true;
  document.getElementById("runnerType").value = "python";
  updateRunnerFields();
  syncFromSchedule();
  formTitle.textContent = "新建任务";
}

/* ─── Log rendering ───────────────────────────────────────────────── */

function renderLog(task) {
  if (task.running && task.liveLog) {
    return [
      `[${task.liveLog.stopRequested ? "stopping" : "running"}] ${formatDisplayTime(task.liveLog.startedAt)} -> -`,
      `trigger: ${task.liveLog.trigger}`,
      "exitCode: -",
      "",
      task.liveLog.stdout ? `stdout:\n${task.liveLog.stdout}` : "stdout:\n<streaming>",
      "",
      task.liveLog.stderr ? `stderr:\n${task.liveLog.stderr}` : "stderr:\n<empty>",
    ].join("\n");
  }
  const [latest] = task.logs || [];
  if (!latest) return "暂无运行记录";
  return [
    `[${latest.status}] ${formatDisplayTime(latest.startedAt)} -> ${formatDisplayTime(latest.finishedAt)}`,
    `trigger: ${latest.trigger}`,
    `exitCode: ${latest.exitCode}`,
    "",
    latest.stdout ? `stdout:\n${latest.stdout}` : "stdout:\n<empty>",
    "",
    latest.stderr ? `stderr:\n${latest.stderr}` : "stderr:\n<empty>",
  ].join("\n");
}

/* ─── Cron helpers ────────────────────────────────────────────────── */

function describeSchedule(schedule) {
  const presets = {
    "*/5 * * * *": "每 5 分钟", "*/10 * * * *": "每 10 分钟",
    "*/15 * * * *": "每 15 分钟", "*/30 * * * *": "每 30 分钟",
    "0 * * * *": "每小时", "0 */2 * * *": "每 2 小时",
    "0 */3 * * *": "每 3 小时", "0 */6 * * *": "每 6 小时",
    "0 */8 * * *": "每 8 小时", "0 */12 * * *": "每 12 小时",
    "0 9 * * *": "每天 09:00", "0 0 */3 * *": "每 3 天",
    "0 9 * * 1-5": "工作日 09:00", "0 0 1 * *": "每月 1 日",
  };
  if (presets[schedule]) return presets[schedule];

  const m = schedule.match(/^\*\/(\d+) \* \* \* \*$/);
  if (m) return `每 ${m[1]} 分钟`;

  const h = schedule.match(/^(\d+) \* \* \* \*$/);
  if (h) return `每小时 ${h[1].padStart(2,"0")} 分`;

  const nh = schedule.match(/^(\d+|\*) \*\/(\d+) \* \* \*$/);
  if (nh) return nh[1] === "0" ? `每 ${nh[2]} 小时` : `每 ${nh[2]} 小时（第 ${nh[1]} 分）`;

  const d = schedule.match(/^(\d+) (\d+) \* \* \*$/);
  if (d) return `每天 ${d[2].padStart(2,"0")}:${d[1].padStart(2,"0")}`;

  const w = schedule.match(/^(\d+) (\d+) \* \* (\d[\d,]*)$/);
  if (w) {
    const labels = {0:"日",1:"一",2:"二",3:"三",4:"四",5:"五",6:"六"};
    return `每周${w[3].split(",").map(d=>labels[d]||`周${d}`).join("、")} ${w[2].padStart(2,"0")}:${w[1].padStart(2,"0")}`;
  }

  const mo = schedule.match(/^(\d+) (\d+) (\d+) \* \*$/);
  if (mo) return `每月 ${mo[3]} 日 ${mo[2].padStart(2,"0")}:${mo[1].padStart(2,"0")}`;

  return schedule;
}

function splitCronExpression(schedule) {
  const parts = String(schedule || "").trim().split(/\s+/).filter(Boolean);
  return parts.length === 5 ? parts : null;
}

function syncCronBuilderFromSchedule(schedule) {
  const parts = splitCronExpression(schedule);
  cronPartInputs.forEach((input, i) => { input.value = parts ? parts[i] : ""; });
}

function composeCronFromBuilder() {
  return cronPartInputs.map((input) => String(input.value || "").trim() || "*").join(" ");
}

/* ─── Simple mode cron ────────────────────────────────────────────── */

function getActiveFreq() {
  const active = document.querySelector(".cron-freq-tab.active");
  return active ? active.dataset.freq : "every-n-minutes";
}

function setActiveFreq(freq) {
  cronFreqTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.freq === freq));
  cronPanels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== freq));
}

function getWeekdayValues() {
  if (!cronWeekdayBtns) return [];
  return [...cronWeekdayBtns].filter((btn) => btn.querySelector("input[type=checkbox]")?.checked).map((btn) => btn.dataset.day);
}

function setWeekdayValues(values) {
  if (!cronWeekdayBtns) return;
  cronWeekdayBtns.forEach((btn) => { btn.querySelector("input[type=checkbox]").checked = values.includes(btn.dataset.day); });
}

function simpleModeToCron() {
  const freq = getActiveFreq();
  let m = "0", h = "9", d = "*", mo = "*", w = "*";
  switch (freq) {
    case "every-n-minutes": {
      const n = parseInt(cronSliderEveryN?.value, 10) || 5;
      m = `*/${n}`; h = "*"; d = "*"; break;
    }
    case "hourly": {
      m = `${parseInt(cronSliderHourly?.value, 10) || 0}`; h = "*"; d = "*"; break;
    }
    case "daily": {
      const t = (cronDailyTime?.value || "09:00").split(":");
      h = parseInt(t[0],10).toString(); m = parseInt(t[1],10).toString(); d = "*"; break;
    }
    case "weekly": {
      const wt = (cronWeeklyTime?.value || "09:00").split(":");
      h = parseInt(wt[0],10).toString(); m = parseInt(wt[1],10).toString();
      const days = getWeekdayValues();
      w = days.length ? days.sort((a,b)=>parseInt(a)-parseInt(b)).join(",") : "*"; d = "*"; break;
    }
    case "monthly": {
      const mt = (cronMonthlyTime?.value || "09:00").split(":");
      h = parseInt(mt[0],10).toString(); m = parseInt(mt[1],10).toString();
      d = cronSliderMonthly?.value || "1"; break;
    }
  }
  return `${m} ${h} ${d} ${mo} ${w}`;
}

function syncSimpleFromCron(schedule) {
  const parts = splitCronExpression(schedule);
  if (!parts) {
    setActiveFreq("every-n-minutes");
    if (cronSliderEveryN) { cronSliderEveryN.value = "5"; if (cronEveryNDisplay) cronEveryNDisplay.textContent = "5"; }
    if (cronSliderHourly) { cronSliderHourly.value = "0"; if (cronHourlyDisplay) cronHourlyDisplay.textContent = "0"; }
    if (cronSliderMonthly) { cronSliderMonthly.value = "1"; if (cronMonthlyDisplay) cronMonthlyDisplay.textContent = "1"; }
    if (cronDailyTime) cronDailyTime.value = "09:00";
    if (cronWeeklyTime) cronWeeklyTime.value = "09:00";
    if (cronMonthlyTime) cronMonthlyTime.value = "09:00";
    setWeekdayValues([]);
    return;
  }
  const [min, hour, day, , weekday] = parts;
  const minNum = parseInt(min, 10);
  const hourNum = parseInt(hour, 10);
  const dayNum = parseInt(day, 10);

  if (min.startsWith("*/")) {
    setActiveFreq("every-n-minutes");
    const n = min.slice(2);
    if (cronSliderEveryN) { cronSliderEveryN.value = n; if (cronEveryNDisplay) cronEveryNDisplay.textContent = n; }
  } else if (hour === "*") {
    setActiveFreq("hourly");
    if (cronSliderHourly) { cronSliderHourly.value = String(minNum); if (cronHourlyDisplay) cronHourlyDisplay.textContent = String(minNum); }
  } else if (day === "*" && !Number.isNaN(hourNum) && weekday === "*") {
    setActiveFreq("daily");
    if (cronDailyTime) cronDailyTime.value = `${String(hourNum).padStart(2,"0")}:${String(minNum).padStart(2,"0")}`;
  } else if (day === "*" && !Number.isNaN(hourNum) && weekday !== "*") {
    setActiveFreq("weekly");
    if (cronWeeklyTime) cronWeeklyTime.value = `${String(hourNum).padStart(2,"0")}:${String(minNum).padStart(2,"0")}`;
    setWeekdayValues(weekday.split(","));
  } else if (!Number.isNaN(dayNum) && !Number.isNaN(hourNum)) {
    setActiveFreq("monthly");
    if (cronSliderMonthly) { cronSliderMonthly.value = day; if (cronMonthlyDisplay) cronMonthlyDisplay.textContent = day; }
    if (cronMonthlyTime) cronMonthlyTime.value = `${String(hourNum).padStart(2,"0")}:${String(minNum).padStart(2,"0")}`;
  }
}

function syncAllCron() {
  if (cronSimpleMode) {
    scheduleInput.value = simpleModeToCron();
  } else {
    scheduleInput.value = composeCronFromBuilder();
  }
}

function syncFromSchedule() {
  syncCronBuilderFromSchedule(scheduleInput.value);
  if (cronSimpleMode) syncSimpleFromCron(scheduleInput.value);
}

/* ─── API helpers ─────────────────────────────────────────────────── */

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) {
    let message = `请求失败 (${response.status})`;
    try {
      const body = await response.json();
      if (body.error) message = body.error;
    } catch (_) { /* ignore */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function getLatestTaskLog(task) {
  return Array.isArray(task.logs) ? task.logs[0] : null;
}

function summarizeTaskError(log) {
  if (log?.stderr) {
    const lines = log.stderr.split(/\r?\n/).filter(Boolean);
    return lines[lines.length - 1] || "执行失败";
  }
  return "执行失败";
}

function buildManualRunError(task) {
  const log = getLatestTaskLog(task);
  return log ? `任务执行失败: ${log.stderr || log.stdout || "未知错误"}` : "任务执行失败";
}

async function waitForManualRunResult(taskId, previousLogId) {
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const task = await request(`/api/tasks/${taskId}`);
    const latest = getLatestTaskLog(task);
    if (latest && latest.id !== previousLogId) return task;
  }
  throw new Error("任务执行超时");
}

async function exportTasks() {
  const response = await fetch("/api/tasks-export");
  if (!response.ok) throw new Error("导出失败");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `weischeduler-tasks-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importTasks(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  const tasks = Array.isArray(payload) ? payload : payload.tasks;
  const result = await request("/api/tasks-import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result?.imported || 0;
}

async function triggerManualRun(taskId) {
  const beforeTask = await request(`/api/tasks/${taskId}`);
  const previousLogId = getLatestTaskLog(beforeTask)?.id || null;
  await request(`/api/tasks/${taskId}/run`, { method: "POST" });
  const task = await waitForManualRunResult(taskId, previousLogId);
  await loadTasks();
  const latest = getLatestTaskLog(task);
  if (latest?.id !== previousLogId && latest?.status === "failed") {
    throw new Error(buildManualRunError(task));
  }
}

/* ─── Render helpers ──────────────────────────────────────────────── */

function getStatusData(task) {
  if (task.running) return task.liveLog?.stopRequested ? "stopping" : "running";
  return task.lastStatus || "never";
}

function getStatusLabel(task) {
  const map = {
    running: "运行中", stopping: "终止中", success: "成功",
    failed: "失败", never: "未运行", stopped: "已暂停",
  };
  return map[getStatusData(task)] || task.lastStatus;
}

function detailRows(task) {
  const rows = [
    ["执行方式", task.runnerType === "python" ? "Python" : task.runnerType === "conda-name" ? "Conda 环境名" : "Conda 路径"],
    ["脚本路径", task.scriptPath],
  ];
  if (task.commandPath) rows.push(["命令路径", task.commandPath]);
  if (task.condaTarget) rows.push(["Conda 目标", task.condaTarget]);
  if (task.args) rows.push(["启动参数", task.args]);
  if (task.timeArgName) rows.push(["时间参数名", task.timeArgName]);
  if (task.workingDirectory) rows.push(["工作目录", task.workingDirectory]);
  rows.push(["Cron", task.schedule]);
  return rows.map(([dt, dd]) => `<dt>${dt}</dt><dd>${dd}</dd>`).join("");
}

/* ─── Main render ─────────────────────────────────────────────────── */

async function loadTasks() {
  const tasks = await request("/api/tasks");
  taskList.innerHTML = "";
  heroTotal.textContent = String(tasks.length);
  heroRunning.textContent = String(tasks.filter((t) => t.running).length);
  heroEnabled.textContent = String(tasks.filter((t) => t.enabled).length);

  if (!tasks.length) {
    taskList.innerHTML = '<div class="empty-state">📋 还没有任务<br/>先在左侧创建一个吧</div>';
    return;
  }

  for (const task of tasks) {
    const node = taskTemplate.content.firstElementChild.cloneNode(true);
    const status = getStatusData(task);
    const statusLabel = getStatusLabel(task);

    // Status badge
    const badge = node.querySelector(".task-status-badge");
    badge.dataset.status = status;
    badge.textContent = statusLabel;

    // Name
    node.querySelector(".task-card__name").textContent = task.name;

    // Frequency pill
    const freqEl = node.querySelector(".task-frequency");
    freqEl.textContent = describeSchedule(task.schedule);

    // Meta
    node.querySelector(".meta-schedule").textContent = task.schedule;
    node.querySelector(".meta-last-run").textContent = task.lastRunAt ? formatDisplayTime(task.lastRunAt) : "从未执行";
    const nextRunText = task.nextRunAt ? formatDisplayTime(task.nextRunAt) : (task.enabled ? "暂未计算" : "已暂停");
    node.querySelector(".meta-next-run").textContent = nextRunText;

    // Error block
    const errorBlock = node.querySelector(".task-card__error");
    if (task.lastStatus === "failed" && (task.lastError || task.logs?.length)) {
      const failedLog = task.logs?.find((l) => l?.status === "failed");
      const errMsg = task.lastError || summarizeTaskError(failedLog);
      if (errMsg) {
        errorBlock.textContent = errMsg;
        errorBlock.style.display = "block";
      }
    }

    // Detail grid
    node.querySelector(".detail-grid").innerHTML = detailRows(task);

    // Log
    node.querySelector(".log-content").textContent = renderLog(task);

    // Toggle
    const isCollapsed = !expandedTaskIds.has(task.id);
    node.classList.toggle("collapsed", isCollapsed);
    const toggleBtn = node.querySelector(".task-card__toggle");
    const toggleText = toggleBtn.querySelector(".toggle-text");
    toggleText.textContent = isCollapsed ? "展开详情" : "折叠详情";

    // Button states
    const startBtn = node.querySelector(".action-start");
    const pauseBtn = node.querySelector(".action-pause");
    const runOnceBtn = node.querySelector(".action-run-once");
    const headStopBtn = node.querySelector(".action-stop-head");
    const stopBtn = node.querySelector(".action-stop");
    const clearLogsBtn = node.querySelector(".action-clear-logs");

    startBtn.disabled = task.enabled;
    pauseBtn.disabled = !task.enabled;
    runOnceBtn.disabled = task.running;
    headStopBtn.disabled = !task.running;
    headStopBtn.textContent = task.liveLog?.stopRequested ? "⏳" : "⏹";
    stopBtn.disabled = !task.running;
    stopBtn.textContent = task.liveLog?.stopRequested ? "终止中..." : "终止";
    clearLogsBtn.disabled = !(task.logs && task.logs.length);

    /* ─── Event listeners ─── */

    toggleBtn.addEventListener("click", () => {
      if (expandedTaskIds.has(task.id)) expandedTaskIds.delete(task.id);
      else expandedTaskIds.add(task.id);
      loadTasks().catch((err) => { taskList.innerHTML = `<div class="empty-state">${err.message}</div>`; });
    });

    // Edit
    node.querySelector(".action-edit").addEventListener("click", () => {
      document.getElementById("task-id").value = task.id;
      document.getElementById("name").value = task.name;
      document.getElementById("runnerType").value = task.runnerType || "python";
      document.getElementById("commandPath").value = task.commandPath || task.pythonPath || "";
      document.getElementById("condaTarget").value = task.condaTarget || "";
      document.getElementById("scriptPath").value = task.scriptPath;
      document.getElementById("args").value = task.args || "";
      document.getElementById("timeArgName").value = task.timeArgName || "";
      document.getElementById("timeArgValue").value = task.timeArgValue || "";
      document.getElementById("workingDirectory").value = task.workingDirectory || "";
      document.getElementById("schedule").value = task.schedule;
      syncFromSchedule();
      document.getElementById("enabled").checked = task.enabled;
      updateRunnerFields();
      formTitle.textContent = `编辑: ${task.name}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Start / Pause
    startBtn.addEventListener("click", async () => {
      try { await request(`/api/tasks/${task.id}/start`, { method: "POST" }); await loadTasks(); }
      catch (e) { alert(e.message); }
    });
    pauseBtn.addEventListener("click", async () => {
      try { await request(`/api/tasks/${task.id}/pause`, { method: "POST" }); await loadTasks(); }
      catch (e) { alert(e.message); }
    });

    // Run once (both buttons)
    const runHandler = async () => {
      try { await triggerManualRun(task.id); }
      catch (e) { alert(e.message); }
    };
    runOnceBtn.addEventListener("click", runHandler);
    node.querySelector(".action-run").addEventListener("click", runHandler);

    // Stop
    const stopHandler = async () => {
      try { await request(`/api/tasks/${task.id}/stop`, { method: "POST" }); await loadTasks(); }
      catch (e) { alert(e.message); }
    };
    stopBtn.addEventListener("click", stopHandler);
    headStopBtn.addEventListener("click", stopHandler);

    // Clear logs
    clearLogsBtn.addEventListener("click", async () => {
      if (!window.confirm(`确认清除"${task.name}"的日志？`)) return;
      try { await request(`/api/tasks/${task.id}/logs`, { method: "DELETE" }); await loadTasks(); }
      catch (e) { alert(e.message); }
    });

    // Delete
    node.querySelector(".action-delete").addEventListener("click", async () => {
      if (!window.confirm(`确认删除"${task.name}"？`)) return;
      try {
        await request(`/api/tasks/${task.id}`, { method: "DELETE" });
        if (document.getElementById("task-id").value === task.id) resetForm();
        await loadTasks();
      } catch (e) { alert(e.message); }
    });

    taskList.appendChild(node);
  }

  scheduleAutoRefresh();
}

/* ─── Event wiring ────────────────────────────────────────────────── */

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const taskId = document.getElementById("task-id").value;
  const payload = formToPayload();
  try {
    if (taskId) {
      await request(`/api/tasks/${taskId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await request("/api/tasks", { method: "POST", body: JSON.stringify(payload) });
    }
    resetForm();
    await loadTasks();
  } catch (error) {
    alert(error.message);
  }
});

resetButton.addEventListener("click", resetForm);
refreshButton.addEventListener("click", loadTasks);
autoRefreshEnabledInput.addEventListener("change", () => { persistAutoRefreshPreferences(); scheduleAutoRefresh(); });
autoRefreshIntervalInput.addEventListener("change", () => { persistAutoRefreshPreferences(); scheduleAutoRefresh(); });

exportButton.addEventListener("click", async () => {
  try { await exportTasks(); } catch (e) { alert(e.message); }
});
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  try {
    const imported = await importTasks(file);
    alert(`已导入 ${imported} 个任务`);
    await loadTasks();
  } catch (e) {
    alert(e.message);
  } finally {
    importFileInput.value = "";
  }
});

document.getElementById("runnerType").addEventListener("change", updateRunnerFields);

cronPartInputs.forEach((input) => {
  input.addEventListener("input", () => { if (!cronSimpleMode) scheduleInput.value = composeCronFromBuilder(); });
});
scheduleInput.addEventListener("input", syncFromSchedule);

/* ─── Cron mode tabs ─────────────────────────────────────────────── */

cronModeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    cronSimpleMode = tab.dataset.mode === "simple";
    cronModeTabs.forEach((t) => {
      t.classList.toggle("active", t === tab);
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    cronSimple.classList.toggle("hidden", !cronSimpleMode);
    cronAdvanced.classList.toggle("hidden", cronSimpleMode);
    if (cronSimpleMode) syncSimpleFromCron(scheduleInput.value);
  });
});

/* ─── Cron freq tabs ─────────────────────────────────────────────── */

cronFreqTabs.forEach((tab) => {
  tab.addEventListener("click", () => { setActiveFreq(tab.dataset.freq); syncAllCron(); });
});

/* ─── Simple mode controls ───────────────────────────────────────── */

function onSimpleChange() { syncAllCron(); }

if (cronSliderEveryN) {
  cronSliderEveryN.addEventListener("input", () => {
    if (cronEveryNDisplay) cronEveryNDisplay.textContent = cronSliderEveryN.value;
    onSimpleChange();
  });
}
if (cronSliderHourly) {
  cronSliderHourly.addEventListener("input", () => {
    if (cronHourlyDisplay) cronHourlyDisplay.textContent = cronSliderHourly.value;
    onSimpleChange();
  });
}
if (cronSliderMonthly) {
  cronSliderMonthly.addEventListener("input", () => {
    if (cronMonthlyDisplay) cronMonthlyDisplay.textContent = cronSliderMonthly.value;
    onSimpleChange();
  });
}

if (cronDailyTime) cronDailyTime.addEventListener("change", onSimpleChange);
if (cronWeeklyTime) cronWeeklyTime.addEventListener("change", onSimpleChange);
if (cronMonthlyTime) cronMonthlyTime.addEventListener("change", onSimpleChange);

if (cronWeekdayBtns) {
  cronWeekdayBtns.forEach((btn) => {
    const cb = btn.querySelector("input[type=checkbox]");
    if (cb) cb.addEventListener("change", onSimpleChange);
  });
}

document.querySelectorAll(".cron-presets .btn--chip").forEach((button) => {
  button.addEventListener("click", () => {
    scheduleInput.value = button.dataset.cron || "";
    syncFromSchedule();
  });
});

/* ─── Init ────────────────────────────────────────────────────────── */

hydrateAutoRefreshPreferences();
updateRunnerFields();
syncFromSchedule();
loadTasks().catch((error) => {
  taskList.innerHTML = `<div class="empty-state">${error.message}</div>`;
});

/* ─── Theme system ────────────────────────────────────────────────── */

(function () {
  const themeAPI = window.__theme;
  if (!themeAPI) return;

  function applyTheme(name) {
    document.documentElement.dataset.theme = name;
    document.querySelectorAll('link[data-skin]').forEach(function (el) { el.remove(); });
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/skins/' + name + '.css';
    link.dataset.skin = name;
    document.head.appendChild(link);
  }

  themeAPI.onThemeChanged(function (name) { applyTheme(name); });
  themeAPI.getTheme().then(function (name) { applyTheme(name); });
})();
