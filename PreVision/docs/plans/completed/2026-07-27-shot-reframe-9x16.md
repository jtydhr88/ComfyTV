# 任务：02.9｜9:16 当前镜头独立重构图

- 状态：completed
- 日期：2026-07-27
- 对话：02.9｜9:16 当前镜头独立重构图
- 分支：feat/02.9-shot-reframe-9x16
- 基线：2def382a9a4b4bddfadb2da9d455864103af0a64
- 固定 App 来源：首次且仅一次 `npm run app:status` 因 Worktree 尚未安装依赖而无法读取；按 02 节奏约束不重跑，固定 App 未更新
- 负责人：worker:02.9-shot-reframe-9x16

## 并行任务声明

- 任务 ID：02.9-shot-reframe-9x16
- 模式：write
- 分管 owner：02
- 模块：camera,capture,history,i18n,layout,playback,project,testing,viewport
- UI 表面：capture-controls,inspector,monitor,viewport
- 数据区域：autosave,i18n-resources,project-v5,qa-metadata,shot-camera
- 预计修改文件：app-shell.html；docs/CURRENT_STATE.md；docs/FEATURE_REGISTRY.md；docs/plans/active/2026-07-27-shot-reframe-9x16.md；docs/plans/completed/2026-07-27-shot-reframe-9x16.md；docs/plans/completed/README.md；docs/qa/shot-reframe-9x16/README.md；docs/qa/shot-reframe-9x16/electron-1440x900.png；docs/qa/shot-reframe-9x16/evidence.json；i18n/locales/en-US.js；i18n/locales/zh-CN.js；qa/feature-registry.yaml；src/core/project-data.js；src/core/reframe.js；src/export/capture.js；src/main.js；src/playback/engine.js；src/stage/environment.js；src/stage/runtime.js；src/ui/inspector.js；src/viewport/interact.js；测试/冒烟测试.mjs；测试/回归/C1_previz_roundtrip.mjs；测试/回归/P8_module_boundaries.mjs；测试/回归/U4_normalize_malformed.mjs；测试/回归/U6_reframe_math.mjs；测试/回归/run_all.mjs；预见PreVision.html
- reservation：已预留（reservation id 已核对；token 不落盘）
- reserve request key：已由固定 02 核对/去敏；persistence=confirmed
- 协调登记：schema v3 claim revision=5787a350-67f1-4a64-a2b0-0c4c81865fc1；persistence=confirmed
- 权威生命周期：ACTIVE（Leo 真实截图触发 P1 返修；上一轮 REVIEW/stop 证据已按协议作废，本轮保持 ACTIVE）
- 当前 actor / 下一责任人：worker:02.9-shot-reframe-9x16 / worker:02.9-shot-reframe-9x16
- 状态更新时间 / 原因：2026-07-27；真实截图证明首版右侧入口不可发现，已回到同一 ACTIVE claim 完成最小 UI 返修
- 侧栏去重证据：task/client/thread identity 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；未宣称 Desktop live
- WAITING checkpoint：不适用
- turn stop verification：上一轮证据随 REVIEW→ACTIVE 作废；本轮未执行，保持 running
- 失败补偿：无
- `task:check` 结果：固定 02 已原子 reserve，无新增冲突检查
- `task:claim --reservation`：已成功；ACTIVE/BACKGROUND_ONLY，revision `5787a350-67f1-4a64-a2b0-0c4c81865fc1`
- REVIEW commit list：上一轮仅含 `28ab94d` 的列表已作废；P1 返修后保持 ACTIVE，不重新冻结
- 机械 closeout：不适用
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

为当前镜头提供独立 9:16 竖屏重构图，在不改原摄影机关键帧语义的前提下，让监视器、Follow/编辑导演台、PNG、当前镜视频和本场景视频共享同一构图，并具备安全的草稿提交和导出恢复。

## 目标

- 在 project v5 的 shot 上持久化 `reframeByAspect['9:16']={offsetX,offsetY,zoom}`，旧 v1–v5 缺字段按 identity。
- 建立纯、共享、可独立测试的 reframe helper，所有预览与导出消费者使用同一 resolved 结果。
- 提供双语竖屏重构入口、状态、平移、缩放、重置与 Follow 一致构图。
- 保证草稿交互一次提交/取消零写，并在导出成功、取消和错误路径恢复渲染、摄影机、外观和播放状态。

