# 任务：03.15｜摄影机位置点选择删除与跟随

- 状态：completed
- 日期：2026-07-26
- 对话：03.15｜摄影机位置点选择删除与跟随
- 分支：fix/03.15-camera-position-delete-follow-camera
- 基线：526c94e89f619aaae462365fa20bb642d9ab3752
- 固定 App 来源：b8da5f4f36a40010541700171cb246f2ca9de17b（当前分支包含该来源，但不是精确来源）
- 负责人：worker:03.15-camera-position-delete-follow-camera

## 并行任务声明

- 任务 ID：03.15-camera-position-delete-follow-camera
- 模式：write
- 分管 owner：03
- 模块：camera, history, i18n, layout, playback, project, robustness, testing, timeline, viewport
- UI 表面：app-shell, canvas-controls, inspector, monitor, timeline, topbar, viewport
- 数据区域：autosave, i18n-resources, object-paths, project-v5, qa-metadata, shot-camera, ui-preferences
- 预计修改文件：`app-shell.html`、`docs/CURRENT_STATE.md`、`docs/FEATURE_REGISTRY.md`、本验收单、`docs/qa/camera-position-delete-follow-camera/`、`i18n/locales/`、`qa/feature-registry.yaml`、`src/core/project-data.js`、`src/main.js`、`src/playback/engine.js`、`src/stage/runtime.js`、`src/ui/inspector.js`、`src/ui/timeline.js`、`src/viewport/interact.js`、`测试/冒烟测试.mjs`、`测试/回归/U4_normalize_malformed.mjs`、`预见PreVision.html`
- reservation：已预留并转换（reservation id `ff934fcc-7fcb-45b1-9b71-09717fd2235f`；不记录 token）
- reserve request key：已核对/已去敏
- 协调登记：schema v3 revision=`d4fbf6dc-f90e-48d7-af94-79ae8cfbb1d8`；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:03.15-camera-position-delete-follow-camera / worker:03.15-camera-position-delete-follow-camera
- 状态更新时间 / 原因：2026-07-26T14:59:34.428Z；Canonical 03.15 implementation turn started.
- 侧栏去重证据：task id、client id / thread id 已在本机核对并登记（验收单去敏）
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；本任务明确登记为后台施工，不宣称 Desktop live
- WAITING checkpoint：不适用
- turn stop verification：未完成
- 失败补偿：无
- `task:check` 结果：由 reservation 已完成；claim 后复核
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：不适用；本轮不 closeout
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

在隔离快速预览中，实现当前场景/当前镜头 legacy Camera Position 点的选择、多选、原子删除与主视口跟随摄影机；保持拒绝零写入、成功单次 history/autosave，以及输入、IME、modal、capture 和 actor 删除边界。完成定向验证、独立只读复审和明确 NOT INTEGRATED 的 Electron 预览，不集成、不更新固定 App。

## 目标

- 仅当前场景/当前镜头 legacy Camera Position keys 可点击、聚焦、ARIA 可见并支持 Shift 多选，跨 scene/shot/domain 清空选择。
- 用单一路由处理 Delete/Backspace/Edit Delete；拒绝时消费并显示 i18n 反馈，未选择位置点时保留 actor 删除。
- 以纯 plan/apply API 原子更新摄影机位置点及所有对应时间/缓动数组，不 ripple，至少保留一点。
- Follow Camera 默认关闭，只影响主视口；监视器始终使用 `shotCam`，且切换不写 project/history/autosave。
- 生成隔离 Electron 快速预览和目标尺寸证据，标题明确 NOT INTEGRATED。

## 非目标

- 不删除 actor、Aim、FOV 或 sidecar key，不升级 schema。
- 不运行 `app:deliver`，不更新固定 App，不集成、closeout、handoff、push、PR、Pages 或公开发布。
- 不运行 `test:full`。

## 证据与现状

- 代码：P9 模块化后源文件为事实源，`预见PreVision.html` 由构建生成。
- Git：工作树从精确基线创建，开工前无改动。
- 测试/运行：首次 `app:status` 因工作树未安装 `@electron/asar` 失败；`npm ci` 后成功，installed source 为 `b8da5f4`。
- 文档/历史线索：知识库要求数据契约优先进入 `src/core/project-data.js`；播放时间写入使用 `clock` 动词；主视口与监视器摄像机所有权分离。

