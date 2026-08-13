# 任务：02.7｜镜头时长、区间条与关键帧边界

- 状态：completed
- 日期：2026-07-27
- 对话：02.7｜镜头时长、区间条与关键帧边界
- 分支：feat/02.7-shot-duration-boundaries-segments
- 基线：777c902febbd18ab3d0582e26ebf9d2e977f66d8
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`（`chore/integrate-04.9-before-product`）；当前任务基线包含该来源但不精确相等，固定 App 未修改
- 负责人：worker:02.7-shot-duration-boundaries-segments

## 并行任务声明

- 任务 ID：02.7-shot-duration-boundaries-segments
- 模式：write
- 分管 owner：02
- 模块：camera,timeline,playback,actor,project,history,layout,testing,i18n
- UI 表面：app-shell,timeline,inspector
- 数据区域：project-v5,shot-camera,object-paths,autosave,qa-metadata,i18n-resources
- 预计修改文件：
  - `app-shell.html`
  - `src/main.js`
  - `src/ui/inspector.js`
  - `src/ui/timeline.js`
  - `src/core/project-data.js`
  - `src/playback/engine.js`
  - `src/stage/runtime.js`
  - `src/persist/persistence.js`
  - `i18n/locales/zh-CN.js`
  - `i18n/locales/en-US.js`
  - `测试/冒烟测试.mjs`
  - `测试/回归/U4_normalize_malformed.mjs`
  - `qa/feature-registry.yaml`
  - `docs/CURRENT_STATE.md`
  - `docs/FEATURE_REGISTRY.md`
  - `docs/plans/active/2026-07-27-shot-duration-boundaries-segments.md`
  - `docs/plans/completed/2026-07-27-shot-duration-boundaries-segments.md`
  - `docs/plans/completed/README.md`
  - `docs/qa/shot-duration-boundaries/README.md`
  - `docs/qa/shot-duration-boundaries/electron-1440x900.png`
  - `预见PreVision.html`
- reservation：已预留（reservation id 已核对；明文 token 未写入）
- reserve request key：已核对/已去敏
- 协调登记：schema v3；本轮文档首写前只读核对 revision=`25b44663-4073-43c5-bca9-74c25eb02b96`、persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:02.7-shot-duration-boundaries-segments / worker:02.7-shot-duration-boundaries-segments
- 状态更新时间 / 原因：2026-07-27T07:21:50Z；同一后台侧栏任务已收到正式开工 turn，reservation 已原子转换为 active claim
- 侧栏去重证据：task id 已核对；client id / thread id 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；本任务明确不得宣称 DESKTOP_LIVE
- WAITING checkpoint：不适用
- turn stop verification：本轮 R3 证据提交后按治理流程重新持久化；此前返工已作废旧 stop evidence
- 失败补偿：无
- `task:check` 结果：未单独运行；原子 reservation 已 confirmed
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：待本轮 R3 证据提交后冻结精确有序四项；机械 closeout 独立记录
- 机械 closeout：三路 R3 已 PASS；本轮冻结 REVIEW 后按治理流程单独提交
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

在不升级 project schema、不改变既有关键帧绝对秒数且不产生拒绝副作用的前提下，增加 0.1 秒精度的镜头时长编辑、关键帧边界保护，以及由相邻关键帧派生且不抢命中的剪辑软件式区间条；本轮只交付隔离的快速开发预览。

## 目标

- 修改镜头时长时保持 camera 的 shot-local 绝对秒与 actor/prop 的 scene-global 绝对秒，不按比例移动、重排或删除任何 legacy/参数 sidecar 关键帧。
- 缩短会截断当前镜头相关 camera/actor/prop 键、会让任一 scene-global 键越过新 `sceneDur`，或会破坏前置镜头联动绝对秒时，在首写前原子拒绝并显示双语原因。
- 对可安全提交的拖动/输入只形成一次 history 与一次 autosave 调度；Escape/取消与所有拒绝路径对项目、runtime、preview sidecar、history、dirty/autosave、localStorage、modified 保持零副作用。
- 时长控件支持实时临时值、pointerup/Enter/blur 单次提交、0.1s 步进/精度和既有 0.5s 安全最小值；有限历史 `>20s` 时长加载不被 range 静默改写。
- 时间轴在相邻关键帧之间显示严格由 times/ease 派生的 segment bar，bar 不获取键盘焦点、不截获 key 的点击命中。
- 保持 project v1–v5、camera times/ease、actor/prop pathTimes/ease 与 AutoKey sidecar 既有边界。

## 非目标

- 不新增或升级 project 字段/schema。
- 不把 AutoKey 参数 sidecar 扩展成持久化系统。
- 不隐式解绑、迁移、删除、重排或按比例拉伸联动路径。
- 不修改固定 App、GitHub、Pages、发布指针，不执行 `app:deliver`，不运行 full。
- 不处理声明范围之外的旁支重构或影响映射维护。

## 证据与现状

- 代码：P9 后源文件分布在 `src/main.js`、`src/ui/`、`src/persist/`、core/stage/playback；`预见PreVision.html` 是构建产物，不直接手改。
- Git：pre-claim 核对 cwd 正确、HEAD 精确为 `777c902febbd18ab3d0582e26ebf9d2e977f66d8`、工作树干净，随后从该提交创建任务分支。
- 测试/运行：兼容运行时已定位为 Node v24.14.0；首次 `app:status` 未成功，原因是脚本子进程从 PATH 使用 Node v26.3.0 且本 Worktree 尚无 `node_modules`，未形成 tracked diff。
- 文档/历史线索：架构文档把 timeline、project/history/autosave 与 stage 往返列为高耦合枢纽；本任务按 R3 数据与交互事务处理。

## 影响范围

- 模块：camera,timeline,playback,actor,project,history,layout,testing,i18n
- 文件：仅限“预计修改文件”清单；发现真实写入文件不在清单中时，首写前停止并回报固定02
- 数据格式：无 schema 变化；需保持 project v1–v5 与 camera/actor/prop 时间和 ease 往返兼容
- 平台：浏览器运行时与 macOS Electron 快速开发预览；不更新固定 App

## 风险

- 风险档：R3
- 请求模型：未指定
- 实际模型：不可观察，未验证
- 请求 reasoning：未指定
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭（无可观察启用证据）
- Ultra：关闭
- Max/升级原因：范围升至数据/安全（首写前拒绝与零副作用事务）
- 独立只读 reviewer：待固定02派发；R3 不得降级
- 数据：镜头局部时间、场景全局时间、派生联动和 v1–v5 往返必须同时守恒。
- UI/交互：拖动/文本输入有 preview/commit/cancel 三态，需避免重复提交、range 隐式钳制和 segment 抢命中。
- 安全：拒绝路径必须证明 project、runtime、sidecar、history、autosave、localStorage 与 modified 零副作用。
- 发布：本轮仅 NOT INTEGRATED 预览；不得触碰固定 App 或发布状态。

## 验收条件

- [x] camera 关键帧保持 shot-local 绝对秒，actor/prop 关键帧保持 scene-global 绝对秒；拖长/拖短不按比例重排、移动或删除。
- [x] 缩短截断、scene-global 越界和前置镜头联动不安全情形在首写前原子拒绝并给出双语提示，拒绝路径全状态零副作用。
- [x] `pointSync`/`arcLength` 只有在安全物化 arrival times 并同事务转为 custom 时成功；否则拒绝且不拉伸。
- [x] 时长控件 0.1s 精度、最小 0.5s、实时临时数值、单次提交与 Escape 零写正确；历史有限 `>20s` 加载不被静默改写。
- [x] 相邻关键帧区间条由 times/ease 派生，不持久化、不聚焦、不抢 key 点击命中。
- [x] project v1–v5 与 camera/actor/prop times/ease 保存重开不漂移，AutoKey sidecar 边界不扩张。
- [x] 回归覆盖 camera/actor/prop、拖长/拖短、0.1s 输入、Undo/reopen、拒绝零副作用、旧项目、联动拒绝、区间条派生和 key 点击命中。
- [x] camera/timeline/actor/project/history/playback 定向测试、`npm run test:i18n`、build 与 `git diff --check` 通过；不运行 full。
- [x] 首版任务级控件/segment 有既有 Retina content capture；`6b84bc5` 新 draft 刷新缺少 owner 截图，按 00 裁决作为非阻断 P3 待 Leo 稳定预览实测。
- [x] 三路全新、实现者之外的独立 R3 只读 reviewer 均 PASS，P0=0、P1=0、P2=0。
- [x] 文档和功能登记已更新。
- [x] 本轮不执行 `app:deliver`；固定 App 验收明确不适用。

## 测试计划

- 影响映射模块：camera,timeline,playback,actor,project,history,layout,testing,i18n
- 主应用模块参数：camera / timeline / actor / project / history / playback
- 最小命令：上述模块定向测试、`npm run test:i18n`、项目 build、`git diff --check`
- 升级到全量的条件：本任务明确禁止运行 full；`test:impact` 仅在固定02明确要求时运行，若升级到 full 则立即停止并记录
- 人工检查尺寸/步骤：必要时隔离 Electron 1440×900，标题 `PreVision 02.7 Preview — NOT INTEGRATED`；检查时长拖动/输入/取消、拒绝提示、区间条与 key 命中
- 固定 App 交付：不适用；快速开发预览不得更新 `~/Applications/PreVision.app`

## 实施记录

- 假设：当前 reservation scope 与冻结产品合同为完整权威边界。
- 关键决定：采用首写前纯验证 + 单次提交事务；segment 只做派生视图；不增加持久字段。
- 实际修改：
  - 增加纯 `planShotDurationChange` / `applyShotDurationChange` 边界：分域检查 camera shot-local、actor/prop scene-global、sidecar、sceneDur 与 linkage；拒绝阶段不写任何业务状态。
  - `pointSync` / `arcLength` 成功路径先物化当前到达秒数，首尾精确钉死为 `0` 与旧 duration，再在同一事务转为 custom；无法安全物化则拒绝。
  - 时长 UI 改为 range + 可点击数值框，0.1s / 0.5s，preview/commit/cancel 分离，pointer capture、Enter/blur 去重、Escape 取消；旧有限 `>20s` 动态展开 range 上限。
  - 停用旧的比例 sidecar retime 入口；相邻 times/ease 派生 `.motion-segment`，不聚焦且 `pointer-events:none`。
  - 增加应用层、纯计划层、v1–v5 往返、零副作用、一次 history/autosave、Undo/reopen 与真实 Electron 断言。
  - 更新双语文案、功能登记、当前状态和 `docs/qa/shot-duration-boundaries/` 证据。
  - R3 返修后，`pointSync` 只有在物化时刻与既有 actor scene-global `pathTimes` 逐项相等时成功，且成功时不重写 actor times；不相等时在首写前原子拒绝。
  - segment 在 legacy 与 preview/AutoKey 拖动期间根据当前相邻 times/ease 实时更新，仍不持久化、不聚焦且不取得 pointer hit。
  - `6b84bc5` 让数值输入草稿在周期刷新后继续显示 `5.1`，slider 与 number 保持同一 draft；Enter 与随后的 blur 最多一次事务，Escape 与拒绝保持全状态零写。
- 中断/恢复：无
- app-server 通知消费：当前 turnOwner=background；由外部任务控制方负责持续读取到 `turn/completed`，不得作为 Desktop live 证据

## 独立 R3 与证据边界

- 三路全新、实现者之外的独立只读 R3 均 PASS：P0=0、P1=0、P2=0。
- Node 24 定向短门禁的最终真实结果为 Node v24.18.0、camera 106/0、timeline 169/0（父进程与 legacy isolate 子进程均 v24.18.0）、i18n 217/0；本轮文档收口不重跑测试。
- 现有 PNG 只由 `391687599f86568da0ef8e8c6be908e979828ecb` 引入：Git blob=`091c137d9cc4cfcdb83a16d76968076dc0dc5d10`，文件 SHA-256=`691d38a2e57ecf7b2a3ff09f40e1d39471d6f1268c27ddc6c5553a2377415f5e`，原始尺寸 2880×1736，是 Retina 2× content capture（约 1440×868 内容区）。`2c9664c` 与 `6b84bc5` 均未改变它。
- 该旧图只证明首版任务级时长控件和 segment UI 可见，不能证明 `6b84bc5` 的“周期刷新后仍显示 5.1 草稿”，也不能证明最新 owner BrowserWindow 的焦点/命中行为。
- 新 draft 行为由代码审查、定向自动回归和三路 R3 支持；缺少新 owner 截图按 00 快速预览裁决列为非阻断 P3，待 Leo 在稳定预览实测，不表述为新 UI 已人工验证。
- TIME-005 保持 `IMPLEMENTED_UNVERIFIED`；中央集成、最终回归、固定 App 与发布均未完成。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| cwd / HEAD / branch / clean | 通过 | <1s | 基线精确；从 detached HEAD 建立任务分支 |
| Node runtime | 通过 | <1s | 最终定向门禁显式使用 v24.18.0 |
| `npm run app:status`（pre-claim 首次） | 失败 | <1s | PATH 回落 Node 26 且缺 `@electron/asar`；ACTIVE 后用 `npm ci` 和 Node 24 重跑 |
| 64MiB 非落盘 wrapper `task:status` | 通过 | 约 60s | reservation、完整 scope、source、无冲突与 1/2 槽位已核对 |
| 64MiB 非落盘 wrapper `task:claim` | 通过 | 约 35s | lifecycle=ACTIVE；revision=f9a48342-ad26-4c6d-9a4b-1b1c735cc3f5；persistence=confirmed |
| `npm ci` | 通过 | 约 7s | 506 packages；依赖审计报告 33 个既有漏洞，本任务未改依赖 |
| Node 24 `npm run app:status` | 通过 | <1s | installed=`b8da5f4`；current contains installed=yes；exact=no；未修改固定 App |
| `npm run test:module -- camera` | 通过 | 约 25s | 106/106 |
| `npm run test:module -- timeline` | 通过 | 约 16s | 169/169；父进程与 legacy isolate 子进程均 v24.18.0 |
| `npm run test:module -- actor` | 通过 | 约 25s | 170/170 |
| `npm run test:module -- project` | 通过 | 约 25s | 113/113 |
| `npm run test:module -- history` | 通过 | 约 20s | 29/29 |
| `npm run test:module -- playback` | 通过 | 约 20s | 37/37 |
| `node 测试/回归/U4_normalize_malformed.mjs` | 通过 | <1s | 86/86；含 v1–v5、`>20s`、camera/actor/prop times/ease |
| `npm run test:i18n` | 通过 | <1s | 217/217 |
| `npm run build` | 通过 | <1s | `预见PreVision.html` 已重建 |
| `git diff --check` | 通过 | <1s | 无 whitespace error |
| 既有 Electron PNG | 有限证据 | 历史记录 | 由 `3916875` 引入的 2880×1736 Retina content capture，只支持首版控件/segment UI；不证明 `6b84bc5` 新 draft 刷新或最新 owner 焦点 |
| 新 owner UI 复核 | P3 待实测 | 不适用 | 没有完整的新 owner result/截图，不计人工 PASS；按 00 裁决待 Leo 在稳定预览实测 |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`。

固定 App 人工启动结果：不适用；本轮不得修改或正式交付固定 App。

## 未覆盖与后续

- `test:impact` 未运行：固定02未要求。
- `test:full` 未运行：任务明确禁止。
- 固定 App 人工验收不适用：本轮只提供任务级 NOT INTEGRATED 预览。
- 三路独立 R3 已全部 PASS；中央集成与最终回归仍待 00 完成。
- `6b84bc5` 新 draft 行为缺少新 owner 截图，作为非阻断 P3 待 Leo 在稳定预览实测。

## 交接

- 最终受审 task commits：待本轮 R3 证据提交后由协调器冻结；机械 closeout 单独记录
- PR：无
- reviewer 结论：三路独立 R3 均 PASS，P0=0、P1=0、P2=0
- 生命周期交接：本证据提交时仍为 ACTIVE；后续按同一治理事务进入 REVIEW、机械 closeout 与 HANDED_OFF，claim 保留
- 工作区状态：实现、定向验证和 R3 结论已形成；仅缺非阻断 P3 的稳定预览用户实测
- 下一步：冻结精确 task commits、机械 closeout 后交 00 集成；不 release/archive/app:deliver
