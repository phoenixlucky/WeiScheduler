# WeiScheduler 2.0 架构

项目已切换到 Tauri 2.11+、Rust stable、Vue 3.5、TypeScript、Vite 8 和 Pinia。

```text
src/                         Vue 应用层
├── App.vue                  页面与交互
├── stores/tasks.ts          Pinia 状态、轮询、用户操作
├── services/tauri.ts       Tauri command 类型化桥接
└── types/task.ts            前后端共享的数据契约

src-tauri/src/
├── domain/
│   ├── task.rs              任务、日志、执行模型（含通用程序、环境变量、重试配置）
│   └── service.rs           校验、Cron、命令构建与环境变量校验
├── infrastructure/
│   ├── storage.rs           JSON 文件存储、串行事务与原子写入
│   ├── process.rs           异步子进程执行
│   └── crypto.rs            SHA-256 导出校验
└── commands.rs              Tauri API、进程/重试生命周期、后台调度循环
```

## 开发

```bash
npm install
npm run tauri:dev
```

纯前端构建可以用 `npm run build`；Rust 侧检查用 `cargo check --manifest-path src-tauri/Cargo.toml`。

任务数据继续使用 `%APPDATA%/WeiScheduler/data/tasks.json`，因此从旧版升级时会自动沿用已有任务。保存、导入和后台运行结果更新都在同一存储事务中串行提交；Windows 替换文件时保留临时恢复备份，检测到损坏 JSON 时也会先备份原文件。导入当前使用版本 3，并兼容旧版 `pythonPath` 字段、缺失的环境变量/重试字段和 `{ tasks: [...] }` 导出包格式。

执行器支持四类兼容模式和一种通用模式：Python、Conda 环境名、Conda 环境路径、CMD/BAT，以及直接启动任意可执行程序。通用程序通过 `commandPath` 和拆分后的 `args` 启动，环境变量仅注入该进程。每个任务最多建立一条执行链；失败时按固定次数和间隔重试，重试等待期间仍视为运行中，新的 Cron 触发会跳过。
