const fs = require("fs");
const path = require("path");
const os = require("os");
const { randomUUID } = require("crypto");

// ─── Writer lock (serializes writes across async callbacks) ────────────
// Node's event loop naturally serialises synchronous I/O in the main
// thread, so Express route handlers cannot interleave.  However, async
// callbacks (child-process close/error) can and do interleave.  This
// per-file promise chain serialises those too.
const writerQueue = new Map();

function enqueueWrite(storeFile, fn) {
  const previous = writerQueue.get(storeFile) || Promise.resolve();
  const operation = previous.then(fn);

  // Keep the queue usable after a failed write, but return the original
  // operation so callers can report the error instead of silently losing it.
  writerQueue.set(storeFile, operation.catch(() => {}));
  return operation;
}

// ─── Data paths ─────────────────────────────────────────────────────────

const APP_DATA_DIR_NAME = "WeiScheduler";

function getDefaultDataRoot() {
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      APP_DATA_DIR_NAME
    );
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", APP_DATA_DIR_NAME);
  }

  return path.join(
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
    APP_DATA_DIR_NAME
  );
}

function getLegacyDataRoots() {
  const configuredRoots = String(process.env.WEISCHEDULER_LEGACY_DATA_DIRS || "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  const legacyRoot = process.pkg ? path.dirname(process.execPath) : __dirname;

  return [...new Set([...configuredRoots, legacyRoot])];
}

function getDataPaths() {
  const appRoot = process.env.WEISCHEDULER_DATA_DIR || getDefaultDataRoot();
  return {
    dataDir: path.join(appRoot, "data"),
    storeFile: path.join(appRoot, "data", "tasks.json"),
  };
}

function createEmptyStore() {
  return { tasks: [] };
}

// ─── File-level helpers ─────────────────────────────────────────────────

function ensureStore() {
  const { dataDir, storeFile } = getDataPaths();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (migrateLegacyStore(storeFile)) {
    return;
  }
  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(storeFile, JSON.stringify(createEmptyStore(), null, 2), "utf8");
  }
}

function isValidStore(store) {
  return Boolean(store) && typeof store === "object" && Array.isArray(store.tasks);
}

function readValidStore(filePath) {
  try {
    const store = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return isValidStore(store) ? store : null;
  } catch (_) {
    return null;
  }
}

function migrateLegacyStore(storeFile) {
  const migrationMarker = `${storeFile}.legacy-migration-v1`;
  if (fs.existsSync(migrationMarker)) {
    return false;
  }

  const currentFileExists = fs.existsSync(storeFile);
  const currentStore = currentFileExists ? readValidStore(storeFile) : null;
  if (currentFileExists && !currentStore) {
    // Preserve a broken current file so readStore() can back it up and report
    // the problem instead of replacing potentially recoverable data.
    return false;
  }
  if (currentStore && currentStore.tasks.length > 0) {
    return false;
  }

  const legacyStores = [];
  for (const legacyRoot of getLegacyDataRoots()) {
    const legacyFile = path.join(legacyRoot, "data", "tasks.json");
    if (path.resolve(legacyFile) === path.resolve(storeFile) || !fs.existsSync(legacyFile)) {
      continue;
    }

    const legacyStore = readValidStore(legacyFile);
    if (!legacyStore) {
      continue;
    }

    legacyStores.push({ file: legacyFile, store: legacyStore });
  }

  const source = legacyStores.find(({ store }) => store.tasks.length > 0) || legacyStores[0];
  if (!source || (currentStore && source.store.tasks.length === 0)) {
    return false;
  }

  atomicWriteSync(storeFile, JSON.stringify(source.store, null, 2));
  try {
    fs.writeFileSync(migrationMarker, new Date().toISOString(), "utf8");
  } catch (_) { /* migration succeeded; marker is only a best-effort guard */ }
  console.warn(`Migrated task store from ${source.file} to ${storeFile}`);
  return true;

}

function backupBrokenStore(storeFile, rawContent) {
  const backupFile = `${storeFile}.broken-${Date.now()}.json`;
  fs.writeFileSync(backupFile, rawContent, "utf8");
  console.warn(`Backed up corrupted store to ${backupFile}`);
  return backupFile;
}

// ─── Atomic write (temp + rename) ───────────────────────────────────────
// Prevents torn/corrupt reads on every platform: readers see either the
// old file or the new file, never a half-written one.

function atomicWriteSync(filePath, data) {
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`;
  try {
    fs.writeFileSync(tmp, data, "utf8");
    fs.renameSync(tmp, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(tmp);
    } catch (_) { /* best effort cleanup */ }
    throw error;
  }
}

// ─── Read store ─────────────────────────────────────────────────────────
// CRITICAL: NEVER overwrites the file on parse failure.  If the JSON is
// corrupt we return an empty in-memory store but keep the file untouched
// so a human can restore from the backup.

function readStore() {
  const { storeFile } = getDataPaths();
  ensureStore();
  const rawContent = fs.readFileSync(storeFile, "utf8");

  try {
    const store = JSON.parse(rawContent);
    if (!isValidStore(store)) {
      console.error('tasks.json is missing the "tasks" array — returning empty in-memory store (file preserved)');
      return createEmptyStore();
    }
    return store;
  } catch (error) {
    backupBrokenStore(storeFile, rawContent);
    console.error(
      `Failed to parse store file — returning empty in-memory store (file preserved): ${error.message}`
    );
    return createEmptyStore();
  }
}

// ─── Public read API (synchronous) ──────────────────────────────────────

function getTasks() {
  return readStore().tasks.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

function getTask(taskId) {
  return readStore().tasks.find((task) => task.id === taskId);
}

// ─── Public write API (return Promises via the serialisation queue) ─────

function saveTask(task) {
  return enqueueWrite(getDataPaths().storeFile, () => {
    const store = readStore();
    const index = store.tasks.findIndex((item) => item.id === task.id);
    if (index >= 0) {
      store.tasks[index] = task;
    } else {
      store.tasks.push(task);
    }
    atomicWriteSync(getDataPaths().storeFile, JSON.stringify(store, null, 2));
    return task;
  });
}

function deleteTask(taskId) {
  return enqueueWrite(getDataPaths().storeFile, () => {
    const store = readStore();
    store.tasks = store.tasks.filter((task) => task.id !== taskId);
    atomicWriteSync(getDataPaths().storeFile, JSON.stringify(store, null, 2));
  });
}

function appendRunLog(taskId, log) {
  return enqueueWrite(getDataPaths().storeFile, () => {
    const store = readStore();
    const task = store.tasks.find((item) => item.id === taskId);
    if (!task) return;
    task.logs = Array.isArray(task.logs) ? task.logs : [];
    task.logs.unshift(log);
    task.logs = task.logs.slice(0, 20);
    atomicWriteSync(getDataPaths().storeFile, JSON.stringify(store, null, 2));
  });
}

function clearTaskLogs(taskId) {
  return enqueueWrite(getDataPaths().storeFile, () => {
    const store = readStore();
    const task = store.tasks.find((item) => item.id === taskId);
    if (!task) return null;
    task.logs = [];
    atomicWriteSync(getDataPaths().storeFile, JSON.stringify(store, null, 2));
    return task;
  });
}

function clearActiveRun(_taskId) {}

module.exports = {
  ensureStore,
  getTasks,
  getTask,
  saveTask,
  deleteTask,
  appendRunLog,
  clearTaskLogs,
  clearActiveRun,
};
