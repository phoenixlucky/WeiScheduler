<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { isAutoStartEnabled, openDataDirectory, setAutoStartEnabled } from "./services/tauri";
import { useTasksStore } from "./stores/tasks";
import type { Task, TaskStatus } from "./types/task";
import UiIcon from "./components/UiIcon.vue";

const store = useTasksStore();
const { tasks, editing, loading, error, notice, runningCount, enabledCount } = storeToRefs(store);
const expanded = ref<Set<string>>(new Set());
const autoRefresh = ref(localStorage.getItem("weischeduler:auto-refresh") !== "false");
const autoRefreshInterval = ref(Number(localStorage.getItem("weischeduler:auto-refresh-interval") || 10000));
const importInput = ref<HTMLInputElement>();
const searchQuery = ref("");
const showAdvanced = ref(false);
const adminMenuOpen = ref(false);
const autoStartEnabled = ref(false);
const autoStartBusy = ref(false);
const ssvipSkin = ref(localStorage.getItem("weischeduler:ssvip-skin") !== "false");
const SSVIP_ACTIVATION_KEY = "greed is good";
const activationKeyInput = ref("");
const activationStatus = ref(localStorage.getItem("weischeduler:ssvip-activation") === "active");
const ssvipSkinEnabled = computed(() => activationStatus.value && ssvipSkin.value);
const runnerLabel: Record<string, string> = { python: "Python", "conda-name": "Conda 环境名", "conda-path": "Conda 路径", cmd: "CMD / BAT", executable: "可执行程序" };
const sortedTasks = computed(() => [...tasks.value].sort((a, b) => a.name.localeCompare(b.name, "zh-CN")));
const filteredTasks = computed(() => { const query = searchQuery.value.trim().toLowerCase(); if (!query) return sortedTasks.value; return sortedTasks.value.filter((task) => [task.name, task.scriptPath, task.commandPath, task.schedule].some((value) => value.toLowerCase().includes(query))); });
const themes = [["zhenji", "甄姬·月白"], ["shinkai-twilight", "新海·黄昏"], ["qin-empire", "秦帝国·黑金"], ["witch-alchemy", "女巫·炼金"], ["deep-dream", "深梦"], ["hackers-terminal", "黑客终端"], ["cardamom-maiden", "豆蔻少女"]] as const;
const currentTheme = ref(localStorage.getItem("weischeduler:theme") || "zhenji");
const themeMenuOpen = ref(false);
const currentThemeLabel = computed(() => themes.find((theme) => theme[0] === currentTheme.value)?.[1].split("·").pop()?.trim() ?? "月白");
const successCount = computed(() => tasks.value.filter((task) => task.lastStatus === "success").length);
const pausedCount = computed(() => tasks.value.filter((task) => !task.enabled).length);
const failedCount = computed(() => tasks.value.filter((task) => task.lastStatus === "failed").length);
const cronMode = ref<"simple" | "advanced">("simple");
const cronFrequency = ref("every-n-minutes");
const everyN = ref(5); const hourlyMinute = ref(0); const dailyTime = ref("09:00"); const weeklyTime = ref("09:00"); const monthlyDay = ref(1); const monthlyTime = ref("09:00"); const weekdays = ref<number[]>([]);
const weekdayOptions = [[1, "一"], [2, "二"], [3, "三"], [4, "四"], [5, "五"], [6, "六"], [0, "日"]] as const;
const cronParts = reactive({ minute: "*", hour: "*", day: "*", month: "*", weekday: "*" });

