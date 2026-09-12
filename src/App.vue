<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { openDataDirectory } from "./services/tauri";
import { useTasksStore } from "./stores/tasks";
import type { Task, TaskStatus } from "./types/task";

const store = useTasksStore();
const { tasks, editing, loading, error, notice, runningCount, enabledCount } = storeToRefs(store);
const expanded = ref<Set<string>>(new Set());
const autoRefresh = ref(localStorage.getItem("weischeduler:auto-refresh") !== "false");
const autoRefreshInterval = ref(Number(localStorage.getItem("weischeduler:auto-refresh-interval") || 10000));
const importInput = ref<HTMLInputElement>();

const runnerLabel: Record<string, string> = {
  python: "Python",
  "conda-name": "Conda 环境名",
  "conda-path": "Conda 路径",
  cmd: "CMD / BAT",
};

const sortedTasks = computed(() => [...tasks.value].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")));
const themes = [
  ["zhenji", "甄姬·月白"], ["shinkai-twilight", "新海·黄昏"], ["qin-empire", "秦帝国·黑金"],
  ["witch-alchemy", "女巫·炼金"], ["deep-dream", "深梦"], ["hackers-terminal", "黑客终端"], ["cardamom-maiden", "豆蔻少女"],
] as const;
const currentTheme = ref(localStorage.getItem("weischeduler:theme") || "zhenji");
const cronMode = ref<"simple" | "advanced">("simple");
const cronFrequency = ref("every-n-minutes");
const everyN = ref(5);
const hourlyMinute = ref(0);
const dailyTime = ref("09:00");
const weeklyTime = ref("09:00");
const monthlyDay = ref(1);
const monthlyTime = ref("09:00");
const weekdays = ref<number[]>([]);
const weekdayOptions = [[1, "一"], [2, "二"], [3, "三"], [4, "四"], [5, "五"], [6, "六"], [0, "日"]] as const;
const cronParts = reactive({ minute: "*", hour: "*", day: "*", month: "*", weekday: "*" });

function applyTheme(name: string) {
  currentTheme.value = name;
  document.documentElement.dataset.theme = name;
  localStorage.setItem("weischeduler:theme", name);
}

function twoDigits(value: string | number) { return String(value).padStart(2, "0"); }
function timeParts(value: string) { const [hour, minute] = value.split(":"); return [Number(hour) || 0, Number(minute) || 0]; }
function updateSimpleCron() {
  if (cronFrequency.value === "every-n-minutes") editing.value.schedule = `*/${everyN.value} * * * *`;
  if (cronFrequency.value === "hourly") editing.value.schedule = `${hourlyMinute.value} * * * *`;
  if (cronFrequency.value === "daily") { const [h, m] = timeParts(dailyTime.value); editing.value.schedule = `${m} ${h} * * *`; }
  if (cronFrequency.value === "weekly") { const [h, m] = timeParts(weeklyTime.value); editing.value.schedule = `${m} ${h} * * ${weekdays.value.length ? [...weekdays.value].sort((a, b) => a - b).join(",") : "*"}`; }
  if (cronFrequency.value === "monthly") { const [h, m] = timeParts(monthlyTime.value); editing.value.schedule = `${m} ${h} ${monthlyDay.value} * *`; }
}
function updateAdvancedCron() { editing.value.schedule = [cronParts.minute, cronParts.hour, cronParts.day, cronParts.month, cronParts.weekday].map((part) => part.trim() || "*").join(" "); }
function syncCronFromSchedule() {
  const parts = editing.value.schedule.trim().split(/\s+/); if (parts.length !== 5) return;
  const [minute, hour, day, month, weekday] = parts; Object.assign(cronParts, { minute, hour, day, month, weekday });
  if (minute.startsWith("*/")) { cronFrequency.value = "every-n-minutes"; everyN.value = Math.min(59, Math.max(1, Number(minute.slice(2)) || 5)); return; }
  if (hour === "*") { cronFrequency.value = "hourly"; hourlyMinute.value = Number(minute) || 0; return; }
  const time = `${twoDigits(hour)}:${twoDigits(minute)}`;
  if (day === "*" && weekday === "*") { cronFrequency.value = "daily"; dailyTime.value = time; return; }
  if (day === "*" && weekday !== "*") { cronFrequency.value = "weekly"; weeklyTime.value = time; weekdays.value = weekday.split(",").map(Number).filter((value) => !Number.isNaN(value)); return; }
  if (Number(day)) { cronFrequency.value = "monthly"; monthlyDay.value = Math.min(31, Math.max(1, Number(day))); monthlyTime.value = time; }
}
function chooseFrequency(value: string) { cronFrequency.value = value; updateSimpleCron(); }
function toggleWeekday(day: number) { weekdays.value = weekdays.value.includes(day) ? weekdays.value.filter((item) => item !== day) : [...weekdays.value, day]; updateSimpleCron(); }

function status(task: Task): TaskStatus {
  return task.running ? (task.liveLog?.status === "stopping" ? "stopping" : "running") : task.lastStatus;
}

function statusText(task: Task) {
  return ({ running: "运行中", stopping: "终止中", success: "成功", failed: "失败", never: "未运行", stopped: "已暂停" } as Record<string, string>)[status(task)] ?? "未知";
}

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function describeSchedule(schedule: string) {
  if (schedule === "*/5 * * * *") return "每 5 分钟";
  if (/^\*\/\d+ \* \* \* \*$/.test(schedule)) return `每 ${schedule.split("/")[1].split(" ")[0]} 分钟`;
  if (/^\d+ \* \* \* \*$/.test(schedule)) return `每小时第 ${schedule.split(" ")[0]} 分`;
  if (schedule === "0 9 * * *") return "每天 09:00";
  return "自定义计划";
}

function toggleExpanded(id: string) {
  const next = new Set(expanded.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expanded.value = next;
}

async function runAction(action: () => Promise<void>) {
  try { await action(); } catch (cause) { window.alert(cause instanceof Error ? cause.message : "操作失败"); }
}

async function saveTask() {
  if (!editing.value.name.trim() || !editing.value.scriptPath.trim() || !editing.value.schedule.trim()) {
    window.alert("请填写任务名称、脚本路径和 Cron 表达式");
    return;
  }
  await runAction(() => store.save());
}

function confirmAction(message: string, action: () => Promise<void>) {
  if (window.confirm(message)) void runAction(action);
}

function persistRefresh() {
  localStorage.setItem("weischeduler:auto-refresh", String(autoRefresh.value));
  localStorage.setItem("weischeduler:auto-refresh-interval", String(autoRefreshInterval.value));
}

async function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) await runAction(() => store.importFile(file));
  if (importInput.value) importInput.value.value = "";
}

