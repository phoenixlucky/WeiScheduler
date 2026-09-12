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
│   ├── task.rs              任务、日志、执行模型
│   └── service.rs           校验、Cron、命令构建
├── infrastructure/
│   ├── storage.rs           JSON 文件存储、串行事务与原子写入
│   ├── process.rs           异步子进程执行
│   └── crypto.rs            SHA-256 导出校验
└── commands.rs              Tauri API、进程生命周期、后台调度循环
```

## 开发

```bash
npm install
npm run tauri:dev
```

纯前端构建可以用 `npm run build`；Rust 侧检查用 `cargo check --manifest-path src-tauri/Cargo.toml`。

任务数据继续使用 `%APPDATA%/WeiScheduler/data/tasks.json`，因此从旧版升级时会自动沿用已有任务。保存、导入和后台运行结果更新都在同一存储事务中串行提交；Windows 替换文件时保留临时恢复备份，检测到损坏 JSON 时也会先备份原文件。新版导入同时兼容旧版 `pythonPath` 字段和 `{ tasks: [...] }` 导出包格式。
