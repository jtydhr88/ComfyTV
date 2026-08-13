# 任务：02.10｜摄影机时间线统一（范围纠正）

- 状态：completed
- 日期：2026-07-28
- 对话：02.10｜摄影机时间线统一（范围纠正）
- 分支：fix/02.10-camera-timeline-scope-corrected
- 基线：6a1658b4a7e7c4668eb9bc7c968bccbb179d4952
- 固定 App 来源：b8da5f4f36a40010541700171cb246f2ca9de17b（当前基线包含该来源，但不是精确来源）
- 负责人：worker:02.10-camera-timeline-scope-corrected

## 并行任务声明

- 任务 ID：02.10-camera-timeline-scope-corrected
- 模式：write
- 分管 owner：02
- 模块：camera, capture, history, i18n, layout, playback, project, testing, timeline, viewport
- UI 表面：inspector, monitor, timeline, topbar, viewport
- 数据区域：autosave, i18n-resources, project-v5, qa-metadata, shot-camera
- 预计修改文件：`app-shell.html`、`docs/CURRENT_STATE.md`、`docs/FEATURE_REGISTRY.md`、本验收单、`docs/plans/completed/2026-07-27-camera-timeline-unification.md`、`docs/plans/completed/README.md`、`docs/qa/camera-timeline-unification/README.md`、`i18n/locales/en-US.js`、`i18n/locales/zh-CN.js`、`qa/feature-registry.yaml`、`src/core/project-data.js`、`src/export/capture.js`、`src/main.js`、`src/persist/persistence.js`、`src/playback/engine.js`、`src/stage/runtime.js`、`src/ui/inspector.js`、`src/ui/timeline.js`、`src/viewport/interact.js`、`测试/冒烟测试.mjs`、`测试/回归/P8_module_boundaries.mjs`、`测试/回归/U4_normalize_malformed.mjs`、`预见PreVision.html`
- reservation：已转换（reservation id `80a4f554-5f52-4d27-a4d4-160822d9700d`；不记录 token）
- reserve request key：已核对/已去敏
- 协调登记：schema v3 ACTIVE revision=`002542a4-5d04-451c-9926-eb20c87cc763`；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:02.10-camera-timeline-scope-corrected / worker:02.10-camera-timeline-scope-corrected
- 状态更新时间 / 原因：2026-07-28 17:05 CST；旧 03.17 confirmed-cancelled/archive 后，以 corrected scope 使用同一新 reservation 原子转换 ACTIVE
- 侧栏去重证据：task id、canonical client id / thread id 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；不宣称 Desktop live
- WAITING checkpoint：不适用；当前 canonical turn 已 started
- turn stop verification：未完成
- 失败补偿：无
- `task:check` 结果：reservation 已由固定 02 原子通过
- `task:claim --reservation`：成功；ACTIVE revision=`002542a4-5d04-451c-9926-eb20c87cc763`
- REVIEW commit list：未冻结
- 机械 closeout：不适用；快速预览轮保持 active
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

机械承接旧 03.17 已冻结的摄影机时间线合同与四提交。旧任务因 immutable claim 漏报三个真实实现文件被 `00` confirmed-cancelled/archive；本任务只纠正 scope，不新增 UI 或产品语义。

## 目标

- 默认时间线仅显示一行摄影机；0 秒基础机位可更新、不可删除。
- K/记录按钮把当前完整摄影机姿态写入现有摄影机轨，重复时间原位更新。
- 单击/Shift 同轨多选；Delete/Backspace/Edit Delete 走同一路由，拒绝后消费命令且不回退删除演员。
- 删除尾帧时暂停并回到上一有效帧；清除动画仅保留 0 秒基础机位。
- AutoKey 默认关闭；高级展开后才显示 X/Y/Z、朝向和 FOV。
- camera generic preview 不再构成第二套持久真值。
- 修改本镜头时长时，按 `newDuration / oldDuration` 等比例重定时当前镜头全部摄影机关键帧；0 秒保持 0，延长与缩短使用同一规则。
- 摄影机编辑默认使用本镜头局部时间 `0 → shot.dur`，显示明确的“镜头结束”边界；拖动、粘贴和记录均不得越界。
- actor/prop 继续使用场景全局时间，仅在明确的“场景全局时间”视图中编排，不参与本轮摄影机重定时。
- 旧 R2 P2：`src/export/capture.js`、`src/persist/persistence.js`、`src/viewport/interact.js` 曾漏报；本任务已纳入 immutable scope。

