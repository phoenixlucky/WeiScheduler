const path = require("path");
const { app, BrowserWindow, Menu, Tray, dialog } = require("electron");

let mainWindow = null;
let tray = null;
let startServer;
let stopServer;
let isQuiting = false;

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

function getAboutMessage() {
  const version = `v${app.getVersion()}`;
  return [
    `软件名称：${APP_NAME_FULL}`,
    `Software Name: ${APP_NAME_EN}`,
    "",
    `当前版本：${version}`,
    `Latest Version: ${version}`,
    `作者：${APP_AUTHOR}`,
    `应用标识：${APP_ID}`,
    "",
    "软件简介（中文）：",
    APP_DESCRIPTION_ZH,
    "",
    "Software Description (English):",
    APP_DESCRIPTION_EN,
    "",
    "核心定位（中文）：",
    APP_POSITIONING_ZH,
    "",
    "Core Positioning (English):",
    APP_POSITIONING_EN,
    "",
    "版本说明（简短）：",
    APP_VERSION_HIGHLIGHT_ZH,
    "",
    "Version Summary:",
    APP_VERSION_HIGHLIGHT_EN,
    "",
    "主要功能：",
    ...APP_FEATURES.map((feature) => `- ${feature}`),
  ].join("\n");
}

async function showAboutDialog() {
  const version = app.getVersion();

  await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: `关于 ${APP_NAME_FULL}`,
    message: `${APP_NAME_FULL} v${version}`,
    detail: getAboutMessage(),
    buttons: ["确定"],
    icon: getAppIconPath(),
  });
}

function buildApplicationMenu() {
  const openAtLogin = isAutoLaunchEnabled();
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
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
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
    process.env.WEISCHEDULER_DATA_DIR = app.getPath("userData");
    ({ startServer, stopServer } = require("./server"));
    buildApplicationMenu();
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
