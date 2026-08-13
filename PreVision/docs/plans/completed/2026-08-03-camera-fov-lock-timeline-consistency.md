# 任务：01.17｜摄影机 FOV 锁定与时间线一致性修复

- 状态：completed
- 日期：2026-08-03
- 对话：01.17｜摄影机 FOV 锁定与时间线一致性修复
- 分支：fix/01.17-camera-fov-lock-timeline-consistency
- 基线：37c8cd8d81626b81232a2ab5f774326811602532
- 固定 App 来源：b8da5f4f36a40010541700171cb246f2ca9de17b（只读核对，不更新）
- 负责人：worker:01.17-camera-fov-lock-timeline-consistency

## 并行任务声明

- 任务 ID：01.17-camera-fov-lock-timeline-consistency
- 模式：write
- 分管 owner：01
- 模块：camera、timeline、playback、history、project、capture、testing
- UI 表面：inspector、monitor、timeline、viewport
- 数据区域：shot-camera、project-v5、autosave、qa-metadata
- 预计修改文件：
  - `src/ui/inspector.js`
  - `src/playback/engine.js`
  - `测试/冒烟测试.mjs`
  - `测试/项目输入DOM探针.cjs`
  - `qa/test-impact-map.yaml`
  - `测试/影响范围测试.mjs`
  - `预见PreVision.html`
  - `docs/CURRENT_STATE.md`
  - `docs/FEATURE_REGISTRY.md`
  - `qa/feature-registry.yaml`
  - `docs/plans/active/2026-08-03-camera-fov-lock-timeline-consistency.md`
  - `docs/plans/completed/2026-08-03-camera-fov-lock-timeline-consistency.md`
  - `docs/plans/completed/README.md`
  - `docs/qa/camera-fov-lock-timeline-consistency/README.md`
  - `docs/qa/camera-fov-lock-timeline-consistency/evidence.json`
  - `docs/qa/camera-fov-lock-timeline-consistency/chrome-lan-actor-lock-fov.png`
- reservation：已预留（reservation id、generation 与过期时间已在 common-dir 权威登记核对；不记录 token）
- reserve request key：已由固定 01 核对并去敏
- 协调登记：schema v3；revision 已在本机核对，persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:01.17-camera-fov-lock-timeline-consistency / worker:01.17-camera-fov-lock-timeline-consistency
- 状态更新时间 / 原因：2026-08-03T11:07:52Z；唯一 canonical 侧栏临时工已用同一 reservation 与完整 scope 转换 claim
- 侧栏去重证据：task id、canonical client/thread 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；当前没有 Desktop-owned started turn 与实际观察证据，不宣称 DESKTOP_LIVE
- WAITING checkpoint：不适用
- turn stop verification：未完成
- 失败补偿：无；恢复并使用同一 canonical task/thread/reservation
- `task:check` 结果：固定 01 已完成，无硬冲突；当前占用 1/2 写槽
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：reviewer PASS 后以 sole-parent closeout 仅迁移 active→completed 并更新 completed/README
- `task:release`：未释放；claim 必须保留至 `00` 中央集成与最终回归
- `task:archive`：未开始

## 用户问题

新增摄影机时间线后，actor/global 锁下编辑 FOV 只更新 inspector 标签，当前 `camKey`、`shotCam`、monitor、播放和自动 capture 仍使用旧 FOV；要求修复并建立跨锁定、计时、关键帧、草稿、撤销、保存和捕获的永久回归。

## 目标

- FOV 显示、写入和播放采样与 yaw/pitch 锁解耦；actor、global、manual 三种锁下保持 authored/draft/runtime/serialized 四层一致。
- committed key 编辑同时更新当前 `camKey.fov` 与兼容标量 `shot.fov`；非 key 且 AutoKey off 只更新 transient draft，记录前项目、history、autosave 零写。
- `shotCam`、monitor、播放、point preview 开关和自动 capture 统一使用当前 key、插值或 draft FOV。
- 一个连续输入手势只形成一次 history/autosave；Undo、保存重开和 capture gate 维持完整合同。
- 将 inspector/timeline/playback 相关变更永久映射到 camera、timeline、playback 回归。

## 非目标

- 不改变 yaw/pitch、演员锁定朝向、演员删除后的锁回退、时间轴数据格式或旧 project v1–v5 语义。
- 不更新固定 App、稳定 LAN 指针、GitHub 或 Pages；不运行 `app:deliver`。
- 不借本任务重构无关摄影机/时间轴模块或修复旁支问题。

## 证据与现状

