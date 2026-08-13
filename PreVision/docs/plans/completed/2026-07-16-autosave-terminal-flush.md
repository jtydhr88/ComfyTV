# 任务：01.12｜关闭与刷新前末次自动保存防丢

- 状态：completed（独立任务级实现与回归完成，claim 保留等待 00 集成）
- 日期：2026-07-16
- 对话：用户侧栏可见独立短期 Bug 临时工 `01.12｜关闭与刷新前末次自动保存防丢`
- 分支：fix/01.12-autosave-terminal-flush
- 基线：a706161afd10daf3b090bf67c7b656599d344414
- 固定 App 来源：7ff9aa583b4e51fb4d888aa1815792b747d275d7（`app:status`：contains yes，exact no）
- 负责人：Codex 独立短期临时工

## 并行任务声明

- 任务 ID：01.12-autosave-terminal-flush
- 模式：write
- 模块：project,history,desktop,robustness,testing,i18n
- UI 表面：app-shell,topbar
- 数据区域：project-v5,autosave,electron-ipc,qa-metadata,i18n-resources
- 预计修改文件：`预见PreVision.html`、`electron/main.cjs`、`electron/preload.cjs`、`测试/冒烟测试.mjs`、`测试/桌面壳测试.mjs`、`测试/项目输入DOM探针.cjs`、`测试/项目输入探针启动测试.mjs`、`i18n/locales/zh-CN.js`、`i18n/locales/en-US.js`、`docs/FEATURE_REGISTRY.md`、`qa/feature-registry.yaml`、`qa/test-impact-map.yaml`、本验收单、`docs/plans/completed/README.md`、`docs/qa/autosave-terminal-flush/README.md`、`docs/qa/autosave-terminal-flush/evidence.json`
- `task:check` 结果：无硬冲突、无软冲突；共享登记中无 04.7 claim。若集成时仅 completed/README 文件重叠，仍按用户指定的 04.7 先、01.12 后处理
- `task:claim`：已登记
- `task:release`：未释放；由 00 集成成功或确认取消后释放

## 用户问题

当前 `markDirty()` 依赖 800ms `setTimeout` 写 autosave；真实编辑后不足 800ms 刷新、强制刷新、关闭窗口或退出可能丢失最后修改，Electron reload/forceReload/close 也没有已证明可靠的 pending-save 结算。

## 目标

- 建立唯一、同步、幂等、可复用的末次 autosave 结算入口，复用现有 `syncScene`、资产 GC、完整保存与 quota-lite 降级语义。
- 只在真实 dirty/pending 时写；干净刷新/关闭零写入。结算后取消 800ms timer；`pagehide`、`beforeunload`、Electron reload、force reload、close 重复到达最多一次有效写入。
- 末次结算必须包含尚未 `syncScene()` 的当前场景编辑，并可在隔离环境重开精确恢复最后合法状态。
- Electron renderer 生命周期不足时，只增加最小受限 IPC 握手，不扩张为新持久化服务。
- localStorage unavailable、quota、序列化与 IPC 异常不产生 uncaught/unhandled；完整写失败沿用 lite，二次失败不破坏此前有效 autosave。

## 非目标

- 不新增 undo，不改变 history index、合并策略、project v5、`AUTOSAVE_KEY` 或正常 800ms 节奏。
- 不处理其他审计问题，不拆分单体架构，不建立新的主进程项目持久化服务。
- 不读取、连接、复制、恢复或覆盖正式 userData，不关闭正在运行的固定 App。
- 不运行 `app:deliver`、`app:update`、`package`、`make`，不更新固定 App 或稳定预览，不占用端口 4175。

## 证据与现状

- 代码：`markDirty()` 当前只重置 800ms timer；timer 回调才执行 `syncScene()`、`gcAssets()`、项目根字段更新、完整 localStorage 写与 quota-lite 降级。
- Git：起始工作区 clean，HEAD 精确为 `a706161afd10daf3b090bf67c7b656599d344414`，分支与独立 Worktree 均符合任务指定。
- 测试/运行：默认 Node 26 不合规；本任务显式使用 `/opt/homebrew/opt/node@24/bin` 的 Node 24.18.0。`app:status` 已确认 installed source；`task:status` 开工时无 active claim。
- 文档/历史线索：项目打开事务已有 invalid/open fault/rollback 与 pending timer 隔离回归；本任务必须保持这些语义。

## 影响范围

- 模块：project、history、desktop、robustness、testing、i18n。
- 文件：以并行任务声明为上限，实际修改按最小实现收敛。
- 数据格式：无；保持 project v5 与 `previz_autosave_v3`。
- 平台：Web Chromium 与 macOS Electron，均使用隔离存储。

## 风险

- 数据：重复生命周期事件可能重复写入；异常路径可能覆盖此前有效 autosave，或把 invalid/open fault/rollback 状态错误写回。
- UI/交互：刷新、强制刷新和关闭不得出现卡死、递归关闭或永久阻止退出。
- 安全：Electron IPC 必须受 renderer/window 绑定并保持最小化；测试不得触及正式 userData 或用户项目。
- 发布：本轮仅快速开发与任务级验证，固定 App 保持 `7ff9aa5`，不执行正式交付。

