# 任务：自动导出内容身份与导航隔离

- 状态：completed
- 日期：2026-07-17
- 对话：01.14｜自动导出内容身份与导航隔离（后台施工）
- 分支：fix/01.14-automatic-export-content-identity
- 基线：c34598b844e6a7b70785fa20cad1d0db6affee95
- 固定 App 来源：7ff9aa583b4e51fb4d888aa1815792b747d275d7；当前分支包含该来源但并非精确来源
- 负责人：worker:01.14-automatic-export-content-identity

## 并行任务声明

- 任务 ID：01.14-automatic-export-content-identity
- 模式：write
- 分管 owner：01
- 模块：capture, project, layout, playback, timeline, camera, robustness
- UI 表面：app-shell, topbar, left-rail, viewport, canvas-controls, timeline, monitor, inspector, capture-controls
- 数据区域：project-v5, autosave, shot-camera
- 预计修改文件：`预见PreVision.html`、`测试/冒烟测试.mjs`、`docs/CURRENT_STATE.md`、`docs/KNOWN_ISSUES.md`、本验收单；review PASS 后的机械 closeout 还会使用同名 completed 验收单和 `docs/plans/completed/README.md`
- reservation：已预留（过期时间 2026-07-17T00:37:31.984Z；token 未写入仓库）
- reserve request key：已核对/已去敏
- 协调登记：schema v3 revision=e2e9017a-6d79-40e9-8808-83f33da4cee3；persistence=confirmed
- 权威生命周期：ACTIVE（本轮返工完成后待治理命令转入 REVIEW）
- 当前 actor / 下一责任人：worker:01.14-automatic-export-content-identity / worker:01.14-automatic-export-content-identity
- 状态更新时间 / 原因：旧 REVIEW 的 stop/review/人工证据已因两项 P1 与约定测试缺口作废；同一侧栏 Worktree、分支和 claim 已退回 ACTIVE 完成聚焦返工
- 侧栏去重证据：task id、client id、thread id 已在本机核对/已去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；未声称 Desktop live
- WAITING checkpoint：不适用
- turn stop verification：旧验证已作废；本轮聚焦提交后重新持久化 completed
- 失败补偿：无；保持同一 thread/reservation/claim
- `task:check` 结果：与 02.4-cjk-standalone-speaker-cues 仅有四文件软冲突；按派发冻结顺序 01.14 先、02.4 后通知 `00` 机械集成并保留双方语义
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：reviewer PASS 后以 sole-parent `--closeout-commit` 仅移动 active→completed 验收单并更新 completed/README；不得混入其他文件
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

自动导出开始后仍动态读取全局当前镜头；导出中切换场景/镜头或编辑内容，会让同一输出混入后来内容并破坏导航与预览状态。需要让当前镜头、当前场景与 Seedance 三种自动导出冻结起始身份，同时完整隔离会改变捕获内容的导航和编辑入口。

## 目标

- 三种自动导出在启动时冻结不可变的场景、镜头身份及编码所需内容句柄/快照。
- 自动导出期间同时从 UI、快捷键、菜单回调与程序函数入口阻止 New/Open、场景/镜头切换、删除和会改变捕获内容的编辑；仅保留既有停止/取消语义。
- 所有帧、视频、prompt 与 JSON 均归属起始目标；success/cancel/error/迟到回调后一次性、幂等恢复完整运行时状态。
- 导出事务不写 project/history/autosave，不清除、重排或覆盖导出前已存在的合法 dirty/pending autosave。
- 手动“录制整个工作区”的可交互语义保持不变。

## 非目标

- 不重排菜单，不做批量首尾帧，不扩展 Seedance manifest/prompt，不新增 project v5 字段。
- 不借机重构全部 capture，不改变手动工作区录屏的交互模型。
- 不运行 `app:update` 或 `app:deliver`，不更新固定 App。

## 证据与现状

- 代码：已在 baseline 复现自动编码循环动态读取 `curShot()`/`shotIdx` 的混镜路径，并以事务 target、逐帧冻结计划和首写门禁修复；未依赖历史行号。
- Git：工作树从精确 baseline c34598b 创建命名分支；固定 App 来源 7ff9aa5 是其祖先。
- 测试/运行：Node v24.18.0；`npm run app:status` 已显示 Contains installed source=yes、Exact=no；初次运行因新 Worktree 无依赖失败，`npm ci` 后通过。
- 文档/历史线索：已完整读取仓库治理入口，并按 AGENTS.md 检索双 Obsidian 库；工程化接力、并行工法、Seedance 素材包与场景一致性笔记共同强调冻结几何/语义锚点、命令化状态与单一任务范围。

## 影响范围