## 非目标

- 不扩修 actor/prop 时间线。
- 不升级 project v5 schema。
- 不新增第三套 camera truth；摄影机姿态仍只由现有 `camPts/camKeys/camTimes` 及同步数组表达。
- 不运行 `test:impact` / `test:full`，不更新固定 App、GitHub、Pages、稳定预览指针或运行 `app:deliver`。

## 证据与现状

- 代码：P9 模块化源文件为事实源；`camPts/camKeys/camTimes` 驱动真实摄影机播放，generic preview 另有独立 Map 存储。
- Git：从同一指定精确基线创建 corrected-scope 分支；四个旧提交按原顺序机械 cherry-pick，无冲突、未 squash/rewrite。
- 测试/运行：本任务首次 `app:status` 因依赖缺失失败；Node 24 执行 `npm ci` 后通过。下方既有实现/QA 事实来自旧 03.17，不冒充本任务新验证。
- 文档/历史线索：旧 03.17 已由 `00` confirmed-cancelled/archive；本任务只纠正 immutable scope。

## 影响范围

- 模块：camera, capture, history, i18n, layout, playback, project, testing, timeline, viewport
- 文件：仅限并行任务声明
- 数据格式：project v5 不升版；复用既有摄影机数组
- 平台：macOS Electron 隔离预览与 Node 定向测试

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：gpt-5.6-sol
- 请求 reasoning：XHigh
- 实际 selected reasoning：xhigh
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：R2 后置，由固定 02 组织
- 数据：并行摄影机数组必须保持索引、时间与姿态同构
- UI/交互：删除命令不得穿透或 fallback 到演员；基础帧必须清楚且不可删
- 安全：拒绝路径零 project/history/autosave 写入
- 发布：机械承接；固定 App、稳定预览、GitHub、Pages 均不动

## 验收条件

- [x] 冻结摄影机时间线合同有执行级断言。
- [x] 镜头时长延长/缩短均等比例缩放三组 shot-local camera times，姿态内容、索引、ease 与 cameraFollow 同步关系不变。
- [x] 损坏、非有限或三组时间/姿态结构失配在首写前拒绝且 project/history/autosave 零变化。
- [x] 改时长成功仅一次 history + autosave；既有 Undo 与保存重开保持等比例结果。
- [x] 摄影机局部时间轴显示 0 到本镜头结束边界，记录/拖动/粘贴不越界；场景全局视图保留 actor/prop 编排入口。
- [x] AutoKey 关闭且播放头不在所选摄影机帧时，viewport/inspector 调整只进入瞬时 draft，project/history/autosave 零写；记录后才新增当前时间的完整 pose。
- [x] 同时间记录原子覆盖完整 pose；AutoKey on 自动提交；取消、切镜、播放、capture gate 与 Undo 清理 draft 且不污染项目。
- [x] 统一摄影机关键帧拖动原子同步 `camTimes/camAimTimes/camFovTimes`，三组时间不再分叉。
- [x] 确定性链 near/low@0 → far/high@5 产生两个不同位置、三组 `[0,5]`、非零路径和有效 2.5s 插值，且仅一次 history/autosave。
- [x] 限定模块测试、i18n、build 与 diff-check 通过。
- [x] 隔离 Electron 预览标题与核心交互完成核对。
- [ ] 独立 R2 reviewer 后置。
- [x] `app:deliver` 不适用：本轮明确禁止固定 App 交付。
- [x] 快速预览必要记录已更新。

## 测试计划

- 影响映射模块：timeline, camera, history, project, playback, i18n
- 主应用模块参数：timeline / camera / history / project / playback
- 最小命令：仅 `test:module -- timeline`、`test:i18n`、build、`git diff --check`
- 升级到全量的条件：本轮禁止 impact/full；若发现必须升级则停止并报告固定 02/00
- 人工检查尺寸/步骤：本任务不重做隔离 Electron；旧 03.17 证据仅作为来源事实保留
- 固定 App 交付：不适用

## 实施记录