- 代码：`src/ui/inspector.js` 的 FOV `oninput` 用 `yaw.disabled` 决定是否写 `ensureCamKeys(s)[selCamPt].fov`；actor/global 锁只改 `shot.fov`。
- 代码：`src/playback/engine.js` 的 custom timing 从 `sampleTimedCameraKey` 继续读取旧 `camKey.fov`。
- Git：回归由 6ce33052 引入的新摄影机时间线条件分支暴露；任务基线为 37c8cd8d81626b81232a2ab5f774326811602532。
- 测试/运行：既有测试只覆盖 manual lock，未覆盖 actor/global；真实 Chrome/LAN 曾复现 actor lock=男人1、custom、t=0、39°→79° 时标签变化但 monitor 仍 33mm、构图不变、console 无错误。
- 文档/历史线索：`camPts/camKeys/camTimes` 必须保持单一持久真相，不新增平行持久状态。

## 影响范围

- 模块：camera、timeline、playback、history、project、capture、testing
- 文件：仅限并行任务声明中的 16 个精确路径
- 数据格式：无；保持 project v5 与旧 v1–v5 兼容语义
- 平台：Node 24 自动回归；隔离 Chrome/LAN 人工验证；不把 Electron Chromium 冒充独立 Chrome

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：High
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：已完成首轮 R2；P0/P1 none，P2 为 Chrome/LAN 证据不足，P3 为 DOM probe timeline fixture 缺少必要性说明；生命周期已合法 REVIEW→ACTIVE，模型不是验收证据
- 数据：`shot.fov`、`camKeys[].fov`、transient draft、project v5 保存和旧项目兼容必须一致
- UI/交互：原生 range input 的 input/change、point preview、monitor 焦段和构图必须同步
- 安全：capture gate 下 project/history/autosave/draft/runtime 零写；不扩大 IPC 或文件权限
- 发布：本任务只形成 NOT INTEGRATED 任务分支；固定 App、稳定 LAN 与远端均不更新

## 验收条件

- [x] 先用执行级真实 `input`/`change` 形成 RED：actor/global、custom、t=0 下 UI 变为 79°，但基线实际 `camKey`、`shotCam`、monitor/playback 保持旧值；记录精确 expected/actual。
- [x] actor/global/manual 三锁 × custom/pointSync/arcLength 三时序 × 0 秒基础点/普通 key/非 key transient draft 全矩阵通过。
- [x] committed key 同步 `camKey.fov` 与 `shot.fov`；非 key/AutoKey off 在记录前 project/history/autosave 零写。
- [x] `shotCam`、monitor、playback、自动 capture 与 point preview 开/关统一使用当前 key/插值/draft FOV。
- [x] 单次连续手势只产生一次 history/autosave；Undo 恢复标量、key 与运行画面；保存重开一致。
- [x] capture gate 拒绝 FOV input 且 authored/draft/runtime/serialized 零写；自动 capture 至少一帧使用修复后的 `shotCam.fov`。
- [x] yaw/pitch、演员锁定朝向、演员删除锁回退、时间轴格式和旧 v1–v5 项目语义不变。
- [x] Chromium 原生 range input 探针已增加，但没有把 Electron Chromium 表述为独立 Chrome。
- [x] 影响映射固化 inspector/timeline/playback 相关变更触发 camera、timeline、playback 回归。
- [x] Node 24 最小验证已全部执行；impact 的任务定向模块均通过，随后仅因 baseline 同样存在的 2 个历史 `test:app` 失败返回 1，未包装为 PASS。
- [ ] 真实 Chrome/LAN 可审计证据尚只独立展示 actor/custom/t=0 的 79°/约15mm、monitor 15mm 与变更后构图；39→79 输入过程、global/manual、pointSync/arcLength、playback、point preview、save/reopen 与 console 记录属于此前人工观察，本证据未独立展示，不能勾成完整 PASS。
- [ ] 实现者之外的独立 R2 首轮已完成但结论为 BLOCK；本轮完成 P2/P3 最小返修后仍需 reviewer 复核关闭阻塞。
- [x] 固定 App 交付不适用：明确禁止 `app:deliver`，由 `00` 后续中央集成决定。
- [x] 文档、功能登记和 QA 证据同步更新。

## 测试计划

- 影响映射模块：camera、timeline、playback、history、project、capture、testing
- 主应用模块参数：camera（同时显式运行 timeline、playback、history、project、capture）
- 执行矩阵：

