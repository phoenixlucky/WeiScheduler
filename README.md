# 🌸 WeiScheduler（尉定时任务调度器）

> **A lightweight, local-first script scheduler with a dreamy anime-style UI**
>
> 一个轻量级、本地优先的脚本 / CMD 定时任务调度器，拥有多套精美主题皮肤。

---

## 🎨 皮肤预览

| 皮肤 | 风格 | 色系 |
|------|------|------|
| 🌸 **豆蔻少女** | 日系治愈·玻璃拟态 | 樱花粉 · 奶油白 · 淡紫 |
| 🌅 **新海诚黄昏** | 青春电影·光影层次 | 晚霞橙 · 天空蓝 · 紫云 |
| 🌊 **深海梦境** | 空灵冥想·水下梦境 | 深海蓝 · 冰川青 · 荧光 |
| 💻 **黑客终端** | 极客赛博·CRT 质感 | 纯黑 · 荧光绿 · 暗灰 |
| 🏯 **秦帝国黑金** | 帝国威严·青铜纹理 | 玄黑 · 暗金 · 青铜绿 |
| 🔮 **魔女炼金** | 神秘幻想·古典魔法 | 深紫 · 暗金 · 月光银 |

当前版本：**`1.7.0`**

---

## 🚀 Quick Start / 快速开始

```bash
npm install
npm start
```

Web 模式（浏览器访问 `localhost:3000`）：

```bash
npm run start:web
```

### Scripts / 脚本说明

| 命令 | 说明 |
|------|------|
| `npm start` | 启动 Electron 桌面应用 |
| `npm run start:web` | 启动纯 Web 服务 |
| `npm run dist` | 打包为 Windows 安装包（NSIS） |

### Build / 构建 Windows 安装包

```bash
# 清理旧产物
Remove-Item -Recurse -Force release, dist

# 打包
npm run dist
```

打包完成后安装包生成在 `release/` 下。

---

## 🛠 Usage Guide / 使用指南

### 任务字段说明

| 字段 | 说明 |
|------|------|
| 任务名称 | 自定义任务标识，例如「日报生成」 |
| 执行方式 | 直接 Python / Conda 环境名 / Conda 环境路径 / CMD 或 BAT |
| Python / Conda 命令路径 | Python 模式必填 `python.exe`；Conda 模式选填 |
| Conda 环境名或路径 | Conda 模式必填 |
| 脚本路径 / CMD 命令 | Python/Conda 填 `.py` 文件路径；CMD 模式填命令文本或 `.bat` / `.cmd` 路径 |
| 启动参数 | 可选，例如 `--date "2026-03-19"` |
| 时间参数名/值 | 可选，执行时自动追加到命令行 |
| 工作目录 | 可选，默认脚本所在目录 |
| Cron 表达式 | 五段格式，可视化滑块 + 高级编辑双模式 |

### 常见 Cron 示例

| 表达式 | 含义 |
|--------|------|
| `*/5 * * * *` | 每 5 分钟 |
| `0 * * * *` | 每小时整点 |
| `0 */3 * * *` | 每 3 小时 |
| `0 9 * * *` | 每天 09:00 |
| `0 9 * * 1-5` | 工作日 09:00 |
| `30 23 * * *` | 每天 23:30 |
| `0 0 1 * *` | 每月 1 日 |

---

## 📁 Data / 数据文件

任务数据保存在 `data/tasks.json`，主题偏好保存在 Electron 用户数据目录下的 `theme.json`。

### Conda 跨机器建议

- 跨电脑共享任务时优先使用 **Conda 环境名**
- 例如填写 `py3143` 而非 `C:\Users\xxx\.conda\envs\py3143`
- 程序会优先通过 Conda 环境列表定位环境

---

## 📦 Tech Stack / 技术栈

- **Frontend:** Vanilla JS, CSS Custom Properties, Glassmorphism
- **Backend:** Node.js, Express
- **Desktop:** Electron
- **Scheduling:** node-cron

---

## 📜 License

MIT © 2026 [Ethan Wilkins](https://github.com/phoenixlucky)

---

## 📋 Changelog

完整版本更新记录见 [CHANGELOG.md](./CHANGELOG.md)。

### v1.4.0

- 🌸 **全新豆蔻少女版 UI** — 樱花粉 × 奶油白 × 淡紫渐变，玻璃拟态卡片
- 🎨 **主题系统架构** — 支持 6 套皮肤动态切换，主菜单「皮肤」子菜单
- 🌅 **新海诚黄昏风** — 晚霞橙电影光影，城市灯火闪烁
- 🌊 **深海梦境风** — 深海蓝冥想氛围，荧光粒子飘浮
- 💻 **黑客终端风** — 荧光绿 CRT 扫描线，矩阵数据流
- 🏯 **秦帝国黑金风** — 玄黑暗金青铜纹理，帝国威严布局
- 🔮 **魔女炼金风** — 深紫月光银，魔法星象与炼金符号
