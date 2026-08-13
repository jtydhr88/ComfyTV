# 任务：导出媒体保存位置一致性

- 状态：completed
- 日期：2026-07-27
- 对话：04.18｜导出媒体保存位置一致性
- 分支：`fix/04.18-export-media-save-target-consistency`
- 基线：`25cfb350af1321c80d99910705f4bc4f41bd196b`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`
- 负责人：`worker:04.18-export-media-save-target-consistency`

## 并行任务声明

- 任务 ID：`04.18-export-media-save-target-consistency`
- 模式：write
- 分管 owner：04
- 模块：`capture,desktop,testing`
- UI 表面：`capture-controls`
- 数据区域：`electron-ipc`
- 预计修改文件：
  - `src/export/capture.js`
  - `electron/main.cjs`
  - `测试/冒烟测试.mjs`
  - `测试/桌面壳测试.mjs`
  - `预见PreVision.html`
  - `docs/qa/export-media-save-target-consistency/README.md`
  - `docs/plans/active/2026-07-27-export-media-save-target-consistency.md`
  - `docs/plans/completed/2026-07-27-export-media-save-target-consistency.md`
  - `docs/plans/completed/README.md`
- reservation：已从同一 reservation 转换；token 已去敏且不进入仓库
- reserve request key：已由固定 04 核对；本任务不持有明文 request key
- 协调登记：schema v3；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：`worker:04.18-export-media-save-target-consistency` / `worker:04.18-export-media-save-target-consistency`
- 状态更新时间 / 原因：2026-07-27T06:24:14.276Z；同一 canonical thread 已收到正式开工 turn
- 侧栏去重证据：task id、client id、thread id 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；未把侧栏条目冒充 Desktop live
- WAITING checkpoint：首个 turn 已完成基线核验并等待固定 04 下达正式 scope
- turn stop verification：未完成
- 失败补偿：标准 claim 明确命中 `spawnSync git ENOBUFS` 且未转换；核对批准协调器 blob 后以一次性非落盘 64MiB wrapper 成功转换同一 reservation
- `task:check` 结果：同一 reservation 的原子 claim 通过，无新硬冲突
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：待独立 reviewer PASS 后处理
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

统一右下“导出当前镜视频”“导出本场景”与当前帧 PNG 的保存位置语义：编码或写入前先选择目标，取消或失败不得留下任何媒体、项目、history、autosave 或 busy 副作用；成功时沿用既有编码链并显示真实保存路径。

## 目标

- 在 current-shot、scene 和当前帧 PNG 的任何编码、自动捕获准备、冻结播放或写入之前调用既有 `capture:choose-target`。
- 用户取消或对话框失败时保持零编码、零临时导出、零项目/history/autosave 写入和零 busy 残留。
- 成功时沿用既有编码/捕获链，仅把最终写入改为一次性 token 的 `capture:save-target`。
- 使用既有 language key 显示真实保存路径，覆盖非法/过期 token、编码失败和 path feedback。

## 非目标

- 不重写编码器、MediaRecorder settlement 或自动导出内容身份逻辑。
- 不改变顶部整套导演界面截图/录屏语义。
- 不全局修改 JSON、ZIP 等其他 `dl()` 调用。
- 不修改语言包；若既有 key 不足则停止升级 scope。
- 不运行 `test:full`、`app:deliver`，不更新最新预览指针或固定 App，不推送远端。

## 证据与现状

- 代码：待核对 `src/export/capture.js`、`electron/main.cjs` 与生成 HTML 的现有导出/IPC 链。
- Git：指定 baseline 与 clean 工作树已核对；已创建唯一指定分支。
- 测试/运行：Node `v24.18.0`；正式 claim 已成功进入 ACTIVE/BACKGROUND_ONLY。
- 文档/历史线索：既有自动导出已冻结 scene/shot 身份并对 MediaRecorder 无 `onstop` 做单次 settlement；本任务保持该链不变。

## 影响范围

- 模块：`capture,desktop,testing`
- 文件：仅并行任务声明中的精确文件集合
- 数据格式：无；不改 project v5、history 或 autosave schema
- 平台：macOS Electron；浏览器回退保持既有行为

## 风险

- 风险档：R2
- 请求模型：不可观察，未验证
- 实际模型：不可观察，未验证
- 请求 reasoning：不可观察，未验证
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：不可观察，未验证
- Ultra：不可观察，未验证
- Max/升级原因：无
- 独立只读 reviewer：由固定 04 在实现提交后另行组织 R2
- 数据：选择、取消、编码/保存失败不能触发 project/history/autosave 写入
- UI/交互：目标选择必须发生在 busy/冻结/编码之前；结果显示真实路径
- 安全：renderer 不得提交任意绝对路径；继续依赖主进程绑定 renderer/type 的一次性 token
- 发布：仅隔离 NOT INTEGRATED 预览；固定 App 不变

## 验收条件

- [x] current-shot、scene、PNG 在任何编码、`prepareAutomaticCapture()`、冻结播放或写入前选择目标。
- [x] cancel 与 dialog failure 为零编码、零临时导出、零项目/history/autosave 写入、零 busy 残留。
- [x] 成功仅通过一次性 token `capture:save-target` 写入，并显示真实保存路径。
- [x] 非法/过期 token、encoding failure 明确失败且不静默回退固定 export 目录。
- [x] 顶部截图/录屏及 JSON/ZIP 等其他 `dl()` 语义不变。
- [x] build、capture module、desktop、i18n 及必要 smoke 通过。
- [x] 独立 profile Electron 中真实点击 current-shot、scene、PNG，完成 cancel 与成功路径检查。
- [ ] 实现者之外的独立 R2 reviewer 已完成，阻塞问题已关闭。
- [x] 快速预览阶段不运行 `app:deliver`；固定 App 未改变。
- [x] QA 证据文档已更新。

## 测试计划

- 影响映射模块：capture、desktop、testing
- 主应用模块参数：capture
- 最小命令：
  - `npm run build`
  - `npm run test:module -- capture`
  - `npm run test:desktop`
  - `npm run test:i18n`
  - 必要的定向 smoke/真实 Electron UI
- 升级到全量的条件：本轮明确禁止 `test:full`；若最小门禁暴露跨模块问题，停止并升级固定 04
- 人工检查尺寸/步骤：独立 profile 的 Electron；current-shot、scene、PNG 分别验证 cancel 与成功路径
- 固定 App 交付：不适用；本轮不得触碰 `~/Applications/PreVision.app`

## 实施记录

- 假设：现有 capture target IPC 与既有 path feedback language key 可复用。
- 关键决定：目标授权先于任何导出副作用；只改最终媒体落盘，不改编码内容和时间冻结合同。
- 实际修改：右下当前帧 PNG、当前镜视频与本场景视频在桌面端先调用既有目标选择 IPC；取消在渲染/自动捕获准备/编码前返回。成功继续沿用原渲染与 MediaRecorder 链，仅把最终字节写入切换为一次性 token，并通过既有 `export.saved` 显示主进程返回的真实路径。浏览器 `dl()` 回退和顶部捕获入口不变。
- 中断/恢复：首个 turn 仅完成 WAITING 身份与基线核验；本 turn 在同一 canonical thread 恢复并转换同一 reservation。
- app-server 通知消费：当前 turn 登记为 started/background；BACKGROUND_ONLY 不作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 baseline/clean | PASS | <1s | HEAD 精确匹配，创建指定分支前 clean |
| 标准 `task:claim --reservation` | 失败且未转换 | 约 24s | `spawnSync git ENOBUFS` |
| 批准的一次性 64MiB wrapper claim | PASS | 约 44s | ACTIVE/BACKGROUND_ONLY；协调器 blob 已核对 |
| Node 24 `npm run app:status`（安装依赖前） | BLOCKED | <1s | 缺少锁定依赖 `@electron/asar`；固定 App 未变 |
| Node 24 `npm ci` | PASS | 11s | 安装 506 个锁定依赖；package/lock SHA-256 与 Git 状态前后无漂移 |
| Node 24 `npm run app:status`（安装依赖后） | PASS | <1s | installed=`b8da5f4…`；contains=yes；exact=no |
| Node 24 `npm run build` | PASS | <1s | 生成 HTML 与模块实现一致 |
| Node 24 `npm run test:module -- capture` | PASS | 约 2s | 150/150；含 cancel、dialog failure、token、encoding failure 与 path feedback |
| Node 24 `npm run test:desktop` | PASS | 约 2s | 47/47；既有一次性 token 与过期合同保持通过 |
| Node 24 `npm run test:i18n` | PASS | 约 2s | 217/217；未新增语言 key |
| Node 24 `npm run test:core` | PASS | 约 23s（与定向门禁并行） | 19/19；主应用核心启动通过 |
| `git diff --check` | PASS | <1s | 无空白错误 |
| 独立 profile Electron cancel | PASS | 人工 | current-shot、scene、PNG 均先弹原生选择器；取消后“就绪”且无 busy |
| 独立 profile Electron success | PASS | 人工 | PNG 与两条 MP4 均为有效非空媒体；状态显示各自真实路径 |
| 最终 Node 24 `npm run app:status` | PASS | <1s | installed 仍为 `b8da5f4…`；未更新固定 App |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：本轮不启动、不更新固定 App

## 未覆盖与后续

- `test:full`、中央集成、固定 App 交付和对外发布不属于本轮。
- 完成实现与快速预览后保持 claim，交固定 04 组织独立 R2。

## 交接

- 最终提交：本次实现提交（以 Git HEAD 为准；交接时回报精确哈希）
- PR：无
- reviewer 结论：未评审
- 生命周期交接：ACTIVE
- 工作区状态：实现、定向自动化与隔离 UI 预览完成；待最终提交
- 下一步：创建任务提交并保持 claim，交固定 04 组织独立 R2