| 维度 | 值 | 必查结果 |
| --- | --- | --- |
| 锁定 | actor / global / manual | FOV 不依赖 yaw/pitch disabled；yaw/pitch 仍仅 manual 可改 |
| 计时 | custom / pointSync / arcLength | key、插值、preview 与播放采样一致 |
| 时间位置 | 0 秒基础点 / 普通 key / 非 key draft | committed 同步标量+key；draft 记录前零持久写 |
| point preview | 开 / 关 | `shotCam`、monitor、playback 取同一有效 FOV |
| 生命周期 | input / change / Undo / save-reopen | 一次 history/autosave；运行画面和序列化一致 |
| 捕获 | gate 拒绝 / 自动 capture | 拒绝零写；允许时至少一帧使用修复后 `shotCam.fov` |

- 最小命令：`npm run build`；camera/timeline/playback/history/project/capture 模块；`npm run test:project-input`；`npm run test:i18n`；`npm run test:foundation`；`npm run test:impact -- --base 37c8cd8d81626b81232a2ab5f774326811602532 --module camera`；`git diff --check`
- 升级到全量的条件：impact 按规则明确要求；否则由 `00` 在集成阶段决定
- 人工检查尺寸/步骤：隔离任务预览、不覆盖稳定 4174；独立 Chrome 中 actor lock=男人1、custom、t=0、39°→79°，再覆盖 global/manual、point preview、pointSync/arcLength；记录 Chrome 版本、URL/source、CSS viewport、expected/actual、console 与截图
- 固定 App 交付：不适用；禁止更新 `~/Applications/PreVision.app`

## 实施记录

- 假设：现有 `camPts/camKeys/camTimes` 继续作为单一持久真相；draft 只复用现有 transient 机制。
- 关键决定：先 RED 后 GREEN；首个产品实现改动前必须已有真实事件级失败证据。
- 实际修改：`src/ui/inspector.js` 使 FOV 显示/提交不再读取 yaw 的 disabled 状态，committed 编辑同步当前 key 与兼容标量，committed/draft input 均即时更新 `shotCam` 和 monitor；`src/playback/engine.js` 统一 custom/pointSync/arcLength 的当前 key FOV 采样，并仅让 manual lock 从 key 写 yaw/pitch。执行回归覆盖三锁×三 timing、基础点/普通 key/draft、point preview、连续手势、Undo、save/reopen、capture gate 与自动 capture；DOM probe 使用 BrowserWindow 内 Electron Chromium 原生 range 键盘路径并明确不冒充独立 Chrome；impact map 固化 inspector/timeline/playback→camera/timeline/playback。
- R2 最小返修：冻结产品提交为 `9663ee982524973d2c6b39912e43800b22241e63`；其 Git tree 为 `66f7b06ab59046dbae305b71bd7c5014164d6823`，Web 入口 `预见PreVision.html` 的 Git blob 为 `191a9acbf0d1a06f2df50fe7edccc0856c8a09da`、SHA-256 为 `60c4b3d213b162593fc4a9bea50b0b4ce579a6cb1117cb612d933e2bfd0a3cd9`。截图自身不编码 commit/hash，因此只把它作为该冻结 build 的人工会话记录，不把绑定包装成截图内生的密码学证明。
- DOM probe timeline fixture 必要性：该 probe 与 FOV 产品语义无关，但与新 FOV native range 共处同一 `test:project-input` 门禁。返修中删除 timeline fixture/选择器/拖动方向改动后，Web/Electron FOV range 均先通过，随后既有 `timelineHitProbe` 以 `timeline fixture did not create every target` 返回 1；因此恢复显式 actor path/time、actor 时间范围、非 foundation key 与唯一 actor clip 选择器，并选择避免边界碰撞的拖动方向，只用于确定性建立既有 hit-test 目标，不改产品代码或业务语义。
- 中断/恢复：无；使用唯一 canonical task/thread/reservation。
- app-server 通知消费：后台 turn 运行中；登记为 BACKGROUND_ONLY，不作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm run app:status` | PASS | — | installed=b8da5f4；current=37c8cd8；contains=yes；exact=no；只读核对 |
| Node 24 `npm run task:status` | PASS（64MiB 受信非落盘 wrapper） | — | claim 前为 1/2、唯一 active reservation；普通命令因 `spawnSync git ENOBUFS` 不可读，未改协调器/registry/锁 |
| Node 24 `task:claim` | PASS（64MiB 受信非落盘 wrapper） | — | `CLAIMED FROM RESERVATION`；ACTIVE/BACKGROUND_ONLY；1 claim、0 reservation；scope 精确一致 |
| 首笔执行级 RED | PASS（确认失败） | — | expected `{ui:79,shot:79,camKey:79,shotCam:79,monitor:15mm}`；actual `{ui:79,shot:79,camKey:40,shotCam:40,monitor:33mm}` |
| 去除测试手工刷新后的第二笔 RED | PASS（确认失败） | — | key/shotCam 已为 79，但 monitor 仍 33mm；随后在真实 input handler 补即时 runtime/monitor 刷新 |
| Node 24 `npm run build` | PASS | — | 重建单一离线 HTML |
| Node 24 `npm run test:module -- camera` | 111/0 | — | 三锁×三 timing、key/draft、Undo/save/capture gate 通过 |
| Node 24 `npm run test:module -- timeline` | 209/0 | — | PASS |
| Node 24 `npm run test:module -- playback` | 42/0 | — | PASS |
| Node 24 `npm run test:module -- history` | 29/0 | — | PASS |
| Node 24 `npm run test:module -- project` | 121/0 | — | PASS |
| Node 24 `npm run test:module -- capture` | 163/0 | — | PASS |
| Node 24 `npm run test:project-input` | PASS | — | Web/Electron BrowserWindow native range；均为 Electron Chromium，不冒充独立 Chrome |
| Node 24 `npm run test:i18n` | 217/0 | — | PASS |
| Node 24 `npm run test:foundation` | 151/0 | — | C8 11/0、coordination 553/0、i18n 217/0、project-input wrapper 11/0 |
| Node 24 `npm run test:impact -- --base 37c8cd8d81626b81232a2ab5f774326811602532 --module camera` | 返回 1（基线等价历史失败） | — | camera 111/0、playback 42/0、timeline 209/0；`test:app` 任务分支 1187/2，精确 baseline 1186/2，失败集合均为“提示词含树木指代”“无 modal 时既有 Space、方向键、G/R/C/F 与 Delete 工作区命令全部恢复”；impact 在此停止 |
| Node 24 `npm run test:web` | 25/0 | — | impact 因历史失败未执行到，故单独补跑；Web runtime 11/0、stress harness 14/0 |
| `git diff --check` | PASS | — | 无空白错误 |
| 真实 Chrome/LAN | PARTIAL_EVIDENCE | — | 冻结产品提交 `9663ee9…`；Chrome 150.0.7871.187；URL `http://192.168.1.122:4187/director/?qa=0117-green`；CSS 2560×1288。当前截图可独立展示男人1/custom/t=0 的 79°/约15mm、monitor 15mm、高2.4m 与变更后构图；39→79 过程及其余矩阵、播放、保存重开、console 0 是此前人工会话记录，本证据未独立展示。返修时 4187 会话已不存在，现有 Chrome 仅有稳定 4174，未接管、未操作。 |
| R2 BLOCK 返修：Node 24 `npm run build` / `npm run test:module -- camera` / `npm run test:project-input` / `npm run test:foundation` / `git diff --check` | PASS | — | build 字节 hash 仍为 `60c4b3…a3cd9`；camera 111/0；project-input 恢复 fixture 后 PASS；foundation 151/0（含 C8 11/0 及后续门禁）；未运行 impact/full |
| R2 fixture 删除对照：Node 24 `npm run test:project-input` | EXPECTED FAIL | — | Web/Electron FOV native range 均先 PASS，随后 `timeline fixture did not create every target`，exit 1；据此恢复仅测试侧 fixture |