## 影响范围

- 模块：camera, history, i18n, layout, playback, project, robustness, testing, timeline, viewport
- 文件：仅限并行任务声明中的候选文件
- 数据格式：无 schema 变化；仅对当前镜头既有摄影机数组做原子同构删点
- 平台：macOS Electron 隔离预览；浏览器 VM 定向回归

## 风险

- 风险档：R2
- 请求模型：不可观察，未验证
- 实际模型：不可观察，未验证
- 请求 reasoning：不可观察，未验证
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：实现后创建独立只读复审任务
- 数据：并行数组错位、pointSync / cameraNodes 后态失配、删至零点
- UI/交互：删除快捷键穿透、跨镜头脏选择、主/监视器视角所有权混淆
- 安全：拒绝路径必须零 project/history/autosave 写入；保留 modal/capture/IME/编辑控件门禁
- 发布：仅 NOT INTEGRATED 隔离预览

## 验收条件

- [x] 产品契约中的选择、删除、拒绝、原子写入和跟随行为均有执行级断言。
- [x] 第一版隔离预览所需的相关自动测试通过。
- [x] 隔离 Electron 快速预览已完成聚焦真实 UI 验证并留证；请求 1440×900，当前显示器工作区实际为 1440×888，三尺寸完整矩阵留待定稿阶段。
- [ ] 实现者之外的独立只读 reviewer 已完成初审；CHANGES REQUIRED 项已修复并通过定向测试，用户确认后的最终 R2 复核待执行。
- [ ] `app:deliver` 不适用：本轮明确禁止固定 App 交付。
- [ ] 功能登记长文档按 00 快车道留待用户确认后更新；active 验收单已记录第一版事实。

## 测试计划

- 影响映射模块：camera, history, i18n, layout, playback, project, robustness, testing, timeline, viewport
- 主应用模块参数：camera / history / layout / playback / project / robustness / timeline / viewport
- 最小命令：纯 plan/apply 回归、timeline / capture / playback / robustness 定向 module tests、`npm run test:i18n`、构建和 `git diff --check`；不再运行会自动升级全量的 impact，不运行 `test:full`
- 升级到全量的条件：本轮禁止 `test:full`；若发现需全量门禁的根因则停止并向 03 报告
- 人工检查尺寸/步骤：1440×900 聚焦快速预览；位置点多选/删除、拒绝反馈、actor 回退、Follow Camera 主/监视器分流。三尺寸完整矩阵不在本轮执行。
- 固定 App 交付：不适用；仅隔离 Electron 快速预览

## 实施记录

- 假设：legacy Camera Position 选择只属于瞬时 UI，不进入项目、撤销或偏好。
- 关键决定：纯 plan/apply 先完成后态预检，再由 UI 层单次 history/autosave 提交。
- 实际修改：
  - `src/core/project-data.js` 新增纯 `planCameraPositionPointDeletion` / `applyCameraPositionPointDeletion`，一次替换 `camPts`、`camKeys`、三套绝对时间和三套 ease；预检最少一点、pointSync、cameraNodes、cameraFollow 派生，并以引用加内容指纹拒绝 stale plan。
  - `src/ui/timeline.js` 新增当前 scene/shot/domain 的结构化 Position 命令选择、Shift 多选、button + `aria-pressed`、单一删除路由、i18n 反馈和成功后的统一 UI 刷新；3px 拖动阈值保证点击/轻微抖动零持久化。
  - `src/main.js` 与 `src/ui/inspector.js` 统一 Delete / Backspace / Edit Delete / 点删除按钮路由，保留 input、textarea、contenteditable、IME、modal、capture 门禁和无 Position 选择时的 actor 回退。
  - `src/playback/engine.js`、`src/stage/runtime.js`、`src/viewport/interact.js` 在 scene/shot/domain 变化时清理命令选择；程序化点预览不再伪装成可删除选择。
  - 复用 `#camDrive` / `camDriveMode` 实现默认关闭的 Follow Camera；主视口开启时跟随 `shotCam`，监视器始终为 `shotCam`，切换不写 project/history/autosave。
  - 中英文资源、应用壳样式、U4/冒烟执行断言和生成入口已同步。
