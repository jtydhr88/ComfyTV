# PreVision 最新预览固定入口：任务级证据

任务：`04.17-stable-local-preview-launcher`

基线：`526c94e89f619aaae462365fa20bb642d9ab3752`

风险：R2

阶段：快速本机预览基础设施；不是固定 App 正式交付，也不是对外发布。

## 产品边界

- 双击入口固定为 `$HOME/Applications/PreVision 最新预览.app`。
- 入口只是小型启动器，不含完整 PreVision 业务包，也不读取或替换固定 `PreVision.app`。
- 当前指针固定为 `$HOME/Library/Application Support/PreVision Latest Preview/current.json`，文件权限为 `0600`。
- pointer schema 2 记录锁定 Electron binary SHA-256；旧 schema 或缺少该指纹的 pointer fail closed。
- pointer 通过 `O_RDONLY|O_NOFOLLOW|O_NONBLOCK` 打开，类型、权限、大小、读取和 JSON 解析均绑定同一 FileHandle/inode；FIFO/特殊文件不会在类型检查前阻塞。
- 启动器 bundle 不内置 preview commit；精确 commit 只来自上述项目外原子指针，安装配置也不含全零或其他 commit 占位。
- Electron `userData` 与 `sessionData` 固定在上述 Application Support 目录的隔离 profile 内。
- 发布脚本只接受显式 Worktree、40 位 commit 和包含 `NOT INTEGRATED` 的标题；指针使用临时文件、file fsync、原子 rename 和 directory fsync。
- 启动器不搜索旧指针、不搜索其他 Worktree、不回退固定 App，也不执行 `killall` / `pkill`。

## 启动验证链

```text
双击小型 launcher
  → 锁定 Node 20–24 runtime 与 launcher 资源哈希
  → no-follow 打开唯一 current.json，并在同一 inode 上 stat/read/JSON
  → 精确 Worktree realpath + HEAD commit
  → git status clean（含未跟踪文件）
  → buildHtml() 与已提交生成 HTML 逐字节一致
  → package.json / package-lock / installed Electron / dist version 四方一致
  → Electron binary SHA-256 与 pointer 一致，并在 spawn 前再次复核
  → Electron binary、main entry 与隔离 profile 均为安全类型
  → 生成项目外 bootstrap，强制窗口标题包含指针标题
  → 以独立 profile 启动所选 Worktree
```

任一检查失败都使用现有 `i18n/locales` language key 生成本机提示前缀，并附稳定错误码与实际/期望事实。新脚本没有内联新增中文运行时文案，也没有扩大到现有语言包。

## 自动验证

Node：`v24.18.0`

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run test:latest-preview` | PASS，56/0 | 增加确定性 pointer TOCTOU、直接 symlink/FIFO 与同版本 Electron binary 替换反例 |
| `npm run test:i18n` | PASS，217/0 | 返修后 language key 对齐与新增直接中文守卫 |
| `npm run test:desktop` | PASS，47/0 | 返修后既有 Electron 壳、IPC 和语法边界 |
| `npm run test:foundation` | PASS | 返修后 foundation 151、C8 11、coordination 553、i18n 217、project-input wrapper 11 |
| `npm run test:impact -- --base 526c94e… --dry-run` | 只读评估 | 新脚本尚未登记 impact map，因此建议 full；本任务按明确开工单不改 impact map、不运行 full |

定向测试包含：

- 最小 launcher 安装到临时 HOME，且测试用固定 App 哨兵前后字节一致。
- 安装配置不携带 `sourceCommit`，已安装文本资源不含 40 位全零 commit 占位。
- 既有目标 bundle identity 不匹配时拒绝覆盖。
- 重装激活前故障保留旧 launcher。
- 发布故障发生在原子替换前时，旧指针字节不变。
- FileHandle 打开后把路径确定性换成恶意 JSON symlink，读取结果仍来自原 inode；启动时直接面对 symlink 则拒绝。
- `O_NONBLOCK` 打开 FIFO 后立即以同一 FileHandle `stat` 拒绝非 regular，不进入阻塞读取。
- 发布后把 ignored `node_modules` 中 Electron binary 替换为同版本、仍可执行的不同字节，runtime 以 SHA-256 mismatch 拒绝；恢复原 binary 的安全对照通过。
- 指针缺失、Worktree 脏、commit 不匹配、Electron binary 缺失、profile 为 symlink、生成 HTML 过期均在启动前拒绝。
- 受控入口仅调用显式 Electron binary，不杀任何既有进程。

## 首次真实指针

- source commit：`aa0480932635096377bd1fcbb470da9f37cf1b65`
- title：`PreVision 03.15 Preview — NOT INTEGRATED`
- source Worktree 绝对路径只存项目外指针，不写入仓库。

## 独立 R2

- round1 冻结 HEAD：`85fcdc05264c8caf60ce6a9598fbb19c6e8946d1`。
- 结论：BLOCK；P2-1 为 pointer `lstat(path)`→`readFile(path)` TOCTOU，P2-2 为 Electron binary 仅比版本/可执行位而没有内容指纹。
- 当前状态：同一 claim 保持 ACTIVE；确定性反例、既定自动门禁、返修提交及其后的外部重装/重发/双击均已完成。
- 返修提交：`164edd29f77431ed3ca169552a3b8bbe78fc2683`；同一独立 R2 round2 尚未开始，仍不预称 PASS。

## 真实双击验证

- 当前安装器来源提交：`164edd29f77431ed3ca169552a3b8bbe78fc2683`。
- bundle identity：`com.prevision.latest-preview-launcher`；严格 codesign 验证通过；bundle 大小约 2.2 MiB，不是完整 PreVision App 副本。
- 返修后指针为 schema 2、权限 `0600`，source commit 与标题均与“首次真实指针”一致；记录并复核 Electron 43.1.0 binary SHA-256 `69cb21f6…ff136`。
- 首次真实发布发现验证器从调用方 cwd 执行目标 `buildHtml()`，导致 esbuild 注释路径不同而误判 HTML 过期。修正为在目标 Worktree 根目录构建并恢复原 cwd，新增跨 cwd 回归后，指定 HTML 逐字节验证通过。
- Finder 等价双击启动成功；`last-launch.json` 为 `status=ready`，`sourceCommit=aa04809…`，观察到的窗口标题精确为 `PreVision 03.15 Preview — NOT INTEGRATED`。
- 运行进程来自指针指定 Worktree 的锁定 Electron 43.1.0；`userData` 与 `sessionData` 分别位于独立 Profile/Session，目录权限均为 `0700`。
- 返修版真实启动约 7 秒写出新的 `status=ready`；标题、`aa04809…`、指定 Worktree Electron 来源和隔离 Profile/Session 再次匹配。
- 受控把项目外指针的 expected commit 临时改为 40 位全零后，真实启动明确显示 `LATEST_PREVIEW_COMMIT_MISMATCH`，并同时给出 expected/actual；没有启动新 Electron，也没有回退旧预览或固定 App。随后已用受控 publisher 原子恢复合法 `aa04809…` 指针，重新双击在约 6 秒内得到新的 `ready` 状态。
- 安装前后 `npm run app:status` 的固定 App installed source 均为 `b8da5f4f36a40010541700171cb246f2ca9de17b`，未更新固定 App。

原始项目/媒体字节、reservation token、canonical client/thread、PID 和本机绝对路径不进入本文件。