固定 App installed source：b8da5f4f36a40010541700171cb246f2ca9de17b

固定 App 人工启动结果：不适用；本任务禁止启动或更新固定 App。

## 未覆盖与后续

- 产品修复、执行级自动矩阵与定向门禁已完成；impact 的 2 个失败已证明与精确 baseline 相同且不属于本任务。隔离 Chrome/LAN 只有 actor/custom/t=0 的最终 79°状态具备当前截图级可审计证据，其余人工观察仍未独立展示；剩余 R2 复核与中央集成。
- 最终 full 与正式交付由 `00` 在集成阶段决定；当前任务不得执行。

## 交接

- 最终提交：已形成聚焦实现提交；精确 Git 对象由 REVIEW 转换时按 baseline..HEAD 完整有序列表冻结
- PR：无
- reviewer 结论：首轮 R2 BLOCK（P0/P1 none；P2 Chrome/LAN 证据不足；P3 DOM probe timeline fixture 缺少必要性说明）；本轮仅做证据/文档与测试夹具说明返修
- 生命周期交接：ACTIVE（claim 保留）
- 工作区状态：产品实现保持冻结在 `9663ee9…`；本轮仅修改验收单、QA README 与结构化证据，待形成独立返修提交后保持 clean。
- 下一步：完成真实 stop verification，转换 ACTIVE→REVIEW，并交由实现者之外的独立 R2 只读 reviewer 审查。
