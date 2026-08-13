# 任务：01.15｜播放头与尺规吸附一致性修复

- 状态：completed
- 日期：2026-07-29
- 对话：01.15｜播放头与尺规吸附一致性修复｜后台施工
- 分支：`fix/01.15-playhead-ruler-snap-consistency`
- 基线：`5e059556b44d3d215aee9f0207b94796cd3a4f2b`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`
- 负责人：短期实现任务 `01.15-playhead-ruler-snap-consistency`

## 并行任务声明

- 任务 ID：`01.15-playhead-ruler-snap-consistency`
- 模式：write
- 分管 owner：01
- 模块：`timeline,playback,layout,testing,i18n`
- UI 表面：`timeline`
- 数据区域：`ui-preferences,qa-metadata,i18n-resources`
- 预计修改文件：
  - `src/ui/timeline.js`
  - `app-shell.html`
  - `i18n/locales/zh-CN.js`
  - `i18n/locales/en-US.js`
  - `测试/冒烟测试.mjs`
  - `预见PreVision.html`
  - `docs/CURRENT_STATE.md`
  - `docs/FEATURE_REGISTRY.md`
  - `qa/feature-registry.yaml`
  - `docs/qa/timeline-playhead-snap/README.md`
  - `docs/qa/timeline-playhead-snap/electron-1440x900.png`
  - `docs/plans/active/2026-07-29-playhead-ruler-snap-consistency.md`
  - `docs/plans/completed/2026-07-29-playhead-ruler-snap-consistency.md`
  - `docs/plans/completed/README.md`
- reservation：已由唯一 reservation 成功转换为 active claim（token 仅在本机核对，不写入仓库）
- reserve request key：已核对/已去敏
- 协调登记：schema v3；claim 已持久化成功，精确 revision 未从成功输出中捕获
- 权威生命周期：本提交形成时为 ACTIVE；提交后按当前 HEAD 独立 `task:verify-stop` 并转 REVIEW，以 common-dir 登记为准
- 当前 actor / 下一责任人：`worker:01.15-playhead-ruler-snap-consistency`
- 状态更新时间 / 原因：2026-07-29；同一 reservation 已完成唯一 claim，后台实现与最小验收进行中
- 侧栏去重证据：task id、client id、thread id 已在本机核对/已去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；外部后台 turn 不作为 Desktop live 证据
- WAITING checkpoint：不适用
- turn stop verification：将在本提交后以独立 `task:verify-stop` 持久化 completed/background 证据；结果以 common-dir 登记为准
- 失败补偿：无；claim 失败时保留 reservation 并 fail closed
- `task:check` 结果：未运行；固定 01 的原子 reserve 已包含冲突门禁，本任务禁止重复 check
- `task:claim --reservation`：成功；scope 与本验收单完全一致
- REVIEW commit list：将在本提交后以 baseline..HEAD 完整有序列表冻结
- 机械 closeout：不适用；独立 reviewer PASS 后才由同一任务执行
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

修复红色播放头、尺规点击/拖动和 lane 空白定位绕过既有 `motionSnap` 的真实缺陷，并统一播放头与关键帧的开关语义：ON 使用既有 0.1s 量化与整秒/半秒强吸附，OFF 或 Option/Alt 旁路保持连续；拖动中实时显示当前时间，同时保持程序播放、项目、历史、自动保存及捕获边界不变。

## 目标

- `motionSnap` 开启时，红色播放头拖动、尺规点击/拖动和 lane 空白点击定位共用 0.1s 量化与约 8 CSS px 的整秒/半秒强吸附。
- `motionSnap` 关闭时只 clamp 合法边界并保持连续，不再 0.1s 量化；Option/Alt 在开启时临时旁路量化与强吸附，同样保持连续。
- 播放头和关键帧在 pointermove 后、pointerup 前实时更新可见 status，连续值以三位小数呈现。
- 复用既有竖向 guide、双语状态与反馈清理逻辑，并为红色播放头增加可观察的吸附高亮。
- 正常 pointerup 可保留最终吸附状态；拖离、Option、关闭、blur、pointercancel、lostpointercapture 清理反馈，取消路径不保留误导完成状态。
- 程序化播放、逐帧预演、导出和录制采样保持连续，不被量化或吸附。
- shot-local 与 scene-global 手动定位边界正确，capture gate 保持，且 project/history/autosave 零写入。

## 非目标

- 不修改关键帧、镜头时长、播放数据、project v5、history 或 autosave 语义。
- 不重构整个 timeline，不新增持久状态。
- 不运行 `test:impact`、`test:full`、`app:deliver`、`app:update`。
- 不更新固定 App、“PreVision 最新预览”指针、GitHub、Pages 或任何远端。
- 不在 immutable scope 之外写入；确需 scope 外文件时停止并回报固定 01。

## 证据与现状

- 代码：`src/ui/timeline.js` 中 key/group drag 已调用 `resolveMotionDragTime()`；`startScrub → flushScrub → scrubMotionTimelineTime()` 及 lane 空白点击仍直接消费 raw seconds。
- Git：开工前 HEAD 精确为 baseline、工作区 clean；目标分支此前不存在并已从 baseline 创建。
- 测试/运行：Node `v24.18.0`；`npm ci` 后 `app:status` 成功，确认当前分支包含 fixed App installed source。
- 协调：固定 01 已完成唯一 reserve；非任务验收的 status 恢复仍因协调器内部 `spawnSync git ENOBUFS` 失败，结果未使用，未重复 check/status。
- 文档/历史线索：TIME-001～006；02.12 已建立共享 0.1s/0.5s/1.0s helper、session-only `motionSnap` 与反馈边界。
- baseline 审计：固定 00 在精确 baseline `5e059556b44d3d215aee9f0207b94796cd3a4f2b`、同一 Node 24 timeline 命令下得到 188 通过、1 失败；失败同为 `A·主体.scale 1→0.81`。这证明是既有 AutoKey 夹具清理缺陷，但本任务仍以返修后全绿为交接门禁，未作豁免。

## 影响范围

- 模块：`timeline,playback,layout,testing,i18n`
- 文件：仅上述 immutable scope
- 数据格式：无
- 平台：macOS Electron 隔离开发预览；浏览器运行时共用代码

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：High
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：由固定 01 组织实现者之外的独立 R2 reviewer
- 数据：手动时间映射必须保持 camera shot-local 与 actor/prop scene-global 边界，不得污染 clock 的程序推进。
- UI/交互：pointerup、pointercancel、lostpointercapture、blur、Option 和开关切换的反馈收尾必须区分完成与取消。
- 安全：不扩大输入、IPC、捕获或外部资源边界。
- 发布：仅 NOT INTEGRATED 隔离预览。

## 验收条件

- [x] 先增加能在修复前失败的真实 pointer 回归，再完成最小修复。
- [x] 红色播放头 1.44→1.5，尺规 2.04→2.0，lane 空白 1.46→1.5。
- [x] snap OFF 与 Option/Alt 旁路时，播放头和关键帧的 1.437/2.043 在像素容差内保持连续；ON 的既有 0.1s 量化与 8px 强吸附继续通过。
- [x] 播放头和关键帧在 pointermove 后、pointerup 前已更新真实时间与可见 status，分别显示 1.437/2.043。
- [x] snap→unsnap、blur、pointercancel、lostpointercapture 正确清理；只有正常 pointerup 可保留最终吸附状态。
- [x] 程序播放可经过 1.43 不跳；scene-global 跨镜与 shot-local 都正确。
- [x] capture gate 保持，project/history/autosave 全部零写。
- [x] `timeline.snap` 双语文案明确同时作用于播放头和关键帧，运行时不新增内联中文。
- [x] Node 24 下 timeline、playback、layout、i18n、build 与 `git diff --check` 通过。
- [x] 隔离 Electron 标题与时间轴完成静态 UI 检查，保存实际 1396×768 的去敏截图与 README；实际窗口为 2560×1409 CSS px。
- [ ] 人工原生拖拽未验证：Computer Use 前置条件/坐标链路连续失败；00 裁决为本次快速预览的证据缺口而非 REVIEW 硬阻断，截图不得写成 PASS。
- [ ] 实现者之外的独立 R2 reviewer 已完成，阻塞问题已关闭。
- [ ] 固定 App 交付不适用：本轮明确禁止 `app:deliver`。
- [ ] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：`timeline,playback,layout,i18n`
- 主应用模块参数：`timeline`、`playback`、`layout`
- 最小命令：Node 24 下 `npm run test:module -- timeline`、`npm run test:module -- playback`、`npm run test:module -- layout`、`npm run test:i18n`、`npm run build`、`git diff --check`
- 升级到全量的条件：本轮明确禁止 `test:impact` / `test:full`；出现 scope 外必需修改即停止回报
- 人工检查尺寸/步骤：隔离 Electron 实际窗口 2560×1409 CSS px、DPR 2；静态核验标题与时间轴。真实拖红色播放头的 on/off、Option、guide/status/highlight 与取消清理因 Computer Use 工具失败而未验证
- 固定 App 交付：不适用；不得触碰 `~/Applications/PreVision.app`

## 实施记录

- 假设：强吸附阈值继续复用既有按轨道宽度换算的约 8 CSS px；只有 snap ON 且未按 Option/Alt 时量化到 0.1s。
- 关键决定：只把用户手动 scrub 输入接到既有 helper/反馈，不修改程序化 clock 推进。
- 实际修改：手动 playhead/ruler/lane 统一复用 `resolveMotionDragTime()`；共享 resolver 仅在 snap ON 且未旁路时量化/强吸附，OFF/Option 只 clamp 连续值；未吸附的播放头与关键帧 pointermove 用双语三位小数 status 实时反馈。正常完成与取消反馈分流；播放头增加吸附高亮；冒烟测试加入真实 pointer、连续播放、边界和零写回归。
- 用户真实预览返修：首版自动合同仍把 OFF/Option 固定到 0.1s；用户指出真实拖动应连续后，同一 ACTIVE claim 增加播放头与关键帧执行级 RED。RED 为 timeline 192/2，actual 分别是播放头 `1.4/2.0`、关键帧 `1.4/2.0` 且 status 未实时显示 1.437/2.043；最小 resolver/status 返修后转绿。
- 测试夹具返修：删除临时 broad/global sidecar restore；既有 AutoKey 用例在两次 undo 后均按 `boundaryLabel` 重取当前 actor，并调用 `setActorScaleSafely()` 同步恢复 runtime scale 与 authored authoring source。
- 中断/恢复：timeline 曾因既有 AutoKey 用例只恢复 `obj.scale` 而未恢复 authored source 留下 1 个失败；固定 00 核对 baseline 同样失败后解除暂停，本任务按指定最小夹具返修恢复全绿。
- app-server 通知消费：后台 started turn；完成前必须独立 `task:verify-stop`，不得作为 Desktop live 证据。
- 隔离预览：使用中央只读 Electron 43.1.0 二进制的临时 clone launcher、独立 bundle id 和独立 userData 加载当前工作树；只操作并关闭本任务临时进程。
- 人工证据边界：窗口完整置于 `2560×1409` work area，renderer inner 为 `2560×1377`，尺规 `1764×25`、lane `1764×29` CSS px；截图实际 `1396×768`。静态截图只证明 UI 呈现，不证明真实原生拖拽。
- Computer Use 失败：最终一次允许的原生拖拽在动作前被拒绝，错误为 `The user changed '<isolated-temp>/PreVision 01.15 Preview.app'. Re-query the latest state with get_app_state before sending more actions.`；仓库内按安全规则去除临时绝对路径。该次未产生可归因的新 pointer 事件，关闭前状态为 `tc=00:01.3 / 00:16.5`、status=`位置 · 第 1 段 · 0.00s → 5.00s · 已选 1 个关键帧`、`motionSnap=false`。
- 预览清理：本任务临时主进程 exit 0、PID 不再存在；临时 clone/profile/bootstrap/log 已删除，其他 Electron 实例未操作。
- R2 P2 返修：独立 R2 指出 generic preview key/group 与 legacy camera key 的结束处理把正常 `pointerup` 和 `pointercancel`/`blur`/`lostpointercapture` 同等视为完成，取消后会错误恢复最终“已吸附”状态。同一 ACTIVE claim 将两处处理器改为只有真实 `pointerup` 可保留 `finalSnap`；9 条执行级 PointerEvent 回归分别覆盖两类 generic 目标与 legacy key 的三种取消路径。有效 RED 为 timeline `199/10`（9 条新增断言及隔离子进程汇总）；最小产品修复后 generic 全绿，legacy 的 `206/3` 仅由测试复用已被 `refreshMotionTimeline()` 替换的旧 guide 节点造成，四项诊断为 `snappedBeforeFinish=false / guideHidden=true / highlightCleared=true / snapStatusCleared=true`；改用实际 live guide/key 后最终 GREEN 为 `209/0`。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| 开工 Git/Node 核对 | 通过 | <1s | baseline 精确、工作区 clean、Node 24 |
| 初次 `npm run app:status` | 失败 | <1s | 本 Worktree 缺少锁定依赖中的 `@electron/asar` |
| `npm ci` | 通过 | 约 16s | 仅安装锁定依赖；未改 package/lock |
| 重试 `npm run app:status` | 通过 | <1s | installed=`b8da5f4…`；contains=yes；exact=no |
| 非任务验收 status 恢复 | 失败，结果未使用 | 约 75s | 受信脚本 hash 正确；内部 `spawnSync git ENOBUFS`；未再运行 check/status |
| baseline Node 24 `test:module -- timeline` | 188 通过 / 1 失败 | 由固定 00 审计 | 精确 baseline；同为 `A·主体.scale 1→0.81`，不得豁免 |
| Node 24 `npm run build` | 通过 | <1s | `预见PreVision.html` 已重建 |
| 新合同 RED：Node 24 `npm run test:module -- timeline` | 192 通过 / 2 失败 | 约 105s | 播放头与关键帧 OFF/Option 均被量化，且 pointermove status 未实时刷新 |
| 生成物同步前 post-fix timeline | 187 通过 / 7 失败 | 约 105s | 冒烟仍读取旧 `预见PreVision.html`；同步声明内生成物后重新执行 |
| Node 24 `npm run test:module -- timeline` | 194 通过 / 0 失败 | 约 82s | ON 量化/8px 强吸附、OFF/Option 连续、实时 status、边界、零写与夹具清理全绿 |
| Node 24 `npm run test:module -- playback` | 42 通过 / 0 失败 | 约 20s | 程序播放可经过 1.43s |
| Node 24 `npm run test:module -- layout` | 160 通过 / 0 失败 | 约 35s | 时间轴布局相关门禁通过 |
| Node 24 `npm run test:i18n` | 217 通过 / 0 失败 | 约 1s | 双语 key 对齐及运行时中文守卫通过 |
| R2 P2 RED：Node 24 `npm run test:module -- timeline` | 199 通过 / 10 失败 | 约 87s | generic key/group 与 legacy key 的 cancel/blur/lostcapture 共 9 条完成状态残留断言失败；另 1 条为隔离子进程汇总 |
| R2 P2 修复后诊断：Node 24 `npm run test:module -- timeline` | 206 通过 / 3 失败 | 约 57s | generic 已全绿；legacy 取消后的 guide/highlight/snap status 已清理，剩余 3 条定位为测试缓存旧 guide 节点 |
| R2 P2 GREEN：Node 24 `npm run test:module -- timeline` | 209 通过 / 0 失败 | 约 60s | 只有真实 pointerup 保留 finalSnap；generic key/group 与 legacy key 的三类取消路径均清理 live guide/highlight/snap-specific status |
| R2 P2 Node 24 `npm run test:module -- layout` | 160 通过 / 0 失败 | 约 73s | 限定布局回归通过 |
| R2 P2 Node 24 `npm run test:i18n` | 217 通过 / 0 失败 | 约 1s | 双语与运行时中文守卫继续通过 |
| R2 P2 Node 24 `npm run build` | 通过 | <1s | `预见PreVision.html` 重建为 1301806 字节 |
| `git diff --check` | 通过 | <1s | 无空白错误 |
| 隔离 Electron 静态检查 | 部分证据 | 实际窗口 2560×1409 CSS px | 标题精确；时间轴可见；PNG 实际 1396×768，只作静态呈现证据 |
| Computer Use 原生拖拽 | 未验证 | 工具证据缺口 | 最终动作前被拒绝且无可归因的新 pointer 事件；不得写成 PASS |
| 隔离进程/临时文件清理 | 通过 | <1s | 主进程 exit 0，PID 不存在，临时 clone/profile/bootstrap/log 已删除 |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：不适用；本轮不启动或修改固定 App。

## 未覆盖与后续

- 人工原生拖拽仍未验证；00 已裁决为 Computer Use/坐标工具证据缺口，不阻断本次快速预览进入 REVIEW，但独立 R2 必须看到此限制。
- 首轮独立 R2 为 FAIL（P0=0/P1=0/P2=1）；P2 已按上述最小范围返修并完成限定门禁，仍待实现者之外重新复审。HANDED_OFF、中央集成和最终回归尚未完成。
- 固定 App、稳定预览指针、GitHub、Pages、`test:impact`、`test:full` 与正式交付均未触碰。

## 交接

- 最终提交：本验收单随聚焦实现提交冻结；精确 HEAD 与 baseline..HEAD 有序列表由 Git 和 `task:transition` 持久化
- PR：无
- reviewer 结论：首轮 R2 FAIL（P0=0/P1=0/P2=1）；P2 已返修，等待独立重新复审
- 生命周期交接：本提交形成时为 ACTIVE；随后独立 verify-stop→REVIEW，保持 claim
- 工作区状态：实现、限定自动验收、静态隔离预览与清理已完成；人工原生拖拽未验证
- 下一步：进入 REVIEW 后停止，由固定 01 组织实现者之外的独立 R2；不自行 HANDED_OFF、release 或 archive
