# 任务：02.8｜空白场景与中性空镜头

- 状态：completed
- 日期：2026-07-27
- 对话：Codex 侧栏短期任务（已核对/已去敏）
- 分支：feat/02.8-blank-scene-neutral-shot
- 基线：a66a03f4efcfa534d4540fe2c71da69ad4cf2532
- 固定 App 来源：b8da5f4f36a40010541700171cb246f2ca9de17b
- 负责人：worker:02.8-blank-scene-neutral-shot

## 并行任务声明

- 任务 ID：02.8-blank-scene-neutral-shot
- 模式：write
- 分管 owner：02
- 模块：camera,history,i18n,layout,project,testing
- UI 表面：dialogs,left-rail
- 数据区域：autosave,i18n-resources,project-v5,qa-metadata,scene-template,shot-camera
- 预计修改文件：app-shell.html,docs/CURRENT_STATE.md,docs/FEATURE_REGISTRY.md,docs/plans/active/2026-07-27-blank-scene-neutral-shot.md,docs/plans/completed/2026-07-27-blank-scene-neutral-shot.md,docs/plans/completed/README.md,i18n/locales/en-US.js,i18n/locales/zh-CN.js,qa/feature-registry.yaml,src/core/project-data.js,src/main.js,src/ui/inspector.js,测试/冒烟测试.mjs,测试/回归/U4_normalize_malformed.mjs,预见PreVision.html
- reservation：已预留（reservation id 已核对；token 未写入仓库）
- reserve request key：已核对/已去敏
- 协调登记：schema v3 revision=c9ae1b40-26ae-4e37-8a70-5dd0b4fbc969；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:02.8-blank-scene-neutral-shot / worker:02.8-blank-scene-neutral-shot
- 状态更新时间 / 原因：2026-07-27T10:04:16.903Z；同一后台侧栏 turn 已正式开工并完成 claim 原子转换
- 侧栏去重证据：task id、client id、thread id 已在本机核对（已去敏）
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；desktopLiveObserved=false，不宣称 DESKTOP_LIVE
- WAITING checkpoint：不适用
- turn stop verification：未完成
- 失败补偿：无；保留同一 reservation/thread
- `task:check` 结果：`task:status` 遭 `spawnSync git ENOBUFS`；未把失败输出冒充权威状态
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：不适用；等待 reviewer PASS 后由后续职责执行
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

新增“空白场景”入口：创建无模板内容、无人物、无道具、无预置用户环境/模板资产的场景，同时保留一个合法、确定性的中性结构空镜头；创建必须可编辑、可保存、可 Undo，并对捕获/导出自动事务实行首写前 fail closed。

## 目标

- 提供可测试的 `makeBlankScene` / `makeNeutralShot` 纯工厂边界，复用现有 project-v5 scene/shot contract。
- 空白场景不携带上一场景或模板的对象、路径、选择、预览动画、camera sidecar、背景/地面自定义资产、太阳、脚本或 `templateId`。
- 中性镜头至少包含一个安全 camera point、global lock、静止且无 `syncActor`，时长、FOV、位置确定。
- 创建成功只形成一次 history 事务和一次 autosave pending/结算；自动事务占用或拒绝路径在任何同步/装载/脏标记前零写入。
- 新增入口、场景名、镜头名和反馈全部使用同步的 zh-CN/en-US language key。

## 非目标

- 不升级 project version，不改成真正 zero-shot。
- 不改变旧 project v1–v5 往返和既有四模板行为。
- 不做 9:16、时间轴、导出能力或旁支重构。
- 不运行 `test:full`，不更新固定 App，不 push/PR，不修改稳定预览指针。

## 证据与现状

- 代码：已新增 `makeNeutralShot` / `makeBlankScene` 纯工厂、独立空白入口、双语文案与定向断言；既有四模板数组不变。
- Git：独立 Worktree，HEAD 精确为 a66a03f4efcfa534d4540fe2c71da69ad4cf2532，分支为 feat/02.8-blank-scene-neutral-shot，创建分支前工作区 clean。
- 测试/运行：Node v24.18.0；`npm ci` 成功；`npm run app:status` 显示 contains installed source=yes、exact=no。
- 文档/历史线索：已完整读取任务指定入口文档、ADR-0004、ADR-0005、QA 映射、scope taxonomy 与任务模板；知识库只读核对完成。

