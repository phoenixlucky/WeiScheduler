const path = require("path");
const { app, BrowserWindow, Menu, dialog } = require("electron");

let mainWindow = null;
let startServer;
let stopServer;

const APP_NAME = "WeiScheduler";
const APP_AUTHOR = "Ethan Wilkins";
const APP_ID = "com.weischeduler.desktop";
const APP_DESCRIPTION = "一个面向 Windows 的本地桌面工具，用于集中管理和调度 Python 脚本任务。";
const APP_FEATURES = [
  "创建和编辑 Python / Conda 定时任务",
  "支持 Cron 表达式配置执行计划",
  "手动触发、停止与启停任务",
  "查看最近运行日志与执行状态",
];

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
  return [
    `软件名称：${APP_NAME}`,
    `版本：${app.getVersion()}`,
    `作者：${APP_AUTHOR}`,
    `应用标识：${APP_ID}`,
    "",
    "软件简介：",
    APP_DESCRIPTION,
    "",
    "主要功能：",
    ...APP_FEATURES.map((feature) => `- ${feature}`),
  ].join("\n");
}

async function showAboutDialog() {
  const version = app.getVersion();

  await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: `关于 ${APP_NAME}`,
    message: `${APP_NAME} v${version}`,
    detail: getAboutMessage(),
    buttons: ["确定"],
    icon: path.join(__dirname, "build", "icon.ico"),
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
          label: "关于 WeiScheduler",
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
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

async function bootstrap() {
  try {
    process.env.WEISCHEDULER_DATA_DIR = app.getPath("userData");
    ({ startServer, stopServer } = require("./server"));
    buildApplicationMenu();
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
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });

  app.whenReady().then(bootstrap);

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    stopServer().catch(() => {});
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const { port } = await startServer();
      createWindow(port);
    }
  });
}