- 假设：基础帧使用既有当前镜头第一组摄影机数组项表达，不新增并行持久字段。
- 关键决定：相邻帧区间仅由时间派生渲染，不持久化。
- 实际修改：默认仅渲染统一摄影机行；0 秒基础机位加明确标记且禁止拖动/删除；K 与记录按钮把 `shotCam` 的位置、yaw、pitch、FOV 原子写入/更新 `camPts/camKeys/camTimes`；清除仅保留基础机位；相邻 segment 由数组实时派生；高级展开显示 X/Y/Z、朝向、FOV 派生明细；camera generic preview 从序列化、恢复、播放、记录与渲染入口退出。
- 删除路由：Delete、Backspace、Edit Delete 均由摄影机时间线路由消费；拒绝不会回退删除演员；删除尾帧暂停并定位上一有效帧。
- 兼容：project v5 不升版；旧 camera generic preview 数据打开时忽略且不再保存，actor/prop generic preview 保持既有路径。
- 2026-07-28 增量：在 `a8ce2a7` 上实现“本镜头时长默认等比例重定时摄影机关键帧”和“摄影机局部/场景全局时间视图”；三组 camera times 共享比例，0 秒不动，独立 actor/prop 不缩放，cameraFollow 派生时间保持同步。
- History 边界：仓库当前只有项目级 Undo，没有项目级 Redo；本轮快速预览沿用既有 Undo，不扩成通用 Redo 功能，后者记录为既有产品缺口。
- 2026-07-28 确定性记录返工：基于冻结 autosave 证据修复“非关键帧时间调整直接覆写已选持久点”和“统一 key 拖动只改 position time”两条根因；基线 `a23973fd4ba478753355415a8b48500fd59a2b0b`。
- Draft 边界：viewport 与 inspector 在非关键帧时间共同编辑内存态完整 pose；保留持久机位选择但不写摄影机数组，K/记录或 AutoKey change 才提交；播放、切镜、取消、capture 与 Undo 清理 draft。
- 时间原子性：统一摄影机 key 拖动以 position times 为源，同时替换 `camTimes/camAimTimes/camFovTimes`；确定性测试覆盖真实 viewport pointer 链，防止拖动事务标记误读后回写持久点。
- 中断/恢复：无
- app-server 通知消费：后台施工；不作为 Desktop live 证据

## 验证结果