## 影响范围

- 模块：camera,history,i18n,layout,project,testing
- 文件：以并行任务声明中的精确清单为限。
- 数据格式：无版本升级；新增场景继续使用 project-v5 既有字段。
- 平台：macOS Electron 开发预览与共享浏览器运行时。

## 风险

- 风险档：R2
- 请求模型：Terra
- 实际模型：不可观察，未验证
- 请求 reasoning：High
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：等待固定 02 派发实现者之外的独立 R2
- 数据：新场景、镜头、history、autosave 和旧 project 往返必须保持确定性与原子性。
- UI/交互：新入口需在模板弹窗和左栏工作流可发现，Undo、保存重开必须实测。
- 安全：capture/export 自动事务占用或拒绝时，project/runtime/history/autosave 必须零写入。
- 发布：只做 NOT INTEGRATED 开发预览；不更新固定 App。

## 验收条件

- [ ] 空白场景无人物、道具、路径、脚本、模板资产、太阳、`templateId`、camera sidecar 和继承的瞬时选择/预览状态。
- [ ] 中性镜头是合法 project-v5，具有确定性的时长/FOV/位置、至少一个 camera point、global lock、静止且无 `syncActor`。
- [ ] 创建后立即可编辑、可保存、可 Undo；成功路径恰好一次 history 与一次 autosave pending/结算。
- [ ] capture/export 自动事务占用或拒绝路径在 `syncScene`/push/load/`markDirty` 前 fail closed，所有相关状态零写入。
- [ ] 旧 project v1–v5 往返与既有四模板行为不变。
- [ ] zh-CN/en-US language key 同步，运行时不新增直接中文用户文案。
- [ ] 相关最小自动测试通过，未运行 `test:full`。
- [ ] 隔离 Electron NOT INTEGRATED 预览完成模板入口、空内容、一镜可编辑、Undo、保存重开检查。
- [ ] 实现者之外的独立只读 R2 reviewer 已完成，阻塞问题已关闭。
- [ ] 固定 App 交付不适用：本任务只做快速开发预览，由 00 后续集成/交付。
- [ ] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：project,history,camera,layout,i18n,foundation
- 主应用模块参数：project / history / camera / layout
- 最小命令：`npm run test:module -- project`；`npm run test:module -- history`；必要时 camera/layout；`npm run test:i18n`；Node24 `测试/回归/U4_normalize_malformed.mjs`；`npm run test:foundation`；`npm run build`；`git diff --check`
- 升级到全量的条件：禁止运行 full；若 `test:impact` 映射升级 full，停止并记录，不修改 impact map。
- 人工检查尺寸/步骤：隔离 userData/profile 的 Electron 开发预览，标题 `PreVision 02.8 Preview — NOT INTEGRATED`；检查模板弹窗入口、创建后空内容/无模板资产/一镜可编辑、Undo 恢复、保存重开。
- 固定 App 交付：不适用；不得触碰 `~/Applications/PreVision.app`。

## 实施记录

