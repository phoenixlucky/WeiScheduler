const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain, Menu, Tray, dialog } = require("electron");

let mainWindow = null;
let tray = null;
let startServer;
let stopServer;
let isQuiting = false;

// 🌸 主题 / 皮肤管理
const THEMES = [
  { id: "zhenji", label: "👑 甄姬背景" },
  { id: "cardamom-maiden", label: "🌸 豆蔻少女" },
  { id: "shinkai-twilight", label: "🌅 新海诚黄昏" },
  { id: "deep-dream", label: "🌊 深海梦境" },
  { id: "hackers-terminal", label: "💻 黑客终端" },
  { id: "qin-empire", label: "🏯 秦帝国黑金" },
  { id: "witch-alchemy", label: "🔮 魔女炼金" },
];

function getThemeFilePath() {
  return path.join(app.getPath("userData"), "theme.json");
}

function loadTheme() {
  try {
    const raw = fs.readFileSync(getThemeFilePath(), "utf-8");
    const data = JSON.parse(raw);
    if (data && THEMES.some((t) => t.id === data.theme)) {
      return data.theme;
    }
  } catch (_) { /* ignore */ }
  return THEMES[0].id;
}

function saveTheme(name) {
  try {
    fs.writeFileSync(getThemeFilePath(), JSON.stringify({ theme: name }), "utf-8");
  } catch (_) { /* ignore */ }
}

let currentTheme = THEMES[0].id;

const APP_NAME_EN = "WeiScheduler";
const APP_NAME_ZH = "尉定时任务调度器";
const APP_NAME_FULL = "WeiScheduler（尉定时任务调度器）";
const APP_AUTHOR = "Ethan Wilkins";
const APP_ID = "com.weischeduler.desktop";
const APP_DESCRIPTION_ZH =
  "WeiScheduler 是一个基于 Node.js 的本地网页调度工具，用于按 Cron 表达式定时执行 Python 脚本。支持多种 Python/Conda 环境配置，适用于数据处理、自动化任务和脚本调度场景。";
const APP_DESCRIPTION_EN =
  "WeiScheduler is a web-based local task scheduler built on Node.js, designed to execute Python scripts based on Cron expressions. It supports multiple Python and Conda environment configurations, making it suitable for data processing, automation workflows, and scheduled scripting tasks.";
const APP_POSITIONING_ZH = "一个轻量级、本地优先的 Python 定时任务调度器，强调环境兼容性和可视化管理。";
const APP_POSITIONING_EN =
  "A lightweight, local-first Python task scheduler focused on environment compatibility and visual management.";
const APP_VERSION_HIGHLIGHT_ZH = "新增任务“下次执行时间”展示，优化调度可见性";
const APP_VERSION_HIGHLIGHT_EN = "Added next-run time display for better scheduling visibility";
const APP_FEATURES = [
  "创建和编辑 Python / Conda 定时任务",
  "支持 Cron 表达式配置执行计划",
  "手动触发、停止与启停任务",
  "查看最近运行日志与执行状态",
];

function isChineseLocale(locale = "") {
  return /^zh\b/i.test(String(locale || ""));
}

function getCurrentLocale() {
  return app.getLocale() || app.getSystemLocale() || "";
}

function getLocalizedInstallName(locale = getCurrentLocale()) {
  return isChineseLocale(locale) ? APP_NAME_ZH : APP_NAME_EN;
}

function getAppIconPath() {
  const bundledIcon = path.join(process.resourcesPath, "icon.ico");
  return app.isPackaged ? bundledIcon : path.join(__dirname, "build", "icon.ico");
}

function showMainWindow() {
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  if (!mainWindow) {
    return;
  }

  mainWindow.hide();
}

function createTray() {
  if (tray) {
    return tray;
  }

  tray = new Tray(getAppIconPath());
  tray.setToolTip(getLocalizedInstallName());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示主窗口",
        click: () => {
          showMainWindow();
        },
      },
      {
        label: "退出",
        click: () => {
          isQuiting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("double-click", () => {
    showMainWindow();
  });

  return tray;
}

function isAutoLaunchEnabled() {
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunchEnabled(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false,
    path: process.execPath,
  });
}

