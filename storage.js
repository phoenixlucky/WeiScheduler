const fs = require("fs");
const path = require("path");

// ─── Writer lock (serializes writes across async callbacks) ────────────
// Node's event loop naturally serialises synchronous I/O in the main
// thread, so Express route handlers cannot interleave.  However, async
// callbacks (child-process close/error) can and do interleave.  This
// per-file promise chain serialises those too.
const writerQueue = new Map();

function enqueueWrite(storeFile, fn) {
  const chain = writerQueue.get(storeFile) || Promise.resolve();
  const next = chain.then(() => fn()).catch(() => {});
  writerQueue.set(storeFile, next);
  return next;
}

// ─── Data paths ─────────────────────────────────────────────────────────

function getDataPaths() {
  const appRoot =
    process.env.WEISCHEDULER_DATA_DIR ||
    (process.pkg ? path.dirname(process.execPath) : __dirname);
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
  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(storeFile, JSON.stringify(createEmptyStore(), null, 2), "utf8");
  }
}

function isValidStore(store) {
  return Boolean(store) && typeof store === "object" && Array.isArray(store.tasks);
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
  const tmp = `${filePath}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, data, "utf8");
  fs.renameSync(tmp, filePath);
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