- 假设：结构渲染器所需的中性底座可存在于运行时，但不得作为用户场景模板/自定义资产写入 project。
- 关键决定：以纯工厂边界承载空白 scene/shot 确定性；拒绝路径先于任何项目写入。
- 实际修改：纯工厂生成一个 5 秒、FOV 40、全局锁、单安全机位的中性镜头，以及无 actors/templateId/script/bg/自定义地面资产的空白场景；新建场景弹窗首项提供独立空白入口，创建后进入镜头层并只调用一次 `markDirty()`。
- R2 P2 返修：独立 reviewer 对 `ae4cbd7f596d3a6a463347a371af9bafa51b1ff7` 指出 `newBlankScene()` 未清理上一场景 `previewCamPt`、`previewActorPoint` 与 `previewActorPoints`。旧生成产物上的真实 camera+actor 组合预览用例稳定失败；结论不是误报。
- 最小修复：保持 capture guard 为首行，在 `syncScene()` 和新场景装载前复用既有 `clearPointPreview()`；未复制状态逻辑，capture busy 拒绝路径仍零写入。
- R2 回归：把真实 point-preview 行为断言放入既有 project 模块段，先建立旧摄影机点和角色调度点组合预览，再验证创建后为 `null` / `null` / `0`；同时验证一次 history/autosave 与一次 Undo。
- 中断/恢复：无；沿用同一 task/thread/reservation。
- app-server 通知消费：后台 turn 已 started；外部 owner 持续消费，不作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci`（Node 24.18.0） | 通过 | 10s | 新 Worktree 安装锁定依赖；未修改 package-lock |
| `npm run app:status`（Node 24.18.0） | 通过 | <1s | installed=`b8da5f4…`；current=`a66a03f…`；contains=yes；exact=no |
| `npm run task:status`（Node 24.18.0） | 失败 | 30s | `spawnSync git ENOBUFS`；未据此推断 registry 状态 |
| `task:claim`（Node 24.18.0，已批准 64MiB 非落盘 wrapper） | 通过 | 48s | 协调脚本 SHA-256 已核对；1/2 write slots；ACTIVE/BACKGROUND_ONLY |
| `npm run test:module -- project`（Node 24.18.0） | 通过 | 约 60s | 113 通过，0 失败 |
| `npm run test:module -- history`（Node 24.18.0） | 通过 | 约 38s | 29 通过，0 失败 |
| `npm run test:i18n`（Node 24.18.0） | 通过 | <1s | 217 通过，0 失败 |
| `npm run build`（Node 24.18.0） | 通过 | <1s | 生成单文件 HTML |
| `git diff --check` | 通过 | <1s | 无空白错误 |
| 隔离 Electron 开发预览 | 部分通过 | — | 独立 profile、标题 `PreVision 02.8 Preview — NOT INTEGRATED` 与初始窗口已真实可见；入口/创建/一镜可编辑/Undo/保存重开尚未由真实 UI 交互确认，不记 PASS |
| R2 P2 故障注入：旧生成产物 `npm run test:module -- project`（Node 24.18.0） | 预期失败 | 约 57s | 117 通过，1 失败；唯一失败为新空白场景未清旧 point-preview |
| R2 P2 `npm run build`（Node 24.18.0） | 通过 | <1s | 单行修复已进入生成文件 |
| R2 P2 `npm run test:module -- project`（Node 24.18.0） | 通过 | 约 57s | 121 通过，0 失败；camera/actor preview、history/autosave 与 Undo 同时通过 |
| R2 P2 `npm run test:module -- history`（Node 24.18.0） | 通过 | 约 17s | 29 通过，0 失败 |
| R2 P2 `npm run test:i18n`（Node 24.18.0） | 通过 | <1s | 217 通过，0 失败 |
| R2 P2 `git diff --check` | 通过 | <1s | 无空白错误 |

固定 App installed source：b8da5f4f36a40010541700171cb246f2ca9de17b

固定 App 人工启动结果：未运行；本任务不更新、不启动固定 App。

## 未覆盖与后续

- 真实 UI 的入口、创建、一镜可编辑、Undo 和保存重开仍待用户在已打开的隔离窗口确认；更广验证、stop verification 与独立 R2 后置。

## 交接

- 最终提交：待本轮提交后填写
- PR：无
- reviewer 结论：首轮独立 R2 为 FAIL（P2 point-preview 残留）；最小返修与旧红/新绿证据已完成，等待同一独立 R2 复审
- 生命周期交接：ACTIVE
- 工作区状态：实现与验收单待提交；claim 已持久化
- 下一步：提交聚焦返修，持久化 stop verification 后重新进入 REVIEW，交还 `02-independent-r2-reviewer`。