const ABOUT_ANCIENT_WISDOM =
  "举贤任能，不时日而事利；明法审令，不卜筮而获吉；贵功养劳，不祷祠而得福。";

function buildAboutHtml() {
  const version = app.getVersion();
  const featuresHtml = APP_FEATURES.map((f) => `<li>${f}</li>`).join("\n");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>关于 ${APP_NAME_FULL}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", "Noto Sans SC", "Segoe UI", sans-serif;
    background: linear-gradient(160deg, #f0e6d3 0%, #dccdb5 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    color: #2c1810;
  }
  .about-card {
    max-width: 520px;
    width: 100%;
    background: linear-gradient(165deg, rgba(251,243,228,0.97), rgba(240,230,210,0.88));
    border: 1px solid #b8943a;
    border-radius: 24px;
    padding: 32px 36px;
    box-shadow: 0 22px 60px rgba(40,28,18,0.18);
  }
  .about-header {
    text-align: center;
    margin-bottom: 20px;
  }
  .about-header h1 {
    font-size: 1.5rem;
    color: #5a3e20;
    margin-bottom: 4px;
  }
  .about-header .version {
    font-size: 0.95rem;
    color: #8a6d3b;
    font-weight: 600;
  }
  .about-author {
    text-align: center;
    font-size: 0.85rem;
    color: #7a6a58;
    margin-bottom: 20px;
  }
  .about-section {
    margin-bottom: 16px;
  }
  .about-section h2 {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #b8943a;
    margin-bottom: 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(196,154,69,0.12);
  }
  .about-section p, .about-section ul {
    font-size: 0.88rem;
    line-height: 1.7;
    color: #2c1810;
  }
  .about-section ul {
    list-style: none;
    padding: 0;
  }
  .about-section li {
    padding: 2px 0;
  }
  .about-section li::before {
    content: "• ";
    color: #b8943a;
    font-weight: bold;
  }
  .about-feature-hl {
    margin-top: 4px;
  }
  .wisdom-block {
    margin: 20px 0 8px;
    padding: 16px 18px;
    background: linear-gradient(135deg, rgba(196,154,69,0.12), rgba(196,154,69,0.06));
    border-left: 4px solid #b8943a;
    border-radius: 8px;
    font-size: 0.88rem;
    line-height: 1.8;
    color: #5a3e20;
    font-weight: 600;
    text-align: center;
  }
  .wisdom-block::before {
    content: "✦ ";
    color: #b8943a;
  }
  .wisdom-block::after {
    content: " ✦";
    color: #b8943a;
  }
  .about-version-hl {
    margin-top: 8px;
    font-size: 0.85rem;
    color: #7a6a58;
    line-height: 1.5;
  }
  .about-version-hl strong {
    color: #5a3e20;
  }
  .about-footer {
    text-align: center;
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid rgba(196,154,69,0.12);
  }
  .about-footer button {
    background: linear-gradient(135deg, #8a6d3b 0%, #5a3e20 100%);
    color: #fbf3e4;
    border: none;
    border-radius: 999px;
    padding: 10px 28px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 12px 20px rgba(90,62,32,0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    font-family: inherit;
  }
  .about-footer button:hover {
    transform: translateY(-1.5px);
    box-shadow: 0 16px 28px rgba(90,62,32,0.32);
  }
  .about-footer button:active {
    transform: translateY(0);
  }
</style>
</head>
<body>
<div class="about-card">
  <div class="about-header">
    <h1>${APP_NAME_FULL}</h1>
    <div class="version">v${version}</div>
  </div>
  <div class="about-author">作者：${APP_AUTHOR} &middot; ${APP_ID}</div>

  <div class="about-section">
    <h2>软件简介</h2>
    <p>${APP_DESCRIPTION_ZH}</p>
  </div>

  <div class="about-section">
    <h2>Core Positioning</h2>
    <p>${APP_POSITIONING_EN}</p>
  </div>

  <div class="about-section">
    <h2>主要功能</h2>
    <ul>${featuresHtml}</ul>
  </div>

  <div class="about-section about-version-hl">
    <h2>版本说明</h2>
    <p><strong>v${version}</strong> &mdash; ${APP_VERSION_HIGHLIGHT_ZH}</p>
    <p>${APP_VERSION_HIGHLIGHT_EN}</p>
  </div>

  <div class="wisdom-block">${ABOUT_ANCIENT_WISDOM}</div>

  <div class="about-footer">
    <button onclick="window.close()" id="btn-ok">确定</button>
  </div>
</div>
</body>
</html>`;
}

function showAboutDialog() {
  const version = app.getVersion();

  const aboutWin = new BrowserWindow({
    width: 540,
    height: 620,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: `关于 ${APP_NAME_FULL}`,
    icon: getAppIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
    },
  });

  aboutWin.removeMenu();
  aboutWin.setMenu(null);
  aboutWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildAboutHtml())}`);
}

function buildApplicationMenu() {
  const openAtLogin = isAutoLaunchEnabled();
  const themeItems = THEMES.map((t) => ({
    label: t.label,
    type: "radio",
    checked: currentTheme === t.id,
    click: () => {
      setTheme(t.id);
    },
  }));

  const template = [
    {
      label: "设置",
      submenu: [
        {
          label: "开机自启动",
          type: "checkbox",
          checked: openAtLogin,
          click: (menuItem) => {
            setAutoLaunchEnabled(menuItem.checked);
          },
        },
      ],
    },
    {
      label: "皮肤",
      submenu: themeItems,
    },
    {
      label: "关于",
      submenu: [
        {
          label: `关于 ${APP_NAME_FULL}`,
          click: showAboutDialog,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setTheme(name) {
  currentTheme = name;
  saveTheme(name);

  // Rebuild menu to reflect the new radio selection
  buildApplicationMenu();

  // Notify the renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("theme-changed", name);
  }
}

function setupThemeIPC() {
  ipcMain.handle("get-theme", () => currentTheme);

  ipcMain.handle("set-theme", (_event, name) => {
    if (THEMES.some((t) => t.id === name)) {
      setTheme(name);
    }
    return currentTheme;
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    autoHideMenuBar: false,
    icon: getAppIconPath(),
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    // Notify the renderer of the current theme
    mainWindow.webContents.send("theme-changed", currentTheme);
  });

  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    hideMainWindow();
  });

  mainWindow.on("close", (event) => {
    if (isQuiting) {
      return;
    }

    event.preventDefault();
    hideMainWindow();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

async function bootstrap() {
  try {
    app.setName(getLocalizedInstallName());
    const dataRoot = path.join(app.getPath("appData"), APP_NAME_EN);
    const legacyDataRoots = [
      app.getPath("userData"),
      path.join(app.getPath("appData"), APP_NAME_ZH),
      path.dirname(process.execPath),
      __dirname,
    ];
    process.env.WEISCHEDULER_DATA_DIR = dataRoot;
    process.env.WEISCHEDULER_LEGACY_DATA_DIRS = [...new Set(legacyDataRoots)].join(path.delimiter);
    currentTheme = loadTheme();
    ({ startServer, stopServer } = require("./server"));
    buildApplicationMenu();
    setupThemeIPC();
    createTray();
    const { port } = await startServer();
    createWindow(port);
  } catch (error) {
    dialog.showErrorBox("WeiScheduler 启动失败", error.message);
    app.quit();
  }
}

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) {
      return;
    }
    showMainWindow();
  });

  app.whenReady().then(bootstrap);

  app.on("window-all-closed", () => {
    // Keep background scheduling alive in the tray until the user exits explicitly.
  });

  app.on("before-quit", () => {
    isQuiting = true;
    stopServer().catch(() => {});
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const { port } = await startServer();
      createWindow(port);
      return;
    }

    showMainWindow();
  });
}