- 模块：capture, project, layout, playback, timeline, camera, robustness
- 文件：仅并行任务声明中的八个路径；review 前不移动验收单、不更新 completed 索引
- 数据格式：无；project v5 不新增字段
- 平台：浏览器与 macOS Electron；自动测试 API 桩不替代真 Chrome/Electron 媒体验证

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：High
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：由固定 01 另行组织；R2 Sol/High 不得降级，模型名不作为证据
- 数据：导出事务必须保持 project/history/autosave 零副作用并保留既有 pending autosave 顺序
- UI/交互：自动导出期间全入口隔离，收尾精确恢复；手动工作区录屏仍可交互
- 安全：不得扩大 Electron/文件写入边界，不调用真实付费 AI 服务
- 发布：本任务只形成开发分支和任务级证据；固定 App 不更新

## 验收条件

- [x] 当前镜头、当前场景、Seedance 分别冻结起始 scene/shot 身份，帧、视频、prompt、JSON 不混镜、不串场。
- [x] 自动导出期间 UI 与程序入口均阻止 next/prev、场景切换、新建/打开、删除及内容编辑；停止/取消保持既有语义。
- [x] success/cancel/error、MediaRecorder/编码/下载/保存失败、迟到回调与重复 stop/cancel 均只收尾一次，并恢复 sceneIdx、shotIdx、time、playing/playAllMode、selection、preview 和导出外观。
- [x] project/history/autosave 零写入、零丢编辑；既有 dirty/pending autosave 未清除、重排或覆盖。
- [x] 手动“录制整个工作区”仍保持可交互。
- [x] capture、project、layout、playback、timeline、camera、robustness 模块测试和 i18n/impact/full 通过。
- [x] 真 Chrome 与隔离 Electron 分别完成三种自动导出人工核验，去敏记录精确步骤且不提交媒体、用户项目或本机日志。
- [ ] 实现者之外的独立只读 reviewer 已完成，阻塞问题已关闭。
- [x] 用户可见任务未执行 `app:deliver`；由 `00` 集成、最终回归和用户正式授权后另行交付固定 App。
- [x] CURRENT_STATE 与 KNOWN_ISSUES 已同步，未虚构固定 App 更新。

## 测试计划

- 影响映射模块：capture, project, layout, playback, timeline, camera, robustness
- 主应用模块参数：逐一运行 capture / project / layout / playback / timeline / camera / robustness
- 最小命令：先补修复前会失败的执行级回归，再逐模块运行；`npm run test:i18n`
- 升级到全量的条件：本任务天然跨模块且涉及 capture/export/autosave，必须运行 `npm run test:impact -- --base c34598b844e6a7b70785fa20cad1d0db6affee95` 和 Node 20–24 `npm run test:full`
- 人工检查尺寸/步骤：真实 Chrome 与隔离 Electron，逐一启动当前镜头/本场景/Seedance；导出中从 UI 与程序入口尝试导航、New/Open、删除、编辑、停止/取消，并验证输出身份与完整状态恢复
- 固定 App 交付：不适用；本任务明确禁止 `app:update`/`app:deliver`

## 实施记录