watch(autoRefresh, (enabled) => {
  persistRefresh();
  enabled ? store.startPolling(autoRefreshInterval.value) : store.stopPolling();
});
watch(autoRefreshInterval, () => { persistRefresh(); if (autoRefresh.value) store.startPolling(autoRefreshInterval.value); });
watch(() => editing.value.id, syncCronFromSchedule);
onMounted(async () => { applyTheme(currentTheme.value); syncCronFromSchedule(); await store.refresh(); if (autoRefresh.value) store.startPolling(autoRefreshInterval.value); });
onUnmounted(() => store.stopPolling());
</script>

<template>
  <div class="app-shell">
    <div class="decorations" aria-hidden="true"><span class="deco-orb deco-orb--1"></span><span class="deco-orb deco-orb--2"></span><span class="deco-orb deco-orb--3"></span><span class="deco-orb deco-orb--4"></span></div>
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">尉</div>
        <div>
          <p class="eyebrow">TAURI DESKTOP AUTOMATION</p>
          <h1>尉定时任务</h1>
        </div>
      </div>
      <div class="topbar-actions">
        <span class="engine-pill"><i></i> 快龙 调度引擎</span>
        <select v-model="currentTheme" class="theme-select" aria-label="选择主题" @change="applyTheme(currentTheme)"><option v-for="theme in themes" :key="theme[0]" :value="theme[0]">{{ theme[1] }}</option></select>
        <button class="button ghost" @click="runAction(openDataDirectory)">数据目录</button>
      </div>
    </header>

    <main>
      <section class="overview">
        <div>
          <p class="eyebrow">WORKSPACE / SCHEDULER</p>
          <h2>把重复工作交给时间。</h2>
          <p class="lede">本地运行、数据归你所有。用 Cron 表达式安排 Python、Conda 或 CMD 任务。</p>
        </div>
        <div class="stats">
          <div class="stat"><span>总任务</span><strong>{{ tasks.length }}</strong></div>
          <div class="stat"><span>运行中</span><strong class="accent">{{ runningCount }}</strong></div>
          <div class="stat"><span>已启用</span><strong>{{ enabledCount }}</strong></div>
        </div>
      </section>

      <div v-if="notice" class="notice" role="status" @click="notice = ''">{{ notice }} <span>×</span></div>
      <div v-if="error" class="error-banner">{{ error }}</div>

      <section class="workspace-grid">
        <aside class="panel editor-panel">
          <div class="panel-heading">
            <div><p class="eyebrow">CONFIGURATION</p><h3>{{ editing.id ? "编辑任务" : "新建任务" }}</h3></div>
            <button class="icon-button" title="清空表单" @click="store.reset">↺</button>
          </div>
          <form @submit.prevent="saveTask">
            <label>任务名称<input v-model="editing.name" placeholder="例如：日报生成" /></label>
            <div class="form-row">
              <label>执行方式<select v-model="editing.runnerType"><option value="python">直接调用 Python</option><option value="conda-name">Conda 环境名</option><option value="conda-path">Conda 环境路径</option><option value="cmd">CMD / BAT 命令</option></select></label>
              <label>命令路径<input v-model="editing.commandPath" :placeholder="editing.runnerType === 'python' ? 'python.exe 路径' : '可选'" /></label>
            </div>
            <label>{{ editing.runnerType === "cmd" ? "CMD 命令或 BAT 路径" : "脚本路径" }}<input v-model="editing.scriptPath" :placeholder="editing.runnerType === 'cmd' ? 'D:\\jobs\\run.bat' : 'D:\\jobs\\report.py'" /></label>
            <label>启动参数<input v-model="editing.args" placeholder='--date "2026-09-12"' /></label>
            <div class="form-row">
              <label>工作目录<input v-model="editing.workingDirectory" placeholder="默认脚本所在目录" /></label>
              <label>Conda 目标<input v-model="editing.condaTarget" :disabled="!editing.runnerType.startsWith('conda')" placeholder="环境名或完整路径" /></label>
            </div>
            <div class="form-row">
              <label>时间参数名<input v-model="editing.timeArgName" placeholder="例如：--run-time" /></label>
              <label>时间参数值<input v-model="editing.timeArgValue" type="datetime-local" /></label>
            </div>

            <div class="schedule-label"><label>调度配置<input v-model="editing.schedule" placeholder="*/10 * * * *" @change="syncCronFromSchedule" /></label><span class="schedule-help">5 段 Cron</span></div>
            <div class="cron-mode-tabs"><button type="button" :class="{ active: cronMode === 'simple' }" @click="cronMode = 'simple'; syncCronFromSchedule()">齿轮滑块</button><button type="button" :class="{ active: cronMode === 'advanced' }" @click="cronMode = 'advanced'; syncCronFromSchedule()">高级编辑</button></div>
            <div v-if="cronMode === 'simple'" class="cron-simple">
              <div class="cron-freq-tabs"><button v-for="frequency in [['every-n-minutes','每 N 分钟'],['hourly','每小时'],['daily','每天'],['weekly','每周'],['monthly','每月']]" :key="frequency[0]" type="button" :class="{ active: cronFrequency === frequency[0] }" @click="chooseFrequency(frequency[0])">{{ frequency[1] }}</button></div>
              <div class="cron-panel">
                <div v-if="cronFrequency === 'every-n-minutes'" class="cron-slider-row"><span>每隔</span><input v-model.number="everyN" class="cron-slider" type="range" min="1" max="59" @input="updateSimpleCron" /><strong>{{ everyN }}</strong><span>分钟</span></div>
                <div v-else-if="cronFrequency === 'hourly'" class="cron-slider-row"><span>在第</span><input v-model.number="hourlyMinute" class="cron-slider" type="range" min="0" max="59" @input="updateSimpleCron" /><strong>{{ hourlyMinute }}</strong><span>分执行</span></div>
                <div v-else-if="cronFrequency === 'daily'" class="cron-slider-row"><span>在</span><input v-model="dailyTime" type="time" @change="updateSimpleCron" /><span>执行</span></div>
                <div v-else-if="cronFrequency === 'weekly'" class="cron-slider-row"><span>在</span><div class="cron-weekday-grid"><button v-for="day in weekdayOptions" :key="day[0]" type="button" :class="{ active: weekdays.includes(day[0]) }" @click="toggleWeekday(day[0])">{{ day[1] }}</button></div><input v-model="weeklyTime" type="time" @change="updateSimpleCron" /></div>
                <div v-else class="cron-slider-row"><span>第</span><input v-model.number="monthlyDay" class="cron-slider" type="range" min="1" max="31" @input="updateSimpleCron" /><strong>{{ monthlyDay }}</strong><span>日</span><input v-model="monthlyTime" type="time" @change="updateSimpleCron" /></div>
              </div>
            </div>
            <div v-else class="cron-advanced"><div class="cron-builder-grid"><label>分钟<input v-model="cronParts.minute" placeholder="* / */10 / 0,30" @input="updateAdvancedCron" /></label><label>小时<input v-model="cronParts.hour" placeholder="* / 9 / 9-18" @input="updateAdvancedCron" /></label><label>日<input v-model="cronParts.day" placeholder="* / 1 / 1-5" @input="updateAdvancedCron" /></label><label>月<input v-model="cronParts.month" placeholder="* / 1 / 1,6,12" @input="updateAdvancedCron" /></label><label>周<input v-model="cronParts.weekday" placeholder="* / 1-5 / 0,6" @input="updateAdvancedCron" /></label></div><p class="field-hint">支持 <code>*</code>、<code>*/10</code>、<code>1,15,30</code>、<code>1-5</code> 等写法</p></div>
            <div class="presets"><button v-for="preset in [['*/5 * * * *','每 5 分'], ['0 * * * *','每小时'], ['0 */3 * * *','每 3 小时'], ['0 */6 * * *','每 6 小时'], ['0 9 * * *','每天 09:00'], ['0 0 */3 * *','每 3 天'], ['0 9 * * 1-5','工作日'], ['0 0 1 * *','每月 1 日']]" :key="preset[0]" type="button" @click="editing.schedule = preset[0]; syncCronFromSchedule()">{{ preset[1] }}</button></div>
            <label class="check"><input v-model="editing.enabled" type="checkbox" /><span>保存后启用调度</span></label>
            <button class="button primary save-button" type="submit" :disabled="loading">{{ editing.id ? "保存修改" : "创建任务" }} <span>→</span></button>
          </form>
        </aside>

        <section class="panel list-panel">
          <div class="panel-heading list-heading">
            <div><p class="eyebrow">TASK QUEUE</p><h3>任务列表 <small>{{ tasks.length }} items</small></h3></div>
            <div class="list-actions"><label class="switch-label"><input v-model="autoRefresh" type="checkbox" /><span class="switch"></span>自动刷新</label><button class="button ghost" @click="runAction(store.refresh)">↻ 刷新</button><input ref="importInput" type="file" accept="application/json" hidden @change="handleImport" /><button class="button ghost" @click="importInput?.click()">导入</button><button class="button ghost" @click="runAction(store.downloadExport)">导出</button></div>
          </div>

          <div v-if="loading && !tasks.length" class="empty-state"><span class="spinner"></span><p>正在加载任务…</p></div>
          <div v-else-if="!sortedTasks.length" class="empty-state"><div class="empty-icon">＋</div><h4>还没有任务</h4><p>在左侧填写配置，创建第一个本地调度任务。</p></div>
          <div v-else class="task-list">
            <article v-for="task in sortedTasks" :key="task.id" class="task-card" :class="{ expanded: expanded.has(task.id) }">
              <div class="task-main">
                <div class="task-title-row"><span class="status" :class="status(task)"><i></i>{{ statusText(task) }}</span><h4>{{ task.name }}</h4><span class="frequency">{{ describeSchedule(task.schedule) }}</span></div>
                <div class="task-meta"><span><b>计划</b>{{ task.schedule }}</span><span><b>上次</b>{{ formatTime(task.lastRunAt) }}</span><span><b>下次</b>{{ task.enabled ? (task.nextRunAt ? formatTime(task.nextRunAt) : "计算中") : "已暂停" }}</span></div>
              </div>
              <div class="quick-actions"><button title="立即执行" :disabled="task.running" @click="runAction(() => store.run(task))">▶</button><button :title="task.enabled ? '暂停调度' : '启动调度'" @click="runAction(() => store.toggle(task))">{{ task.enabled ? "Ⅱ" : "▶" }}</button><button class="danger" title="终止运行" :disabled="!task.running" @click="runAction(() => store.stop(task))">■</button></div>
              <button class="details-toggle" @click="toggleExpanded(task.id)">{{ expanded.has(task.id) ? "收起详情" : "展开详情" }} <span>{{ expanded.has(task.id) ? "⌃" : "⌄" }}</span></button>
              <div v-if="expanded.has(task.id)" class="task-details">
                <dl><dt>执行方式</dt><dd>{{ runnerLabel[task.runnerType] }}</dd><dt>脚本路径</dt><dd>{{ task.scriptPath }}</dd><dt v-if="task.commandPath">命令路径</dt><dd v-if="task.commandPath">{{ task.commandPath }}</dd><dt v-if="task.args">启动参数</dt><dd v-if="task.args">{{ task.args }}</dd><dt v-if="task.workingDirectory">工作目录</dt><dd v-if="task.workingDirectory">{{ task.workingDirectory }}</dd></dl>
                <div class="log-box"><div class="log-head"><span>最近日志</span><button :disabled="!task.logs.length" @click="confirmAction(`确认清除「${task.name}」的日志？`, () => store.clearLogs(task))">清除</button></div><pre>{{ task.logs[0]?.stdout || task.logs[0]?.stderr || "暂无运行记录" }}</pre></div>
                <div class="task-footer"><button @click="store.edit(task)">编辑</button><button @click="runAction(() => store.run(task))">立即执行</button><button class="danger-text" :disabled="!task.running" @click="runAction(() => store.stop(task))">终止</button><button class="danger-text" @click="confirmAction(`确认删除「${task.name}」？`, () => store.remove(task))">删除</button></div>
              </div>
            </article>
          </div>
        </section>
      </section>
    </main>
    <footer><span>WEISCHEDULER 2.0</span><span>TAURI 2.11+ · VUE 3.5 · RUST STABLE</span></footer>
  </div>
</template>