## 非目标

- 不改原摄影机关键帧、路径、FOV 或 times 语义。
- 不做通用多画幅框架，不持久化 16:9 identity。
- 不调用付费 AI，不更新固定 App、稳定预览指针、GitHub 或 Pages。

## 证据与现状

- 代码：首版提交 `28ab94d` 已建立共享 reframe helper、预览/导出接入和草稿交互；P1 返修增加右侧同命令入口。
- Git：任务从指定基线 `2def382a9a4b4bddfadb2da9d455864103af0a64` 开始；首版提交为 `28ab94d`。
- 测试/运行：首次 `app:status` 因 `@electron/asar` 未安装失败；标准 `task:status` 命中已知 `spawnSync git ENOBUFS`。
- 文档/历史线索：已读项目入口、架构、功能登记、开发流程、ADR-0004、影响映射与 scope taxonomy。

## 影响范围

- 模块：camera,capture,history,i18n,layout,playback,project,testing,viewport
- 文件：仅限并行任务声明列出的 claimed files
- 数据格式：有；project v5 shot 新增可选 `reframeByAspect['9:16']`，版本号不变
- 平台：macOS Electron 与离线浏览器运行时；快速预览只验隔离 Electron

## 风险

- 风险档：R2
- 请求模型：不可观察，未验证
- 实际模型：不可观察，未验证
- 请求 reasoning：不可观察，未验证
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：不可观察，未验证
- Ultra：不可观察，未验证
- Max/升级原因：无
- 独立只读 reviewer：由固定 02 另行组织，不在本 worker 内部创建
- 数据：v1–v5 兼容、原 camera 数组/路径/FOV/times 字节不变、保存仍为 v5
- UI/交互：IME/modal/capture gate、草稿/提交/取消边界、Follow ON/OFF
- 安全：导出事务错误与取消必须恢复摄影机/renderer/exportLook/播放状态
- 发布：只做 NOT INTEGRATED 隔离预览，不交付固定 App

## 验收条件

- [x] canonical project v5 字段与 legacy identity 兼容通过真实 round-trip/malformed 测试，且原 camera 字节不变。
- [x] monitor、Follow/编辑导演台、PNG、当前镜视频和本场景视频共享同一 resolved reframe 结果。
- [x] 9:16 双语按钮、`aria-pressed`、badge/status、平移、wheel、`+/-` 与 reset 已实现并有执行级自动断言。
- [x] pointer/键盘交互满足 draft、最多一次 history/autosave、取消零写和切镜/切场景清草稿。
- [x] 导出成功、取消、故障注入均恢复摄影机、renderer、exportLook 与播放状态。
- [x] 相关自动测试通过。
- [ ] Electron 1440×900 人工验证与截图证据完成。
- [ ] 实现者之外的独立只读 R2 reviewer 已完成，阻塞问题已关闭。
- [ ] 固定 App 不适用：本轮仅快速开发预览，禁止 `app:deliver`。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：project,history,camera,playback,viewport,layout,capture,i18n
- 主应用模块参数：project/history/camera/playback/viewport/layout/capture
- 最小命令：对应 `test:module`；`test:i18n`；U6/C1/U4/P8；build；`git diff --check`
- 升级到全量的条件：本任务明确禁止 `test:impact` 与 `test:full`；超出冻结合同或 P8 边界无法保留时停止并报告
- 人工检查尺寸/步骤：Electron CSS 1440×900，9:16 按钮/状态、拖动/滚轮/键盘缩放、reset、Follow ON/OFF、monitor 与导出恢复
- 固定 App 交付：不适用；仅隔离标题 `PreVision 02.9 Preview — NOT INTEGRATED`

## 实施记录

