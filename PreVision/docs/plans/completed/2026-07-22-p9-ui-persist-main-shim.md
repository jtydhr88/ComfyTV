# 任务：P9｜UI、持久化与主入口模块化重构（后台施工）

- 状态：completed
- 日期：2026-07-22
- 对话：canonical thread 已核对（去敏）
- 分支：`chore/p9-ui-persist-main-shim`
- 基线：`acb4ba650fd00072bf276df100add388b3bcda57`
- 固定 App 来源：detached baseline 下 `app:status` 无法验证分支来源；固定 App 只读，本任务不交付
- 负责人：worker:04.p9-ui-persist-main-shim

## 并行任务声明

- 任务 ID：04.p9-ui-persist-main-shim
- 模式：write
- 分管 owner：04
- 模块：layout, timeline, project, history, desktop, repository, testing, i18n, camera, actor, lighting, background, playback, viewport, capture, storyboard, display, robustness
- UI 表面：app-shell, topbar, left-rail, viewport, canvas-controls, timeline, monitor, inspector, dialogs, capture-controls
- 数据区域：project-v5, autosave, shot-camera, object-paths, actor-rig, scene-template, ui-preferences, electron-ipc, qa-metadata, i18n-resources
- 预计修改文件：声明范围内的源模块、构建/回归测试、ADR、架构/测试文档与本验收单；不改 package、lock、golden、locale、Electron 语义或固定 App。
- reservation：已预留（token 已核对，不写入仓库）
- reserve request key：已核对/已去敏
- 协调登记：schema v3；ACTIVE claim 已核对
- 权威生命周期：REVIEW（本验收单首行 `active` 仅是文件状态；机械 closeout 才改为 `completed`。本次纯证据提交短暂 REVIEW→ACTIVE，提交与 stop 后将重新冻结 REVIEW）
- 当前 actor / 下一责任人：worker:04.p9-ui-persist-main-shim / reviewer:04.p9-ui-persist-main-shim-r3
- 状态更新时间 / 原因：2026-07-22；等待同一 reviewer 对 active-plan-only delta 机械复核。
- 侧栏去重证据：task id；client id / thread id 已在本机核对（去敏）
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=completed；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用
- WAITING checkpoint：历史 checkpoint 已完成，不是当前生命周期状态
- turn stop verification：已完成；本次 active-plan-only 提交后将再次 verify-stop 并重新冻结 REVIEW
- 失败补偿：无
- `task:check` 结果：无硬冲突
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：此前四提交顺序为 `6b17d572a66d536624a9306637b76f0b0faa8d02` → `39693d4a3c2e04a8b1410c67052c715c79ad0f4a` → `c0a9a4e413c1819f516895de41f480845820c385` → `f6719537cfbc57d319d6210d69d2c2fe5e7e009f`；本 active-plan-only 提交为第五笔重冻结。
- 机械 closeout：不适用
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

在不改变产品语义的前提下，完成 P9：将 `src/app.js` 的 UI、持久化和主入口职责迁为明确模块，并从新入口确定性构建单文件 `预见PreVision.html`。

## 目标

- 迁出 shell（A+M）、timeline（N）、inspector（O+U）、persistence（G 后半+Q）与 main（V）。
- 将初始化顺序和顶层命令路由明确放入 `src/main.js`。
- 在消费者可证明不存在时移除 `src/app.js` 及死 shim；保留安全兼容 bridge 并记录残余风险。
- 新增 P9 module-boundary guard，保持既有 P8 边界、构建形状、C1/C2、RefreshHub=22 和全部既有行为契约。

## 非目标

- 不新增产品功能、视觉/文案、依赖、版本号或 i18n analyzer 能力。
- 不修改 `package.json`、`package-lock.json`、`qa/golden/**`、locale、Electron 产品语义、固定 App 或正式 userData。
- 不执行 `app:deliver`、中央集成、release 或 closeout。

## 证据与现状

- 代码：以 `acb4ba650fd00072bf276df100add388b3bcda57` 和当前工作树为事实来源。
- Git：从该 detached baseline 创建任务分支；创建前工作区 clean。
- 测试/运行：Node 24.14.0；`npm ci` 已完成；`app:status` 在 detached baseline 下如实报告无法验证分支来源。
- 文档/历史线索：已阅读项目结构、测试策略及 Obsidian 的开发工作手册、架构地图、拆分方案、回归测试清单；不读取已取消 P9 工作树或旧提交作为实现来源。

## 影响范围