- 独立只读初审：结论 `CHANGES REQUIRED`，指出 4 个 P1（轻微抖动写盘/改 timingMode、actor Shift 多选被清、程序化预览伪选择导致 actor 误删认知风险、删除与旧 pending history 合并）及 2 个 P2（button ARIA、plan 数字字符串/stale 强度）。上述代码项已逐项修复并纳入定向断言；最终复核按 00 快车道留待用户确认后执行。
- 中断/恢复：一次 impact 自动升级到 `test:full` 后立即 Ctrl-C，exit 130；其间暴露 capture 门禁严格返回值真失败，已修复并以 capture 140/140 复核。未继续 impact/full。
- app-server 通知消费：当前对话由后台 owner 执行；不作为 Desktop live 证据

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status`（首次） | 失败 | <1s | 缺少 `@electron/asar` |
| `npm ci` | 通过 | 23s | Node 26 仅用于依赖安装/测试，不用于打包 |
| `npm run app:status`（重试） | 通过 | <1s | installed `b8da5f4`; contains=yes; exact=no |
| `npm run test:impact -- --base 526c94e89f619aaae462365fa20bb642d9ab3752` | 中断（exit 130） | 未完成 | 13 个变更文件中若干 P9 拆分源未被 impact map 识别，命令自动进入 `test:full`；依 00 快车道立即停止，不修改 `qa/test-impact-map.yaml` |
| impact 过程中 capture 断言 | 首次失败 | — | `#delPt` 在 capture 门禁返回对象而非历史严格 `false`；属于直接相关真失败，已修复 |
| `node 测试/回归/U4_normalize_malformed.mjs` | 通过 | <1s | 63 passed, 0 failed；含纯计划、八数组、绝对时间、ease、联动、拒绝零写入、原位 stale 与数字字符串 |
| `npm run test:module -- timeline` | 通过 | 16s | 140 passed, 0 failed |
| `npm run test:module -- capture` | 通过 | 14s | 140 passed, 0 failed；capture 修复后最终同源复跑 |
| `npm run test:module -- playback` | 通过 | 17s | 37 passed, 0 failed |
| `npm run test:module -- robustness` | 通过 | 60s | 57 passed, 0 failed |
| `npm run test:i18n` | 通过 | <1s | 217 passed, 0 failed |
| `npm run build` | 通过 | <1s | 生成 `预见PreVision.html`，1,229,177 bytes |
| `git diff --check` | 通过 | <1s | 无空白错误 |
| 隔离 Electron 预览 | 通过 | — | 独立 `userData`；标题 `PreVision 03.15 Preview — NOT INTEGRATED`；实现提交 `8f1eda7`；进程保持运行 |
| CoreGraphics / Computer Use 真实 UI | 通过 | — | 标题匹配、`onscreen=1`；Follow Camera 默认关闭；Position 点 AX 可聚焦/可切换，点击第一点后 `Value: 1` 且视觉选中/焦点反馈可见；证据见 `docs/qa/camera-position-delete-follow-camera/` |

固定 App installed source：b8da5f4f36a40010541700171cb246f2ca9de17b

固定 App 人工启动结果：不适用；本轮禁止更新或验收固定 App。

## 未覆盖与后续

- 中央集成、最终回归、固定 App 交付由后续 `00` 决策；本轮不执行。
- `qa/test-impact-map.yaml` 对本任务涉及的若干 P9 拆分源缺少精确映射，导致 impact 自动升级全量；依 00 明令，本任务只记录缺口，留给后续流程任务修复。
- `test:full`、三尺寸矩阵、功能登记长文档、最终 R2 和机械 closeout 均不属于第一版快速预览门禁。

## 交接

- 第一版实现提交：`8f1eda7eb1f5e71cbbb23074233cf2e5a1474a73`
- 最终提交：仍待用户确认后的 R2 / 收尾；本轮不 closeout
- PR：无
- reviewer 结论：初审 `CHANGES REQUIRED`；4 个 P1 / 2 个 P2 已实现修复并通过定向断言，最终 R2 待用户确认后执行
- 生命周期交接：保持 ACTIVE；本轮不进入 HANDOFF
- 工作区状态：第一版定向验证通过；NOT INTEGRATED 隔离 Electron 预览正在运行
- 下一步：等待用户体验反馈；确认后执行最终 R2、三尺寸矩阵和后续登记