- 假设：16:9 永远从 identity 解析，不产生持久字段。
- 关键决定：`src/core/reframe.js` 是唯一纯计算/渲染事务 helper；capture 通过运行时 bridge 使用它，保持生产 capture 模块无静态 import 的 P8 边界。16:9 只解析 identity，不产生持久字段。
- 实际修改：project normalize/load/save 接入可选 9:16 reframe；monitor、Follow/编辑导演台与 capture 共用 resolved projection；新增 inspector 控件、viewport draft 交互、双语资源、数学/兼容/边界/恢复断言与 QA 登记。
- P1 返修：Leo 截图证明 toolbar 入口在“属性与监视器”展开布局中不可发现。右侧 monitor 与播放控制之间新增全宽入口，和 toolbar 共用唯一 toggle router/`reframeEditMode`；9:16 显示、16:9 隐藏，`aria-pressed` 同步，点击进入后聚焦主画布，CSS 有界防止横向溢出。
- 中断/恢复：无
- app-server 通知消费：当前后台 turn 运行中；不得作为 Desktop live 证据

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status` | 失败 | <1s | Worktree 当时未安装 `@electron/asar`；按固定 02 节奏约束不重跑 |
| `npm run task:status` | 失败 | 约 30s | 已知 `spawnSync git ENOBUFS`；协调器 hash 已核对 |
| `node 测试/回归/U6_reframe_math.mjs` | 17/17 通过 | <1s | 独立 contain/offset/zoom/viewOffset 与恢复 oracle |
| `node 测试/回归/C1_previz_roundtrip.mjs` | 52/52 通过 | <1s | project v5 往返与原 camera 字节不变 |
| `node 测试/回归/U4_normalize_malformed.mjs` | 114/114 通过 | <1s | legacy v1–v5 identity 与 malformed 拒绝 |
| `node 测试/回归/P8_module_boundaries.mjs` | 41/41 通过 | <1s | capture 静态 import 边界与真实共享接入 |
| `npm run test:module -- project` | 121/121 通过 | 定向 | project canonical/legacy 行为 |
| `npm run test:module -- history` | 29/29 通过 | 定向 | 单次提交、取消零写 |
| `npm run test:module -- camera` | 106/106 通过 | 定向 | shot camera/reframe 语义 |
| `npm run test:module -- playback` | 41/41 通过 | 定向 | monitor、Follow ON/OFF |
| `npm run test:module -- viewport` | P1 后 49/49 通过 | 定向 | Node 22；右侧一步进入、主画布 focus、双入口 pressed 同步及既有 draft/gate |
| `npm run test:module -- layout` | P1 后 160/160 通过 | 定向 | Node 22；展开右栏入口可见可点、结构位置及无横向溢出 |
| `npm run test:module -- capture` | 155/155 通过 | 定向 | PNG/视频冻结与 success/cancel/error 恢复 |
| `npm run test:i18n` | 217/217 通过 | 定向 | zh-CN/en-US 同步与直写守卫 |
| `npm run build` | 通过 | 定向 | Node 22；单文件 HTML `1274957` 字节 |
| `git diff --check` | 通过 | <1s | 无 whitespace 错误 |
| 隔离 Electron | P1 构建刷新后进程存活、来源/标题/右侧入口已核对 | 运行时 DOM 探针 | PID `68256`；fa14 URL；9:16、右栏 expanded、右侧按钮可见且 317px/335px、无横向溢出；标题 `PreVision 02.9 Preview — NOT INTEGRATED` |

固定 App installed source：未取得本轮可复核结果；首次 `app:status` 在依赖安装前失败，按节奏约束不重跑

固定 App 人工启动结果：不适用（禁止更新固定 App）

## 未覆盖与后续

- Leo 真实截图已用于发现并驱动 P1 入口返修；尚未生成仓库内 1440×900 PNG，也未执行拖动/滚轮/键盘/reset/Follow 的完整真实点击矩阵，明确作为 P3 人工证据缺口。
- 独立 R2、中央集成、发布级回归与固定 App 交付由固定 02 / 00 后续负责。

## 交接

- 提交：首版 `28ab94d2237dc54b2f99a3e5ae6e2d3fbd9a7f49`；P1 返修为本任务第二笔聚焦提交（当前 HEAD）
- PR：无
- reviewer 结论：未评审
- 生命周期交接：保持 ACTIVE；write claim 保留，不执行 stop verification/REVIEW
- 工作区状态：P1 代码、Node 22 定向测试、第二笔聚焦提交与 fa14 隔离预览刷新已完成
- 下一步：Leo 复看右侧入口；确认后再由固定 02 决定何时组织新 stop verification/REVIEW 与实现者之外独立 R2
