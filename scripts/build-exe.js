const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const distDir = path.join(rootDir, "dist");
  const outputFile = path.join(distDir, "scriptScheduler.exe");
  const pkgCommand = process.platform === "win32"
    ? path.join(rootDir, "node_modules", ".bin", "pkg.cmd")
    : path.join(rootDir, "node_modules", ".bin", "pkg");

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  execSync(`"${pkgCommand}" . --targets node18-win-x64 --output "${outputFile}"`, {
    cwd: rootDir,
    stdio: "inherit",
  });
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
