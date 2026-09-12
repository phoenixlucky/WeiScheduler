<p align="center">
  <img src="build/icon.ico" alt="WeiScheduler" width="96" height="96" />
</p>

<h1 align="center">🌸 WeiScheduler · 尉定时任务调度器</h1>

<p align="center">
  <em>轻量级 · 本地优先 · 多主题皮肤</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-41b883" alt="platform" />
  <img src="https://img.shields.io/badge/license-MIT-4e9af1" alt="license" />
  <img src="https://img.shields.io/badge/runtime-Tauri%202%20%2B%20Rust%20%2B%20Vue-90a4ae" alt="runtime" />
</p>

<p align="center">
  基于 <b>Cron 表达式</b> 的本地脚本调度器 —— 支持 <b>Python / Conda / CMD / BAT</b> 多种执行方式，
  开箱即用的数据自动化、定时任务管理工具。
</p>

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🧩 **多执行方式** | 直接 Python、Conda 环境名 / 环境路径、CMD / BAT 命令，一应俱全 |
| ⏰ **可视化 Cron** | 五段表达式，滑块可视化 + 高级编辑双模式，附中文描述实时预览 |
| 🎨 **7 套主题皮肤** | 从日系治愈到赛博黑客、帝国黑金到角色壁纸，一键切换零闪烁 |
| 🖥️ **桌面应用** | Tauri 2 桌面应用，Rust 负责调度、进程和本地数据 |
| 🛡️ **数据安全** | 原子写入 + 写队列互斥，杜绝任务数据损坏或丢失 |
| 🕘 **跨小时调度** | 每 3 小时 / 每 6 小时等长周期任务自动补偿触发，不遗漏整点 |
| 🌐 **Conda 跨机器友好** | 按环境名定位解释器，换电脑无需改路径 |

## 🎨 主题皮肤

| 皮肤 | 风格 | 色系 |
|------|------|------|
| 🌸 **豆蔻少女** | 日系治愈 · 玻璃拟态 | 樱花粉 · 奶油白 · 淡紫 |
| 🌅 **新海诚黄昏** | 青春电影 · 光影层次 | 晚霞橙 · 天空蓝 · 紫云 |
| 🌊 **深海梦境** | 空灵冥想 · 水下梦境 | 深海蓝 · 冰川青 · 荧光 |
| 💻 **黑客终端** | 极客赛博 · CRT 质感 | 纯黑 · 荧光绿 · 暗灰 |
| 🏯 **秦帝国黑金** | 帝国威严 · 青铜纹理 | 玄黑 · 暗金 · 青铜绿 |
| 🔮 **魔女炼金** | 神秘幻想 · 古典魔法 | 深紫 · 暗金 · 月光银 |
| 👑 **甄姬背景** | 角色壁纸 · 月白烟紫 | 月白 · 浅蓝 · 青灰 · 烟紫 · 淡粉 |

> 主题偏好持久化保存，重启自动恢复；桌面端还可通过应用菜单「皮肤」子菜单即时切换。

---

## 🚀 快速开始

### 环境要求

- **Rust stable**（含 `cargo`）
- **Node.js** ≥ 20（建议 LTS 版本）
- **npm**（随 Node.js 一同安装）

### 安装

```bash
npm install
```

版本号唯一手工来源是 `package.json`；执行 `npm run version:sync` 会同步 Cargo 元数据，Tauri 配置不再重复维护版本号。

### 启动

**桌面应用（推荐）** — 独立窗口 + 系统托盘：

```bash
npm start
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm start` | 启动 Tauri 桌面应用 |
| `npm run build` | 构建 Vue 前端 |
| `npm run tauri:build` | 构建 Tauri 安装包 |

---

## 🛠️ 使用指南

### 任务字段

| 字段 | 说明 |
|------|------|
| 任务名称 | 自定义任务标识，例如「日报生成」 |
| 执行方式 | 直接 Python / Conda 环境名 / Conda 环境路径 / CMD 或 BAT |
| Python / Conda 命令路径 | Python 模式必填 `python.exe`；Conda 模式选填 |
| Conda 环境名或路径 | Conda 模式必填 |
| 脚本路径 / CMD 命令 | Python / Conda 填 `.py` 文件路径；CMD 模式填命令文本或 `.bat` / `.cmd` 路径 |
| 启动参数 | 可选，例如 `--date "2026-03-19"` |
| 时间参数名 / 值 | 可选，执行时自动追加到命令行 |
| 工作目录 | 可选，默认脚本所在目录 |
| Cron 表达式 | 五段格式，可视化滑块 + 高级编辑双模式 |

