const assert = require("assert");
const { _private } = require("../server");

const task = _private.normalizeTask({
  name: "cmd self check",
  runnerType: "cmd",
  scriptPath: "echo hello",
  args: '"hello world"',
  schedule: "*/5 * * * *",
  enabled: true,
});

const execution = _private.buildExecution(task);

assert.strictEqual(task.runnerType, "cmd");
assert.strictEqual(execution.command, process.platform === "win32" ? "cmd.exe" : "cmd");
assert.deepStrictEqual(execution.args.slice(0, 3), ["/d", "/s", "/c"]);
assert.strictEqual(execution.args[3], 'echo hello "hello world"');

const batTask = _private.normalizeTask({
  name: "bat self check",
  runnerType: "cmd",
  scriptPath: "D:\\jobs with spaces\\run.bat",
  schedule: "*/5 * * * *",
  enabled: true,
});

assert.strictEqual(_private.buildExecution(batTask).args[3], '"D:\\jobs with spaces\\run.bat"');

console.log("cmd runner self-check passed");
