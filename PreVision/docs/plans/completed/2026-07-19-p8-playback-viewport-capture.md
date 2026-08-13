# 任务：P8｜播放、视口与导出模块化重构

- 状态：completed
- 日期：2026-07-19
- 对话：04.p8-playback-viewport-capture canonical worker（后台施工，canonical ids 已核对/已去敏）
- 分支：refactor/p8-playback-viewport-capture
- 基线：a7a4a5aec6b1dc10511b7289f022a253468a8976
- 固定 App 来源：installed 7ff9aa583b4e51fb4d888aa1815792b747d275d7；contains yes；exact no；本任务不执行 `app:deliver`
- 负责人：worker:04.p8-playback-viewport-capture

## 并行任务声明

- 任务 ID：04.p8-playback-viewport-capture
- 模式：write
- 分管 owner：04
- 模块：actor, background, camera, capture, display, history, lighting, playback, project, repository, testing, timeline, viewport
- UI 表面：canvas-controls, capture-controls, inspector, monitor, timeline, topbar, viewport
- 数据区域：actor-rig, object-paths, project-v5, qa-metadata, shot-camera
- 实际修改文件：docs/decisions/0015-playback-viewport-capture-modules.md; docs/decisions/README.md; docs/plans/active/2026-07-19-p8-playback-viewport-capture.md; src/app.js; src/export/capture.js; src/playback/engine.js; src/viewport/interact.js; 测试/冒烟测试.mjs; 测试/回归/C5_seedance_package.mjs; 测试/回归/C6_makezip_bytes.mjs; 测试/回归/P8_module_boundaries.mjs; 测试/回归/harness/vm-app.mjs; 测试/回归/run_all.mjs; 预见PreVision.html
- 未修改但在 claim scope 内：docs/plans/completed/2026-07-19-p8-playback-viewport-capture.md; docs/plans/completed/README.md; src/core/project-data.js; src/export/prompt.js; src/stage/factory.js; src/stage/runtime.js
- reservation：已预留（token 不落盘、不提交、不回显）
- reserve request key：已核对/已去敏
- 协调登记：schema v3；claim 已转换为 ACTIVE/BACKGROUND_ONLY
- 生命周期：独立 R3 BLOCK 后已转回 ACTIVE/BACKGROUND_ONLY；完成同线程最小返修后等待 04 执行二审 verify-stop/REVIEW；本任务不 release/archive
- 外部证据：rollout/thread DB/sidebar present、name=set 已核对/已去敏；turn-owner background；execution visibility BACKGROUND_ONLY
- Desktop live 证据：不适用，后台施工不得宣称 Desktop live
- WAITING checkpoint：已由 04 完成；当前 turn 为正式开工
- task:claim：成功

## 用户问题

按正式开工单执行 P8 模块化重构：从精确 baseline 开工，严格按 K playback → I/L viewport → R/T capture 串行搬迁，保持行为、契约、Golden、固定 App 和依赖不变。

## 目标

- K playback 搬迁到 `src/playback/engine.js`，保持 live mutable state、rAF/录制时钟、双视口渲染和点位预览语义不变。
- I/L viewport 搬迁到 `src/viewport/interact.js`，具名化三个 canvas pointer handler，并保持命中优先级、拖拽、历史结算、捕获隔离和 viz refresh owner 不变。
- R/T capture 搬迁到 `src/export/capture.js`，保持 capture transaction、截图/录屏/导出/Seedance 包、ZIP 字节和 Node direct import safety。
- 新增 ADR-0015 与 P8 边界/ZIP/Seedance 测试，接入重构安全网。

## 非目标

- 不做 P9 UI/persist 收尾，不拆除 globalThis 过渡 shim，不做通用 bridge 重构。
- 不改 UI、用户文案、i18n 资源、project v5/schema、默认值、键序、精度、Golden、捕获文件名/ZIP 字节、视频节奏、渲染观感、Electron bridge、依赖版本。
- 不访问、复制或复用已取消窗口定位 Worktree 的未提交内容。
- 不执行 `app:deliver`，不移动验收单到 completed，不修改 completed README，不 release/archive/中央合并/推远端。

## 证据与现状

- 代码：P8 K/I/L/R/T 搬迁已完成；`src/app.js` 保留 P9 shell/inspector 留守项和兼容 wrapper。
- Git：开工 baseline 为 a7a4a5aec6b1dc10511b7289f022a253468a8976，开工前工作区 clean。
- 依赖：`npm ci` 已通过；`package.json`、`package-lock.json` 无 diff。
- 固定 App：installed source 为 7ff9aa583b4e51fb4d888aa1815792b747d275d7；contains yes；exact no；未执行 `app:deliver`。
- 文档/历史线索：已读取项目入口文档、QA 映射与 Obsidian 预见四件套 P8 相关章节。

## 影响范围

- 模块：playback, viewport, capture 为主；camera, actor, display, background, lighting, history, project, timeline, testing, repository 为验证/边界影响。
- 文件：实际写入均在 claim scope 内。
- 数据格式：无变更；C1/C2/C3/C5/C6 作为契约护栏。
- 平台：本地 Node 24、Electron/Web 构建产物；固定 App 不更新。

