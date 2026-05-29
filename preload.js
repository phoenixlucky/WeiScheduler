/**
 * 🌸 preload.js — 主题切换 IPC 桥接
 * Bridges skin/theme switching between main & renderer processes
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__theme", {
  /** Get the current theme name — returns a Promise<string> */
  getTheme: () => ipcRenderer.invoke("get-theme"),

  /** Set a new theme by name */
  setTheme: (name) => ipcRenderer.invoke("set-theme", name),

  /** Listen for theme changes initiated from the main process (e.g. menu) */
  onThemeChanged: (callback) => {
    const handler = (_event, name) => callback(name);
    ipcRenderer.on("theme-changed", handler);
    // Return cleanup
    return () => ipcRenderer.removeListener("theme-changed", handler);
  },
});