- 模块：本任务声明的全部模块。
- 文件：以开工单精确清单为准。
- 数据格式：无预期变更；必须保持 project-v5、autosave、历史与所有既有导入/导出兼容。
- 平台：macOS Electron 与离线单文件 Web 构建。

## 风险

- 风险档：R3
- 请求模型：其他（未提供）
- 实际模型：不可观察，未验证
- 请求 reasoning：High
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：范围升至数据/安全与跨模块主入口
- 独立只读 reviewer：待 04 安排唯一 R3
- 数据：持久化、历史、项目 v5 和自动保存必须零漂移。
- UI/交互：inline handler、RefreshHub 注册和初始化顺序可能存在隐式依赖。
- 安全：capture 需保持 Node 直接 import 安全，禁止环依赖。
- 发布：本任务不更新固定 App。

## 验收条件

- [ ] `src/app.js` 的既定 P9 职责迁至目标模块，初始化顺序和顶层命令路由可审计。
- [ ] 构建稳定，输出仍离线、恰有两个 bare script blocks、嵌入 Three，连续构建字节一致。
- [ ] C1/C2/C3/C4/C5/C6/C8、U1–U5、P8/P9 boundary、RefreshHub=22、census 和 golden 零修改均有如实证据；V1=SKIP，V2/V3=not run。
- [ ] 相关自动测试通过，失败如实记录且不以改弱断言消除。
- [ ] 人工检查初始化、布局、时间轴、检查器、保存恢复、播放/视口和截图/录屏关键入口。
- [ ] 本轮 delta 交由同一 R3 reviewer 机械复核；不得自行 closeout。
- [ ] 文档和功能登记按实际变更更新；固定 App 交付不适用。

## 测试计划

- 影响映射模块：全部声明模块；单体入口迁移为跨模块高风险。
- 最小命令：相关 module tests、`test:i18n`、`test:app`、`test:project-input`、`test:web`、`test:desktop`、`test:foundation`、`test:impact -- --base acb4ba650fd00072bf276df100add388b3bcda57`、`node 测试/回归/run_all.mjs`、`test:full`。
- 升级到全量的条件：已满足（主入口、持久化与跨模块行为变更）。
- 人工检查尺寸/步骤：按 TEST_STRATEGY 的 UI、文件对话框、媒体与播放/视口项记录；固定 App 不启动。
- 固定 App 交付：不适用；仅 00 在授权后可更新 `~/Applications/PreVision.app`。

## 实施记录

- 假设：纯搬运优先；仅有共同消费者证据时移除 shim。
- 关键决定：分阶段提交：契约/ADR → shell → timeline → inspector → persistence → main/构建/清理 → 测试和文档一致性。
- 实际修改：`6b17d57` 建立 ADR/契约；`39693d4` 删除 `src/app.js`，新增 main/shell/timeline/inspector/persistence source ownership、确定性组装器与 P9 boundary。
- 中断/恢复：无
- app-server 通知消费：后台 turn 已启动；不能作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci` | PASS | 8s | 恢复本 worktree 测试依赖；审计报告 23 个现有依赖漏洞，未修改 lockfile。 |
| `npm run app:status` | PASS（信息性） | <1s | detached baseline 无分支来源可验证；固定 App 未修改。 |
| `npm run task:status` | PASS | <1s | 已执行。 |
| `npm run build`（连续两次） | PASS | <1s/次 | 两次组装字节稳定，C8 通过。 |
| `P8/P9 boundary`、`test:i18n`、核心冒烟、census | PASS | <2s | P8=38、P9=14、i18n=217、core=19、census=501/501。 |
| `test:web` / `test:desktop` | PASS | <10s | Web=10+14；desktop=47。 |

固定 App installed source：detached baseline 下不可验证；未修改。

固定 App 人工启动结果：不适用。

## 未覆盖与后续

- claim 保留；未 closeout、未 HANDOFF/release；固定 App 未更新。

## 交接

- 最终提交：本 active-plan-only 第五笔待创建
- PR：无
- reviewer 结论：round-1 完整 R3 产品/数据/依赖环 PASS；第一次 delta 复核除 plan 生命周期矛盾外其余 PASS；本提交后只待同一 reviewer 对 plan delta 的机械 PASS。
- 生命周期交接：REVIEW（claim 保留；未 closeout/HANDOFF/release）
- 工作区状态：本提交前仅 active plan 有修改；提交后必须 clean。
- 下一步：同一 reviewer 机械复核此 plan delta；固定 App 未更新。