以下既有实现与 QA 行为记录来自旧 03.17 四提交，均保留原事实；在本 corrected-scope 任务中不冒充重新执行。仅本表末尾明确标注“02.10 corrected-scope”的行属于本任务新验证。

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status`（首次） | 失败 | <1s | 缺少 `@electron/asar` |
| `npm ci`（Node 24.18.0） | 通过 | 11s | 安装 506 个依赖 |
| `npm run app:status`（Node 24.18.0） | 通过 | <1s | installed `b8da5f4`; contains=yes; exact=no |
| `npm run build`（Node 24.18.0） | 通过 | <1s | 生成 `预见PreVision.html` |
| `npm run test:module -- timeline` | 通过 | 41s | 176 passed / 0 failed |
| `npm run test:module -- camera` | 通过 | 约 56s | 106 passed / 0 failed |
| `npm run test:module -- history` | 通过 | 约 26s | 29 passed / 0 failed |
| `npm run test:module -- project` | 通过 | 约 60s | 121 passed / 0 failed |
| `npm run test:module -- playback` | 通过 | 约 26s | 41 passed / 0 failed |
| `npm run test:i18n` | 通过 | <1s | 217 passed / 0 failed |
| `git diff --check` | 通过 | <1s | 无空白错误 |
| 隔离 Electron 预览 | 通过 | — | 独立临时 profile；标题 `PreVision 03.17 Preview — NOT INTEGRATED`；当前工作树 HTML；进程保持运行 |
| 真实 UI/AX 核对 | 通过 | — | 默认 AutoKey 关闭、仅一行摄影机、0.0 秒基础机位明确不可删、记录/清除可见；高级展开显示 X/Y/Z、朝向、FOV，核对后恢复收起 |
| `npm run test:module -- timeline`（2026-07-28 增量） | 通过 | 约 39s | 176 passed / 0 failed；含 v1/v3/v5 比例重定时保存重开、非有限/失配拒绝与 cameraFollow 同步链 |
| `npm run test:module -- project`（2026-07-28 增量） | 通过 | 约 60s | 121 passed / 0 failed |
| `npm run test:module -- history`（2026-07-28 增量） | 通过 | 约 26s | 29 passed / 0 failed |
| `npm run test:module -- camera`（2026-07-28 增量） | 通过 | 约 56s | 106 passed / 0 failed |
| `npm run test:i18n`（2026-07-28 增量） | 通过 | <1s | 217 passed / 0 failed |
| `npm run build`（2026-07-28 增量） | 通过 | <1s | 生成 1,285,566 字节单文件应用 |
| `git diff --check`（2026-07-28 增量） | 通过 | <1s | 无 whitespace error |
| `npm run test:module -- timeline`（确定性记录返工） | 通过 | 约 40s | 182 passed / 0 failed；含 viewport/inspector draft、原子记录、清理边界与三组 times 拖动同步 |
| `npm run test:module -- camera`（确定性记录返工） | 通过 | 约 56s | 106 passed / 0 failed；机位/对象组合预览选择保持 |
| `npm run test:module -- playback`（确定性记录返工） | 通过 | 约 26s | 41 passed / 0 failed |
| `npm run test:module -- history`（确定性记录返工） | 通过 | 约 26s | 29 passed / 0 failed |
| `npm run test:module -- project`（确定性记录返工） | 通过 | 约 60s | 121 passed / 0 failed |
| `npm run test:i18n`（确定性记录返工） | 通过 | <1s | 217 passed / 0 failed |
| `npm run build`（确定性记录返工） | 通过 | <1s | 生成 1,291,715 字节单文件应用 |
| `git diff --check`（确定性记录返工） | 通过 | <1s | 无 whitespace error |
| `npm run app:status`（02.10 corrected-scope 首次） | 失败 | <1s | Node 24.18.0；本 Worktree 缺少 `@electron/asar` |
| `npm ci`（02.10 corrected-scope） | 通过 | 23s | Node 24.18.0；按 lockfile 安装 506 个依赖 |
| `npm run app:status`（02.10 corrected-scope 重试） | 通过 | <1s | installed `b8da5f4`；contains=yes；exact=no；未更新固定 App |
| 64MiB 非落盘 wrapper `task:claim` | 通过 | 约 35s | 同一 reservation；revision `002542a4-5d04-451c-9926-eb20c87cc763`；ACTIVE/BACKGROUND_ONLY |
| 依序机械 cherry-pick 旧 03.17 四提交 | 通过 | <1s | 四个提交均无冲突；未 squash/rewrite |
| `npm run test:module -- timeline`（02.10 corrected-scope） | 通过 | 约 31s | Node 24.18.0；182 passed / 0 failed |
| `npm run test:i18n`（02.10 corrected-scope） | 通过 | <1s | Node 24.18.0；217 passed / 0 failed |
| `npm run build`（02.10 corrected-scope） | 通过 | <1s | Node 24.18.0；生成 1,291,715 字节单文件应用 |
| `git diff --check`（02.10 corrected-scope） | 通过 | <1s | 仅 active 验收单有 corrected-scope 元数据 diff；无 whitespace error |

固定 App installed source：b8da5f4f36a40010541700171cb246f2ca9de17b

固定 App 人工启动结果：不适用；本轮禁止固定 App 交付。

## 未覆盖与后续

- 本任务不重跑 camera/history/project/playback、隔离 Electron、`test:impact`、`test:full` 或 `app:deliver`。
- 独立 R2、中央集成、最终回归与固定 App 交付后置。

## 交接

- 来源提交：旧 03.17 的 `1e7e2e1`、`a8ce2a7`、`a23973f`、`36eaecb`
- corrected-scope 分支提交：四个独立 cherry-pick + 本验收单元数据提交（提交后登记完整链）
- PR：无
- reviewer 结论：未评审（R2 后置）
- 生命周期交接：保持 ACTIVE；限定验证和 stop verification 后转 REVIEW
- 工作区状态：四提交已无冲突机械承接；corrected-scope 元数据待提交
- 下一步：固定 02 组织实现者之外的聚焦独立 R2