## 验收条件

- [x] 唯一同步幂等的 terminal autosave flush 入口复用正常 autosave 序列化、GC 与 lite 降级；正常 800ms 节奏不变。
- [x] 真实 dirty/pending 才写；干净生命周期事件零写入；重复 `pagehide`/`beforeunload` 最多一次有效写入。
- [x] 未同步的当前场景编辑在不足 800ms 的 Web/Electron reload、force reload、close-relaunch 后精确恢复。
- [x] localStorage unavailable/quota/序列化异常无 uncaught/unhandled，二次失败保留此前有效 autosave；未新增 IPC。
- [x] invalid startup、open 失败和 commit rollback 的既有回归保持通过，终止入口只消费真实 pending timer。
- [x] 修复前失败的自动回归先建立，再完成最小实现。
- [x] project、history、robustness、desktop、project-input、i18n、impact 与 full 验证通过。
- [x] 真 Electron 与真实 Chromium Web 边界隔离验证完成；独立 Chrome.app 因当前会话无安全浏览器控制运行时未连接，明确记为残余缺口。
- [x] 固定 App 本轮未更新，未连接或读取正式 userData。
- [x] 文档和功能登记按实际行为更新。

## 测试计划

- 影响映射模块：project、history、robustness、desktop。
- 主应用模块参数：project、history、robustness。
- 最小命令：`npm run test:module -- project`、`npm run test:module -- history`、`npm run test:module -- robustness`、`npm run test:desktop`、`npm run test:project-input`、`npm run test:i18n`。
- 升级到全量的条件：本任务涉及单体 HTML 生命周期、Electron 关闭/刷新和持久化边界，固定运行 `npm run test:impact -- --base a706161afd10daf3b090bf67c7b656599d344414 --module project` 与 `npm run test:full`。
- 人工检查尺寸/步骤：真 Chrome 使用临时 origin、临时 profile、临时端口（非 4175）验证编辑后不足 800ms reload/pagehide；真 Electron 使用 `app.setPath('userData', 临时目录)` 或等价隔离 profile 验证 reload、force reload、close-relaunch。证据只记录合成状态与计数，不记录项目字节、用户路径或正式 profile 信息。
- 固定 App 交付：不适用；临时工禁止更新 `~/Applications/PreVision.app`。

## 实施记录

- 假设：终止结算保持同步，避免依赖 renderer 即将销毁时无法完成的异步操作；Electron 仅在现有页面生命周期不足以覆盖菜单/窗口关闭时增加受限握手。
- 关键决定：renderer 生命周期已在真实 Electron reload、reloadIgnoringCache 与 close 中可靠触发，因此不新增 preload/IPC，避免扩张为主进程持久化服务。
- 实际修改：新增 `flushPendingAutosave()`，由正常 800ms timer、`pagehide` 和 `beforeunload` 共用；仅在 pending 时执行，先清 timer 再同步当前场景、GC、更新根字段并完整写入，失败沿用 lite 且不删除旧值。状态反馈迁移为双语 key，VM 与隔离 Chromium 回归覆盖幂等、异常和恢复。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci --cache /tmp/prevision-01.12-npm-cache`（Node 24.18.0） | 通过 | 57s | 独立 Worktree 安装锁定依赖；未修改共享 npm cache |
| `npm run app:status`（Node 24.18.0） | 通过 | <1s | installed `7ff9aa5`；current `a706161`；contains yes，exact no |
| `npm run task:status` | 通过 | <1s | 无 active claim |
| 回归先行 `npm run test:module -- project` | 预期失败 | 约 13s | 103/1；唯一失败为缺少同步末次结算入口 |
| `npm run test:module -- project` | 通过 | 约 14s | 108/0 |
| `npm run test:module -- history` | 通过 | 约 4s | 29/0 |
| `npm run test:module -- robustness` | 通过 | 约 30s | 57/0 |
| `npm run test:desktop` | 通过 | <1s | 47/0 |
| `npm run test:i18n` | 通过 | <1s | 21/0 |
| `npm run test:project-input` | 通过 | 约 7s | Web/Electron 隔离 reload、force reload、close-relaunch |
| `npm run test:impact -- --base a706161... --module project` | 通过 | 约 48s | app 931/0、foundation、project-input、web |
| `npm run test:full` | 通过 | 约 34s | app 931/0、project-input、web、desktop、本地安装、foundation 全通过 |
| `git diff --check` | 通过 | <1s | 无空白错误 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：本轮禁止连接、关闭或更新固定 App；仅使用隔离 Chrome/Electron 环境。

## 未覆盖与后续

- 正式 userData 的任何处置不属于本任务；固定 App 正在使用时保持完全隔离。
- 独立 Chrome.app 临时 profile 人工轮未运行；真实 Chromium Web 与 Electron 自动轮已覆盖相同生命周期，但不冒充 Chrome.app 人工证据。

## 交接

- 最终提交：归档并提交后在交接消息提供
- PR：无（仓库无 remote）
- 工作区状态：归档并提交后保持 clean
- 下一步：00 按 04.7 先、01.12 后机械集成；claim 保留至 00 集成成功。