function applyTheme(name: string) { currentTheme.value = name; document.documentElement.dataset.theme = name; localStorage.setItem("weischeduler:theme", name); }
function twoDigits(value: string | number) { return String(value).padStart(2, "0"); }
function timeParts(value: string) { const [hour, minute] = value.split(":"); return [Number(hour) || 0, Number(minute) || 0]; }
function updateSimpleCron() { if (cronFrequency.value === "every-n-minutes") editing.value.schedule = `*/${everyN.value} * * * *`; if (cronFrequency.value === "hourly") editing.value.schedule = `${hourlyMinute.value} * * * *`; if (cronFrequency.value === "daily") { const [h, m] = timeParts(dailyTime.value); editing.value.schedule = `${m} ${h} * * *`; } if (cronFrequency.value === "weekly") { const [h, m] = timeParts(weeklyTime.value); editing.value.schedule = `${m} ${h} * * ${weekdays.value.length ? [...weekdays.value].sort((a, b) => a - b).join(",") : "*"}`; } if (cronFrequency.value === "monthly") { const [h, m] = timeParts(monthlyTime.value); editing.value.schedule = `${m} ${h} ${monthlyDay.value} * *`; } }
function updateAdvancedCron() { editing.value.schedule = [cronParts.minute, cronParts.hour, cronParts.day, cronParts.month, cronParts.weekday].map((part) => part.trim() || "*").join(" "); }
function syncCronFromSchedule() { const parts = editing.value.schedule.trim().split(/\s+/); if (parts.length !== 5) return; const [minute, hour, day, month, weekday] = parts; Object.assign(cronParts, { minute, hour, day, month, weekday }); if (minute.startsWith("*/")) { cronFrequency.value = "every-n-minutes"; everyN.value = Math.min(59, Math.max(1, Number(minute.slice(2)) || 5)); return; } if (hour === "*") { cronFrequency.value = "hourly"; hourlyMinute.value = Number(minute) || 0; return; } const time = `${twoDigits(hour)}:${twoDigits(minute)}`; if (day === "*" && weekday === "*") { cronFrequency.value = "daily"; dailyTime.value = time; return; } if (day === "*" && weekday !== "*") { cronFrequency.value = "weekly"; weeklyTime.value = time; weekdays.value = weekday.split(",").map(Number).filter((value) => !Number.isNaN(value)); return; } if (Number(day)) { cronFrequency.value = "monthly"; monthlyDay.value = Math.min(31, Math.max(1, Number(day))); monthlyTime.value = time; } }
function chooseFrequency(value: string) { cronFrequency.value = value; updateSimpleCron(); }
function toggleWeekday(day: number) { weekdays.value = weekdays.value.includes(day) ? weekdays.value.filter((item) => item !== day) : [...weekdays.value, day]; updateSimpleCron(); }
function status(task: Task): TaskStatus { return task.running ? (task.liveLog?.status === "stopping" ? "stopping" : "running") : task.lastStatus; }
function statusText(task: Task) { return ({ running: "运行中", stopping: "终止中", retrying: "重试中", success: "成功", failed: "失败", never: "未运行", stopped: "已暂停" } as Record<string, string>)[status(task)] ?? "未知"; }
function logOutput(task: Task) {
  const log = task.liveLog ?? task.logs[0];
  if (!log) return "暂无运行记录";
  const output = [log.stdout.trimEnd(), log.stderr ? `[stderr]\n${log.stderr.trimEnd()}` : ""].filter(Boolean).join("\n");
  return output || "暂无输出";
}
function formatTime(value?: string | null) { if (!value) return "—"; return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function describeSchedule(schedule: string) { if (schedule === "*/5 * * * *") return "每 5 分钟"; if (/^\*\/\d+ \* \* \* \*$/.test(schedule)) return `每 ${schedule.split("/")[1].split(" ")[0]} 分钟`; if (/^\d+ \* \* \* \*$/.test(schedule)) return `每小时第 ${schedule.split(" ")[0]} 分`; if (schedule === "0 9 * * *") return "每天 09:00"; return "自定义计划"; }
function toggleExpanded(id: string) { const next = new Set(expanded.value); next.has(id) ? next.delete(id) : next.add(id); expanded.value = next; }
async function runAction(action: () => Promise<void>) { try { await action(); } catch (cause) { window.alert(cause instanceof Error ? cause.message : "操作失败"); } }
function openCreate() { store.reset(); focusEditor(); }
function openEdit(task: Task) { store.edit(task); focusEditor(); }
async function saveTask() { const targetMissing = editing.value.runnerType === "executable" ? !editing.value.commandPath.trim() : !editing.value.scriptPath.trim(); if (!editing.value.name.trim() || targetMissing || !editing.value.schedule.trim()) { window.alert(editing.value.runnerType === "executable" ? "请填写任务名称、程序路径和 Cron 表达式" : "请填写任务名称、脚本路径和 Cron 表达式"); return; } await runAction(() => store.save()); }
function addEnvironmentVariable() { editing.value.environment.push({ key: "", value: "" }); }
function removeEnvironmentVariable(index: number) { editing.value.environment.splice(index, 1); }
function focusEditor() { requestAnimationFrame(() => (document.querySelector(".editor-panel input") as HTMLInputElement | null)?.focus()); }
function confirmAction(message: string, action: () => Promise<void>) { if (window.confirm(message)) void runAction(action); }
function activateSsvip() { if (activationKeyInput.value.trim().toLowerCase() !== SSVIP_ACTIVATION_KEY) { window.alert("激活秘钥不正确"); return; } activationStatus.value = true; ssvipSkin.value = true; activationKeyInput.value = ""; localStorage.setItem("weischeduler:ssvip-activation", "active"); window.alert("SSVIP 激活成功"); }
async function toggleAutoStart() {
  if (autoStartBusy.value) return;
  const nextValue = !autoStartEnabled.value;
  autoStartBusy.value = true;
  try {
    await setAutoStartEnabled(nextValue);
    autoStartEnabled.value = nextValue;
  } catch (cause) {
    window.alert(cause instanceof Error ? cause.message : "开机自启动设置失败");
  } finally {
    autoStartBusy.value = false;
  }
}
function persistRefresh() { localStorage.setItem("weischeduler:auto-refresh", String(autoRefresh.value)); localStorage.setItem("weischeduler:auto-refresh-interval", String(autoRefreshInterval.value)); }
async function handleImport(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (file) await runAction(() => store.importFile(file)); if (importInput.value) importInput.value.value = ""; }
watch(autoRefresh, (enabled) => { persistRefresh(); enabled ? store.startPolling(autoRefreshInterval.value) : store.stopPolling(); });
watch(autoRefreshInterval, () => { persistRefresh(); if (autoRefresh.value) store.startPolling(autoRefreshInterval.value); });
watch(ssvipSkin, (enabled) => localStorage.setItem("weischeduler:ssvip-skin", String(enabled)));
watch(() => editing.value.id, syncCronFromSchedule);
onMounted(async () => { applyTheme(currentTheme.value); syncCronFromSchedule(); await store.refresh(); try { autoStartEnabled.value = await isAutoStartEnabled(); } catch { autoStartEnabled.value = false; } if (autoRefresh.value) store.startPolling(autoRefreshInterval.value); });
onUnmounted(() => store.stopPolling());
</script>

<template>
  <div class="app-shell" :class="{ 'ssvip-active': ssvipSkinEnabled }">
    <header class="topbar">
      <div class="brand"><span class="brand-mark"><img src="/assets/icons/wj-super-scheduler-icon.png" alt="WJ 超级调度器图标" /></span><div><h1>WJ 超级调度器</h1><p>本地任务调度 · <b>{{ activationStatus ? "SSVIP" : "标准版" }}</b></p></div></div>
      <div class="topbar-actions">
        <span class="engine-pill"><i></i><span>快速</span><small>调度引擎</small></span>
        <div class="theme-picker" :class="{ open: themeMenuOpen }"><button type="button" class="theme-select" aria-label="选择主题" :aria-expanded="themeMenuOpen" @click="themeMenuOpen = !themeMenuOpen"><span>预设：{{ currentThemeLabel }}</span><UiIcon name="chevron" size="11" /></button><div v-if="themeMenuOpen" class="theme-options"><button v-for="theme in themes" :key="theme[0]" type="button" :class="{ active: theme[0] === currentTheme }" @click="applyTheme(theme[0]); themeMenuOpen = false"><i></i><span>{{ theme[1].split("·").pop()?.trim() }}</span><b v-if="theme[0] === currentTheme">✓</b></button></div></div>
        <button class="icon-button top-action" title="打开数据目录" @click="runAction(openDataDirectory)"><UiIcon name="gear" size="17" /></button>
        <div class="admin-menu-wrap"><button class="user-chip" :aria-expanded="adminMenuOpen" title="管理员菜单" @click="adminMenuOpen = !adminMenuOpen"><span class="avatar"><img src="/assets/avatars/admin-male-vip.png" alt="管理员头像" /></span><span>管理员</span><UiIcon name="chevron" size="11" /></button><div v-if="adminMenuOpen" class="admin-menu"><div class="admin-menu-head"><span class="admin-menu-avatar"><img src="/assets/avatars/admin-male-vip.png" alt="管理员头像" /></span><div><b>SSVIP 年度版</b><small>{{ activationStatus ? "专属权益已开启" : "激活后可用" }}</small></div><strong>¥999<small>/年</small></strong></div><div class="activation-panel" :class="{ active: activationStatus }"><div class="activation-panel-head"><span><UiIcon name="shield" size="13" />付费激活</span><b>{{ activationStatus ? "已激活" : "待激活" }}</b></div><div v-if="!activationStatus" class="activation-input-row"><input v-model="activationKeyInput" type="password" placeholder="输入付费激活秘钥" @keyup.enter="activateSsvip" /><button type="button" @click="activateSsvip">激活</button></div><small v-else>SSVIP 权益已绑定此设备</small></div><button class="admin-menu-item" :disabled="!activationStatus" @click="ssvipSkin = !ssvipSkin"><span class="admin-item-icon"><UiIcon name="spark" size="14" /></span><span><b>SSVIP 专属皮肤</b><small>{{ activationStatus ? "金紫光效与专属高光" : "激活后可使用会员皮肤" }}</small></span><span class="menu-switch" :class="{ active: activationStatus && ssvipSkin }"><i></i></span></button><button class="admin-menu-item" :disabled="autoStartBusy" @click="toggleAutoStart"><span class="admin-item-icon"><UiIcon name="refresh" size="14" /></span><span><b>开机自启动</b><small>{{ autoStartEnabled ? "系统启动时自动运行" : "系统启动时不运行" }}</small></span><span class="menu-switch" :class="{ active: autoStartEnabled }"><i></i></span></button><div class="admin-menu-item admin-menu-item--static"><span class="admin-item-icon"><UiIcon name="shield" size="14" /></span><span><b>本地优先 · 安全运行</b><small>任务数据仅保存在本机</small></span><span class="menu-check">✓</span></div></div></div>
      </div>
    </header>

    <main>
      <div v-if="notice" class="notice" role="status" @click="notice = ''">{{ notice }} <UiIcon name="close" size="12" /></div>
      <div v-if="error" class="error-banner">{{ error }}</div>
      <section class="overview"><div class="overview-copy"><p class="eyebrow">WORKSPACE / SCHEDULER</p><h2>高效调度，让重复工作自动运行</h2><p class="lede">本地运行，数据归你所有。用 Cron 表达式安排 Python、Conda、CMD 或任意可执行程序。</p></div></section>
      <section class="stats-grid" aria-label="任务统计">
        <div class="stat-card"><span class="stat-icon stat-icon--blue"><UiIcon name="list" size="18" /></span><div><span>全部任务</span><strong>{{ tasks.length }}</strong></div></div>
        <div class="stat-card"><span class="stat-icon stat-icon--green"><UiIcon name="check" size="18" /></span><div><span>运行成功</span><strong>{{ successCount }}</strong></div></div>
        <div class="stat-card"><span class="stat-icon stat-icon--cyan"><UiIcon name="clock" size="18" /></span><div><span>运行中</span><strong>{{ runningCount }}</strong></div></div>
        <div class="stat-card"><span class="stat-icon stat-icon--purple"><UiIcon name="pause" size="17" /></span><div><span>已暂停</span><strong>{{ pausedCount }}</strong></div></div>
        <div class="stat-card"><span class="stat-icon stat-icon--red"><UiIcon name="alert" size="18" /></span><div><span>运行失败</span><strong>{{ failedCount }}</strong></div></div>
      </section>

      <section class="workspace-grid">
      <aside class="panel editor-panel"><div class="editor-panel-heading"><div><span class="eyebrow">TASK BUILDER</span><h2>{{ editing.id ? "编辑任务" : "新建任务" }}</h2><p>配置任务信息，创建一个新的定时任务</p></div><button class="icon-button" title="清空表单" @click="store.reset"><UiIcon name="refresh" size="15" /></button></div>
        <form class="editor-form" @submit.prevent="saveTask">
          <label>任务名称 <em>*</em><span class="input-wrap"><UiIcon name="file" size="15" /><input v-model="editing.name" placeholder="例如：日报生成、数据备份" /></span></label>
          <label>执行方式 <em>*</em><span class="runner-options"><button type="button" :class="{ active: editing.runnerType === 'python' }" @click="editing.runnerType = 'python'"><UiIcon name="python" size="14" />Python</button><button type="button" :class="{ active: editing.runnerType.startsWith('conda') }" @click="editing.runnerType = 'conda-name'"><UiIcon name="conda" size="14" />Conda</button><button type="button" :class="{ active: ['cmd','executable'].includes(editing.runnerType) }" @click="editing.runnerType = 'cmd'"><UiIcon name="command" size="14" />自定义命令</button></span></label>
          <label>命令路径 <em>*</em><span class="input-wrap"><UiIcon name="terminal" size="15" /><input v-model="editing.commandPath" placeholder="例如：python.exe、cmd 或 node" /></span></label>
          <label v-if="editing.runnerType !== 'executable'">脚本路径 <em>*</em><span class="input-wrap"><UiIcon name="file" size="15" /><input v-model="editing.scriptPath" placeholder="例如：D:\\jobs\\report.py" /></span></label>
          <label>启动参数<span class="input-wrap"><UiIcon name="list" size="15" /><input v-model="editing.args" placeholder='例如：--date "2026-09-12"' /></span></label>
          <div class="form-row"><label>工作目录<span class="input-wrap"><UiIcon name="folder" size="15" /><input v-model="editing.workingDirectory" placeholder="默认脚本所在目录" /></span></label><label>Conda 目标<span class="input-wrap"><UiIcon name="database" size="15" /><input v-model="editing.condaTarget" :disabled="!editing.runnerType.startsWith('conda')" placeholder="环境名或完整路径" /></span></label></div>
          <div class="schedule-field"><label>调度配置 <em>*</em><input v-model="editing.schedule" placeholder="*/5 * * * *" @change="syncCronFromSchedule" /></label><span>5 段 Cron</span></div>
          <details class="advanced-config" :open="showAdvanced" @toggle="showAdvanced = ($event.target as HTMLDetailsElement).open"><summary><span><UiIcon name="sliders" size="14" />更多调度配置</span><UiIcon name="chevron" size="13" /></summary><div class="advanced-body"><div class="subsection-heading"><span>环境变量</span><button type="button" class="text-button" @click="addEnvironmentVariable">＋ 添加</button></div><div v-if="editing.environment.length" class="environment-list"><div v-for="(variable, index) in editing.environment" :key="index" class="environment-row"><input v-model="variable.key" placeholder="变量名" /><input v-model="variable.value" placeholder="值" /><button type="button" @click="removeEnvironmentVariable(index)"><UiIcon name="close" size="12" /></button></div></div><p v-else class="field-hint">可选，仅对当前任务进程生效。</p><div class="form-row"><label>失败重试次数<input v-model.number="editing.retryCount" type="number" min="0" max="5" /></label><label>重试间隔（秒）<input v-model.number="editing.retryDelaySeconds" type="number" min="0" max="86400" /></label></div></div></details>
          <label class="check"><input v-model="editing.enabled" type="checkbox" /><span>保存后启用调度</span></label><button class="button primary save-button" type="submit" :disabled="loading"><UiIcon name="check" size="14" />{{ editing.id ? "保存修改" : "创建任务" }}</button>
        </form>
      </aside>
      <section class="panel list-panel">
        <div class="list-toolbar"><div><h2>定时任务</h2><p>共 {{ filteredTasks.length }} 条任务，实时掌握调度状态</p></div><div class="list-toolbar-actions"><label class="search-box"><UiIcon name="search" size="15" /><input v-model="searchQuery" placeholder="搜索任务名称、脚本路径或关键字..." /></label><label class="switch-label"><input v-model="autoRefresh" type="checkbox" /><span class="switch"></span>自动刷新</label><button class="button ghost" @click="runAction(store.refresh)"><UiIcon name="refresh" size="14" />刷新</button><input ref="importInput" type="file" accept="application/json" hidden @change="handleImport" /><button class="button ghost" @click="importInput?.click()"><UiIcon name="upload" size="14" />导入</button><button class="button ghost" @click="runAction(store.downloadExport)"><UiIcon name="download" size="14" />导出</button><button class="button primary create-button" @click="openCreate"><UiIcon name="plus" size="14" />新建任务</button></div></div>
        <div class="table-head"><span>任务名称</span><span>执行方式</span><span>命令路径</span><span>脚本路径</span><span>Cron 表达式</span><span>状态</span><span>下次运行时间</span><span>操作</span></div>
        <div v-if="loading && !tasks.length" class="empty-state"><span class="spinner"></span><p>正在加载任务…</p></div>
        <div v-else-if="!tasks.length" class="empty-state"><img src="/assets/illustrations/empty-task-search.png" alt="空任务列表插画" /><h3>还没有任务</h3><p>创建一个定时任务，让重复工作自动运行。</p><button class="button primary" @click="openCreate"><UiIcon name="plus" size="14" />新建任务</button></div>
        <div v-else-if="!filteredTasks.length" class="empty-state empty-state--small"><UiIcon name="search" size="28" /><h3>没有匹配的任务</h3><p>试试其他任务名称、脚本路径或关键字。</p></div>
        <div v-else class="task-list">
          <article v-for="task in filteredTasks" :key="task.id" class="task-row" :class="{ expanded: expanded.has(task.id) }">
            <div class="task-cell task-name"><div class="status-line"><span class="status-dot" :class="status(task)"></span><span class="status" :class="status(task)">{{ statusText(task) }}</span></div><strong>{{ task.name }}</strong><small>{{ task.scriptPath || task.commandPath || "未设置执行路径" }}</small><div class="task-timestamps"><span><UiIcon name="clock" size="11" />上次运行&nbsp; {{ formatTime(task.lastRunAt) }}</span><span><UiIcon name="calendar" size="11" />下次运行&nbsp; {{ task.enabled ? (task.nextRunAt ? formatTime(task.nextRunAt) : "计算中") : "已暂停" }}</span></div></div>
            <div class="task-cell"><span class="method-tag"><UiIcon :name="task.runnerType.startsWith('conda') ? 'conda' : task.runnerType === 'cmd' ? 'command' : task.runnerType === 'executable' ? 'command' : 'python'" size="12" />{{ runnerLabel[task.runnerType] }}</span></div>
            <div class="task-cell path-cell" :title="task.commandPath">{{ task.commandPath || "—" }}</div>
            <div class="task-cell path-cell" :title="task.scriptPath">{{ task.scriptPath || "—" }}</div>
            <div class="task-cell cron-cell"><code>{{ task.schedule }}</code><small>{{ describeSchedule(task.schedule) }}</small></div>
            <div class="task-cell"><span class="status" :class="status(task)">{{ statusText(task) }}</span></div>
            <div class="task-cell next-run"><strong>{{ task.enabled ? (task.nextRunAt ? formatTime(task.nextRunAt) : "计算中") : "已暂停" }}</strong><small>{{ task.enabled && task.nextRunAt ? "预计执行" : task.enabled ? "等待调度器" : "手动暂停" }}</small></div>
            <div class="task-cell action-cell"><button class="row-action" title="立即执行" :disabled="task.running" @click="runAction(() => store.run(task))"><UiIcon name="play" size="12" /></button><button class="row-action" :title="task.enabled ? '暂停调度' : '启动调度'" @click="runAction(() => store.toggle(task))"><UiIcon :name="task.enabled ? 'pause' : 'play'" size="12" /></button><button class="row-action" title="展开详情" @click="toggleExpanded(task.id)"><UiIcon name="more" size="15" /></button></div>
            <div v-if="expanded.has(task.id)" class="task-details"><dl><dt>执行方式</dt><dd>{{ runnerLabel[task.runnerType] }}</dd><dt v-if="task.scriptPath">脚本路径</dt><dd v-if="task.scriptPath">{{ task.scriptPath }}</dd><dt v-if="task.commandPath">{{ task.runnerType === "executable" ? "程序路径" : "命令路径" }}</dt><dd v-if="task.commandPath">{{ task.commandPath }}</dd><dt v-if="task.args">启动参数</dt><dd v-if="task.args">{{ task.args }}</dd><dt v-if="task.workingDirectory">工作目录</dt><dd v-if="task.workingDirectory">{{ task.workingDirectory }}</dd><dt>失败重试</dt><dd>{{ task.retryCount }} 次 / 间隔 {{ task.retryDelaySeconds }} 秒</dd></dl><div class="log-box"><div class="log-head"><span>{{ task.running ? "实时日志" : "最近日志" }}<small v-if="(task.liveLog ?? task.logs[0])"> · {{ (task.liveLog ?? task.logs[0])?.status }}</small></span><button :disabled="!task.logs.length" @click="confirmAction(`确认清除「${task.name}」的日志？`, () => store.clearLogs(task))">清除</button></div><pre>{{ logOutput(task) }}</pre></div><div class="detail-actions"><button @click="openEdit(task)">编辑任务</button><button @click="runAction(() => store.run(task))">立即执行</button><button class="danger-text" :disabled="!task.running" @click="runAction(() => store.stop(task))">终止运行</button><button class="danger-text" @click="confirmAction(`确认删除「${task.name}」？`, () => store.remove(task))">删除任务</button></div></div>
          </article>
        </div>
        <div class="list-footer"><span>共 {{ filteredTasks.length }} 条任务</span><div class="pagination"><button disabled><UiIcon name="chevron-left" size="11" /></button><button class="active">1</button><button disabled><UiIcon name="chevron-right" size="11" /></button><select aria-label="每页数量"><option>10 条/页</option></select></div></div>
      </section>
      </section>
    </main>

  </div>
</template>