- 假设：自动导出应是只读内容事务；交互隔离仅覆盖自动导出，不扩展到手动工作区录屏。
- 关键决定：以单一自动导出事务对象承载起始身份、状态快照、取消信号、入口门禁与 generation 绑定的幂等收尾；在冻结 target 前统一结算在途 authoring，逐帧时间只由冻结计划和 frame index 派生。
- 实际修改：三种自动导出冻结稳定 scene/shot 语义、分辨率、逐帧时间、内容 revision、prompt/JSON 和恢复快照；自动事务对 UI/快捷键/菜单及 camera、actor/path、timeline、background、preview 等程序 mutator 做首写门禁，同时用受控 sampling scope 保留路径动画。既有 history/autosave timer 不取消、不重排，导出前已启动的异步导入在 release 后 exactly-once 提交，导出中新增导入立即拒绝。纹理 preflight 等待 target 资源 ready/error，并与取消信号竞速；安装 stop 后立即刷新真实 disabled 状态，使悬挂 preflight 可由用户点击停止。MediaRecorder 请求停止与最终结算分离，无 `onstop` 时以 1500ms 单次失败兜底，迟到回调保持惰性。point-preview 在 target 构建与编码采样时异常安全地临时抑制并重采样恢复；success/cancel/error/迟到 generation/repeat stop 统一 exactly-once finalize。
- 执行级回归：覆盖三种导出的 UI/程序入口污染、真正跨 scene runtime、scene 首帧 C1@0 与全镜顺序、相邻 actor 世界位置与正常采样一致、冻结 camera aspect、逐条解析 Seedance ZIP 并核对视频/prompt/JSON/PNG 身份、250/800ms pending history/autosave、no-op history timer 生命周期、pointer drag/scrub settle、迟到 import、纹理 load error/永不 settle 时真实停止按钮取消、begin UI throw 的 preview runtime 回滚、五个补充 direct mutator、真实 `startWholePageRecording`，以及 MediaRecorder 无 `onstop` 的 1500ms 单次兜底与迟到回调。
- 中断/恢复：无；使用同一规范 thread/reservation。
- app-server 通知消费：后台 turn 已启动；需持续至 `turn/completed`，不得作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci`（Node v24.18.0） | 通过 | 4s | 新 Worktree 安装锁定依赖；未改 package lock |
| `npm run app:status` | 通过 | <1s | installed=7ff9aa5；current=c34598b；contains=yes；exact=no |
| `npm run task:status` | 通过 | <1s | claim ACTIVE/BACKGROUND_ONLY；与 02.4 仅四文件软冲突 |
| `npm run task:claim -- --reservation <redacted> ...` | 通过 | 5.6s | 原 reservation 已原子转换；schema v3 revision 已查询确认 |
| `npm run test:module -- capture` | 140 通过，0 失败 | — | 含自动导出身份、真实停止按钮、无 `onstop` 兜底、纹理与异步边界回归 |
| `npm run test:module -- project` | 112 通过，0 失败 | — | project/history/autosave 无副作用 |
| `npm run test:module -- layout` | 143 通过，0 失败 | — | UI 门禁与恢复 |
| `npm run test:module -- playback` | 32 通过，0 失败 | — | 受控 playback sampling |
| `npm run test:module -- timeline` | 124 通过，0 失败 | — | 时间计划与在途 scrub/drag 边界 |
| `npm run test:module -- camera` | 84 通过，0 失败 | — | 相机路径、FOV、aspect 与 preview |
| `npm run test:module -- robustness` | 57 通过，0 失败 | — | 快捷键、程序入口与重复收尾 |
| `npm run test:app` | 968 通过，0 失败 | — | 最新实现完整应用回归 |
| `npm run test:i18n` | 21 通过，0 失败 | <1s | 无新增/修改用户文案，直接中文守卫通过 |
| Node 24 `npm run test:project-input` 单独复跑 | 通过（exit 0） | — | Web/Electron、autosave、timeline 与 inspector 全路径通过；3 视口 × 4 模式 × 4 入口，共 48 个稳定样本；先前波动未复现 |
| Node 24 `npm run test:impact -- --base c34598b...` | 通过（exit 0） | — | app 968、foundation 151、coordination 553、i18n 21、project-input launcher 11、Web 10+14，均 0 失败；project-input 48 个样本通过 |
| Node 24 `npm run test:full` | 通过（exit 0） | — | app 968；project-input 全路径及 48 个样本；Web 10+14；desktop 47；local install 36；delivery gate 13；foundation 151、coordination 553、i18n 21、project-input wrapper 11，均 0 失败 |
| 真 macOS Chrome | 通过 | — | 当前镜、本场景、Seedance 与手动工作区录制均用真实 MediaRecorder 完成并恢复 UI；悬挂纹理 preflight 中真实顶部停止按钮为可用状态，点击后事务释放；同源一次性故障注入令 MediaRecorder 不触发 `onstop`，约 1.8 秒后明确失败且 Promise/事务/UI 释放；未保留媒体、项目或日志 |
| 隔离 Electron | 通过 | — | 当前镜、本场景、Seedance 与手动工作区录制均完成，手动录制中切换镜头仍有效；悬挂纹理 preflight 中真实点击顶部停止后明确取消并恢复 UI；DevTools renderer 等价注入 MediaRecorder 无 `onstop`，约 2.2 秒后明确失败且 UI/事务释放。一次性夹具、隔离 userData 与开发实例均已清理，未提交媒体、用户项目或本机日志 |

固定 App installed source：7ff9aa583b4e51fb4d888aa1815792b747d275d7

固定 App 人工启动结果：本任务不更新、不启动固定 App；待 `00` 正式交付阶段处理。

## 未覆盖与后续

- 本轮真 Chrome/Electron 为 macOS 单机短时验证；Safari、Windows 与长录制稳定性仍由 KI-007 跟踪。
- 当前固定 App 不包含本任务；review、部门验收、中央集成、最终回归与正式交付均由固定入口后续完成。

## 交接

- 最终提交：包含首个实现提交 `82fe0a7` 与本轮聚焦修复提交；完整有序集合由治理登记在提交后从 baseline..HEAD 冻结
- PR：无（仓库无 remote）
- reviewer 结论：未评审
- 生命周期交接：ACTIVE（保持 claim）
- 工作区状态：实现、任务级验证和 Chrome/Electron 重验完成；待聚焦提交与新 stop verification
- 下一步：形成聚焦提交，持久化本 turn completed，冻结 baseline..HEAD 完整有序提交链并进入 REVIEW；保持 claim，等待固定 01 组织 R2 独立只读复审。
