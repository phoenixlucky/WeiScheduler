const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJsonPath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package version: ${version}`);
}

function replaceFile(filePath, transform) {
  const before = fs.readFileSync(filePath, "utf8");
  const after = transform(before);
  if (after !== before) fs.writeFileSync(filePath, after, "utf8");
}

replaceFile(path.join(root, "src-tauri", "Cargo.toml"), (content) => {
  const pattern = /(^version\s*=\s*")[^"]+(")/m;
  if (!pattern.test(content)) throw new Error("Cargo.toml package version field was not found");
  return content.replace(pattern, `$1${version}$2`);
});

replaceFile(path.join(root, "src-tauri", "Cargo.lock"), (content) => {
  const pattern = /(\[\[package\]\]\r?\nname = "weischeduler"\r?\nversion = ")[^"]+("\r?\n)/;
  if (!pattern.test(content)) throw new Error("Cargo.lock WeiScheduler package entry was not found");
  return content.replace(pattern, `$1${version}$2`);
});

console.log(`Version synchronized from package.json: ${version}`);
