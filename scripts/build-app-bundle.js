const fs = require("fs");
const path = require("path");

function copy(source, target) {
  fs.cpSync(source, target, {
    recursive: true,
    force: true,
  });
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const distDir = path.join(rootDir, "dist");
  const appDir = path.join(distDir, "app");
  const nodeExe = process.execPath;

  fs.rmSync(appDir, { recursive: true, force: true });
  fs.mkdirSync(appDir, { recursive: true });

  copy(nodeExe, path.join(appDir, "node.exe"));
  copy(path.join(rootDir, "server.js"), path.join(appDir, "server.js"));
  copy(path.join(rootDir, "storage.js"), path.join(appDir, "storage.js"));
  copy(path.join(rootDir, "package.json"), path.join(appDir, "package.json"));
  copy(path.join(rootDir, "public"), path.join(appDir, "public"));
  copy(path.join(rootDir, "node_modules"), path.join(appDir, "node_modules"));

  fs.writeFileSync(
    path.join(appDir, "WeiScheduler.cmd"),
    [
      "@echo off",
      "setlocal",
      "cd /d %~dp0",
      "set WEISCHEDULER_OPEN_BROWSER=1",
      "\"%~dp0node.exe\" \"%~dp0server.js\"",
      "",
    ].join("\r\n"),
    "ascii"
  );

  fs.writeFileSync(
    path.join(appDir, "WeiScheduler.vbs"),
    [
      'Set shell = CreateObject("WScript.Shell")',
      'Set fso = CreateObject("Scripting.FileSystemObject")',
      'baseDir = fso.GetParentFolderName(WScript.ScriptFullName)',
      'shell.Run Chr(34) & baseDir & "\\WeiScheduler.cmd" & Chr(34), 0, False',
      "",
    ].join("\r\n"),
    "ascii"
  );
}

main();