## 风险

- 风险档：R3
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：XHigh
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：待 04 安排 R3 reviewer
- 数据：未改变 project v5、localStorage、Golden、ZIP/Seedance 文件结构。
- UI/交互：保留 viewport 命中、拖拽、播放/预览、捕获按钮行为。
- 安全：未扩大 Electron bridge；未引入真实网络/付费 AI 调用。
- 发布：不交付固定 App；只交接任务提交与证据。

## 验收条件

- [x] 按 K → I/L → R/T 严格串行完成搬迁，未提前做 P9。
- [x] `src/export/capture.js` 可在纯 Node 下 direct import `makeZip`。
- [x] RefreshHub 注册总数仍为 22，viz 注册唯一且随 viewport owner。
- [x] `makeZip` 字节输出与既有 binary golden 完全一致，`qa/golden/**` 无 diff。
- [x] C5/C6/P8 boundary 接入 `测试/回归/run_all.mjs` 并通过。
- [x] 相关自动测试通过，失败/未覆盖项如实记录。
- [x] V1 维持既有 SKIP；V3 像素门禁未启用，记录为 NOT ENABLED/SKIP。
- [x] 固定 App 不执行 `app:deliver`，并记录 installed/current/contains/exact。
- [x] 新增 ADR-0015 与索引。
- [ ] 实现者之外的独立只读 reviewer 由 04 后续安排；本 turn 不自行 REVIEW/release/archive。

## 实施记录

- K playback：新增 `src/playback/engine.js`，迁入 `updateShotCam`、`updateActors`、`resize`、`renderDirectorViewport`、`loop`、点位预览和 live state/accessor；`loop` 使用 clock verbs 推进/暂停/定位，rAF 在录制时不推进。
- I/L viewport：新增 `src/viewport/interact.js`，迁入 fit/focus、camera viz、pick/highlight/drag/select 和 canvas pointer 绑定；三个 canvas handler 为真实具名函数；viz refresh 注册随 viewport owner。
- R/T capture：新增 `src/export/capture.js`，迁入 capture transaction、截图/录屏/导出、Seedance 绑定、`dataURLtoU8`、`makeZip`；模块无静态 import，DOM/renderer/MediaRecorder 运行期 lazy guard。
- 兼容边界：`src/app.js` 保留必要 wrapper 和 P9 留守项；新增 owner 模块使用明确调用期 bridge，避免 engine/capture 静态循环与 Node direct-import 副作用。
- 文档：新增 ADR-0015，并更新 ADR 索引。
- 测试：新增 C5 Seedance 包检查与 P8 module boundaries；C6 改为直接 import `makeZip`；run_all 接入 C5/C6/P8；VM harness 仅补 C5 必需观测。
- R3 BLOCK 返修：`src/viewport/interact.js` 姿态空值占位符从 `-` 恢复为 baseline 的 `–`；C5 expected 改为点击前独立 prompt/stageToData/metadata 快照，不再用 `captureTransaction.target` 作为 oracle；P8 boundary 的 clock guard 改为 Acorn AST 检查所有裸 Identifier assignment/update，pointer handler guard 改为 Acorn AST 证明真实 `FunctionDeclaration` 且导出。

## 验证结果