### Cron 表达式速查

| 表达式 | 含义 |
|--------|------|
| `*/5 * * * *` | 每 5 分钟 |
| `0 * * * *` | 每小时整点 |
| `0 */3 * * *` | 每 3 小时 |
| `0 9 * * *` | 每天 09:00 |
| `0 9 * * 1-5` | 工作日 09:00 |
| `30 23 * * *` | 每天 23:30 |
| `0 0 1 * *` | 每月 1 日 |

### Conda 跨机器建议

- 跨电脑共享任务时，优先使用 **Conda 环境名**（如 `py3143`），而非绝对路径
  （如 `C:\Users\xxx\.conda\envs\py3143`）
- 程序会优先通过 `conda env list` 按环境名定位真实路径
- 找不到 `python.exe` 时自动回退到 `conda run --no-capture-output` 执行

---

## 📦 构建 Windows 安装包与便携版

在 Windows 下可直接双击项目根目录的 `build.bat`，或在终端执行：

```powershell
npm run tauri:build
```

打包完成后，安装包生成在 `src-tauri/target/release/bundle/` 目录下：

```
src-tauri/target/release/bundle/
└── nsis/WeiScheduler_<version>_x64-setup.exe
```

安装器由 Tauri 生成，支持 Windows 桌面安装和卸载。

`build.bat` 在完成 Tauri 构建后，还会生成：

```
release/
├── WeiScheduler_<version>_portable/      # 解压后可直接运行
└── WeiScheduler_<version>_portable.zip   # 便携版压缩包
```

便携版会将任务数据保存在自身目录下的 `data/` 文件夹，不写入 `%APPDATA%`，可直接复制到其他 Windows 电脑使用。解压后双击 `start-portable.bat` 或直接运行 `WeiScheduler.exe` 即可。

---

## 📁 数据与存储

| 数据 | 位置 | 说明 |
|------|------|------|
| 任务配置 | `%APPDATA%\WeiScheduler\data\tasks.json` | 所有定时任务的定义与状态；桌面端与 Web 端共用 |
| 主题偏好 | WebView 本地存储 | 记住你选择的皮肤 |

> 🛡️ **数据安全设计**：所有写入均为原子写入（临时文件 → rename），写入操作经互斥队列串行化；
> 即使 JSON 文件损坏也会自动备份并保留原文件，绝不静默清空任务。首次升级时会自动迁移旧版数据目录。

---

## 🗂️ 项目结构

```
WeiScheduler/
├── src/                 # Vue 3.5 + TypeScript + Pinia 前端
├── public/skins/        # 7 套主题皮肤 CSS
├── src-tauri/           # Rust domain/service/infrastructure/commands
├── scripts/             # 版本同步脚本
├── build/               # Tauri 图标资源
├── package.json
└── CHANGELOG.md
```

---

## 🧰 技术栈

| 层面 | 技术 |
|------|------|
| 🎨 Frontend | Vue 3.5 · TypeScript · Vite 8 · Pinia |
| ⚙️ Backend | Rust stable · Tauri 2.11 |
| 🖥️ Desktop | Tauri WebView |
| ⏱️ Scheduling | Rust Cron + Tokio |
| 📦 打包 | Tauri bundle |

---

## 📋 更新日志

完整的版本历史见 [CHANGELOG.md](./CHANGELOG.md)。

**v1.7.0**（2026-07-03）
- 🧩 新增 CMD / BAT 定时任务执行方式
- 🖥️ 新增 `run.bat` 启动菜单：安装依赖、启动桌面端、启动 Web 服务、打包

**v1.6.x**（2026-06）
- 👑 新增「甄姬背景」主题（设为默认主题），全套 7 套皮肤
- 🎨 全部皮肤对比度优化，新增文字层级变量

**v1.6.0**（2026-06-28）
- 🐛 修复定时任务偶发丢失的严重 Bug（原子写入 + 写队列互斥）
- 🎨 UI 全面重构：语义化 HTML、BEM 命名、响应式三端适配

**v1.4.0**（2026-05-29）
- 🌸 豆蔻少女版 UI 全面翻新，主题系统架构，新增 6 套皮肤

---

## 📜 开源协议

[MIT](./LICENSE) © 2026 [Ethan Wilkins](https://github.com/phoenixlucky)
