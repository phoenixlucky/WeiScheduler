const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function quote(value) {
  return `"${value}"`;
}

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const packageJson = require(path.join(rootDir, "package.json"));
  const buildDir = path.join(rootDir, "build");
  const distDir = path.join(rootDir, "dist");
  const releaseDir = path.join(rootDir, "release");
  const installerScript = path.join(buildDir, "installer.nsi");
  const makensis = "C:\\Program Files (x86)\\NSIS\\makensis.exe";

  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  execSync("npm run build:exe", {
    cwd: rootDir,
    stdio: "inherit",
  });

  const compileCommand = [
    quote(makensis),
    `/DAPP_VERSION=${packageJson.version}`,
    `/DDIST_DIR=${quote(distDir)}`,
    `/DBUILD_DIR=${quote(buildDir)}`,
    `/DOUTPUT_DIR=${quote(releaseDir)}`,
    quote(installerScript),
  ].join(" ");

  execSync(compileCommand, {
    cwd: rootDir,
    stdio: "inherit",
  });
}

main();