| 命令/步骤 | 结果 | 备注 |
| --- | --- | --- |
| `git rev-parse HEAD` | 通过 | 开工 baseline 精确匹配 a7a4a5aec6b1dc10511b7289f022a253468a8976 |
| `git status --short --branch` | 通过 | 开工前 clean |
| `npm run task:status` | 通过 | 本任务从 WAITING 转为 ACTIVE/BACKGROUND_ONLY |
| `npm ci` | 通过 | package/lock 无 diff |
| `npm run app:status` | 通过 | installed 7ff9aa583b4e51fb4d888aa1815792b747d275d7；contains yes；exact no |
| `npm run build` | 通过 | 第一次 SHA-256 3b52b06915cafb6f674c67237d3dcbef573e03f30da19c9d0954eace11da6c4b |
| `npm run build` | 通过 | 第二次 SHA-256 3b52b06915cafb6f674c67237d3dcbef573e03f30da19c9d0954eace11da6c4b |
| `node 测试/回归/run_all.mjs` | 通过 | C1/C2/C3/C4/C5/C6/P8/U4/U1/U2/U3/U5/C8 PASS；V1 SKIP |
| `npm run test:module -- playback` | 通过 | 32 passed, 0 failed |
| `npm run test:module -- viewport` | 通过 | 31 passed, 0 failed |
| `npm run test:module -- capture` | 通过 | 140 passed, 0 failed |
| `npm run test:module -- camera` | 通过 | 84 passed, 0 failed |
| `npm run test:module -- actor` | 通过 | 147 passed, 0 failed |
| `npm run test:module -- display` | 通过 | 25 passed, 0 failed |
| `npm run test:module -- background` | 通过 | 81 passed, 0 failed |
| `npm run test:module -- lighting` | 通过 | 32 passed, 0 failed |
| `npm run test:module -- history` | 通过 | 29 passed, 0 failed |
| `npm run test:module -- project` | 通过 | 112 passed, 0 failed |
| `npm run test:module -- timeline` | 通过 | 124 passed, 0 failed |
| `npm run test:app` | 通过 | 968 passed, 0 failed |
| `npm run test:i18n` | 通过 | i18n 21 passed, 0 failed |
| `npm run test:foundation` | 通过 | foundation/coordination/i18n/project-input-wrapper 全部通过 |
| `npm run test:impact -- --base a7a4a5aec6b1dc10511b7289f022a253468a8976` | 通过 | 检测 14 个变更文件，升级并通过 `npm run test:full` |
| `npm run test:full` | 通过 | app/project-input/web/desktop/local-install/foundation 全部通过 |
| `node scripts/census-functions.mjs --ref a7a4a5aec6b1dc10511b7289f022a253468a8976` | 符合任务门槛但命令非零 | baseline 491 全部仍在；current 501；新增 10 个 ADR-0015 明列真实 handler/init/helper |
| R3 rework `npm run build` | 通过 | 第一次 SHA-256 f492863fba58c6d49236f69557b742fcf069cdf50c1fd6e7a7c1031654bbf32a |
| R3 rework `npm run build` | 通过 | 第二次 SHA-256 f492863fba58c6d49236f69557b742fcf069cdf50c1fd6e7a7c1031654bbf32a |
| R3 rework `node 测试/回归/C5_seedance_package.mjs` | 通过 | 41 passed, 0 failed；expected 来自点击前独立快照 |
| R3 rework `node 测试/回归/C6_makezip_bytes.mjs` | 通过 | 20 passed, 0 failed |
| R3 rework `node 测试/回归/P8_module_boundaries.mjs` | 通过 | 38 passed, 0 failed；clock/handler 使用 AST 守卫 |
| R3 rework `node 测试/回归/run_all.mjs` | 通过 | C1/C2/C3/C4/C5/C6/P8/U4/U1/U2/U3/U5/C8 PASS；V1 SKIP |
| R3 rework `npm run test:module -- playback` | 通过 | 32 passed, 0 failed |
| R3 rework `npm run test:module -- viewport` | 通过 | 31 passed, 0 failed |
| R3 rework `npm run test:module -- capture` | 通过 | 140 passed, 0 failed |
| R3 rework `npm run test:app` | 通过 | 968 passed, 0 failed |
| R3 rework `npm run test:i18n` | 通过 | i18n 21 passed, 0 failed |
| R3 rework `npm run test:full` | 通过 | app/project-input/web/desktop/local-install/foundation 全部通过 |
| R3 rework `node scripts/census-functions.mjs --ref a7a4a5aec6b1dc10511b7289f022a253468a8976` | 符合任务门槛但命令非零 | baseline 491 全部仍在；current 501；新增 10 个 ADR-0015 明列真实 handler/init/helper |

## 静态检查

- Node direct import：`src/export/capture.js` 可直接导入 `makeZip`、`initCaptureBindings`、`currentCaptureTransaction`，`REC_FPS` 为 30。
- RefreshHub：`refresh.register` 总数 22；唯一 viz 注册位于 `src/viewport/interact.js`。
- clock 边界：Acorn AST 检查覆盖裸 Identifier `time`/`playing` 的 AssignmentExpression 全操作符与 UpdateExpression；允许 `clock.time`/`clock.playing` 成员访问。
- Pointer handlers：Acorn AST 检查 `onCanvasPointerDown`、`onCanvasPointerMove`、`onCanvasPointerUp` 均为真实 `FunctionDeclaration` 且由 viewport export。
- Golden/依赖：`qa/golden/**`、`package.json`、`package-lock.json` 无 diff。
- Census：无 baseline 函数丢失；允许新增 `currentCaptureTransaction`, `ensureCaptureCanvases`, `exportWholeSceneVideo`, `initCaptureBindings`, `initPlaybackResizeBindings`, `initSeedancePack`, `onCanvasPointerDown`, `onCanvasPointerMove`, `onCanvasPointerUp`, `topRecordCamera`。

## 未覆盖与后续

- V1 真机 GPU 视觉基准为既有 SKIP。
- V3 像素门禁仓库尚无可执行门禁，状态为 NOT ENABLED/SKIP，不记录 PASS。
- 后台无法安全完成真实单镜头视频播放与 Seedance 五件套人工验收，留给 00 发布前验证。
- 独立 R3 reviewer、task:verify-stop、REVIEW、集成、release/archive 由 04/00 后续执行。

## 交接

- 最终提交：待提交
- PR：无
- reviewer 结论：独立 R3 已 BLOCK；本次为同线程最小返修，待 04 二审
- 生命周期交接：返修完成后等待 04 verify-stop/REVIEW
- 工作区状态：待提交
- reviewer 建议关注：global bridge wrapper 与 live accessor 语义；capture transaction 每个 await 后 owner 检查；Seedance ZIP 冻结目标一致性；viewport 命中/拖拽优先级；无 V3/人工视频验收覆盖。
