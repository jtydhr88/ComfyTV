# 任务：02.11｜导演台高识别人物代理

- 状态：completed
- 日期：2026-07-29
- 对话：02.11｜导演台高识别人物代理
- 分支：feat/02.11-director-proxy-characters
- 基线：f0cfdf9191a495c83510116ee483137ef7ce1557
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`；当前任务基线包含该来源但不与之完全相同
- 负责人：worker:02.11-director-proxy-characters

## 并行任务声明

- 任务 ID：02.11-director-proxy-characters
- 模式：write
- 分管 owner：02
- 模块：actor, history, i18n, layout, project, testing
- UI 表面：inspector, monitor, viewport
- 数据区域：actor-rig, autosave, i18n-resources, project-v5, qa-metadata, scene-template
- 预计修改文件：app-shell.html；docs/ARCHITECTURE.md；docs/CURRENT_STATE.md；docs/FEATURE_REGISTRY.md；本 active/completed 验收单与 completed/README.md；docs/qa/director-proxy-characters/；i18n/locales/en-US.js；i18n/locales/zh-CN.js；qa/feature-registry.yaml；qa/semantic-proxy-catalog.json；src/core/project-data.js；src/stage/factory.js；src/stage/runtime.js；src/ui/inspector.js；测试/冒烟测试.mjs；测试/回归/C1_previz_roundtrip.mjs；测试/回归/U4_normalize_malformed.mjs；预见PreVision.html
- reservation：已预留；reservation id 已核对，token 未落盘
- reserve request key：已核对/已去敏
- 协调登记：schema v3 revision=2860504a-fbb7-41b2-adf7-171b166897cc；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:02.11-director-proxy-characters / worker:02.11-director-proxy-characters
- 状态更新时间 / 原因：2026-07-29T04:11:39Z；canonical background worker turn 已启动，reservation 已原子转换为 claim
- 侧栏去重证据：task id、client id、thread id 已在本机核对/已去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用
- WAITING checkpoint：不适用
- turn stop verification：未完成
- 失败补偿：无
- `task:check` 结果：固定 02 已完成，无冲突
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：不适用；等待独立 reviewer 后由后续流程处理
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

把旧巫师入口和装饰替换为导演台高识别人物代理：模型库直接提供男人、女人、小朋友三类低面数角色，强化精确主色、正面方向、主要关节和真实尺寸，同时安全消费 v1-v5 legacy wizard 数据且不改变 project v5 schema。

## 目标

- 男人、女人、小朋友使用精确主色和明确的低面数体型比例，在导演台、monitor、截图/视频共用的 stage 模型中一眼可区分。
- 肩、肘、腕、髋、膝、踝以及眼、眉、鼻、嘴、耳具有远景可读的几何层级、命名和父级。
- legacy wizard 归一化为 adult_male 视觉和数据语义，保留演员数据、路径、姿态、关节、挂载、资产和合法尺寸，保存后不再写 `characterStyle:'wizard'`。
- 无 semanticType 的普通旧 char 运行时默认成人男性蓝色，但不为视觉默认静默回写 semanticType。
- 建立真实 Three geometry bounds oracle、项目往返/Undo/自动保存回归和隔离 Electron 双尺寸证据。

## 非目标

- 不新增 project schema，不升级 project v5。
- 不追求真实皮肤、服装或头发，不用裙子、长发等刻板符号区分性别。
- 不另造 monitor、截图或视频导出模型。
- 不运行 `test:impact`、`test:full` 或 `app:deliver`；不更新固定 App、稳定预览指针、GitHub、Pages。

## 证据与现状

- 代码：三类人物已共用高识别低面数 rig；legacy wizard 已收敛为输入兼容适配器，当前保存与渲染不再建立帽、袍、杖。
- Git：从精确基线 `f0cfdf9191a495c83510116ee483137ef7ce1557` 创建任务分支，全部变化保持在 immutable scope。
- 测试/运行：Node 24.18.0；`npm ci` 后 `app:status` 通过，任务基线包含固定 App 来源；固定 App 未更新。
- 文档/历史线索：SCN-008/SCN-009 记录语义代理和 fallback wizard foundation；本任务替代 wizard 产品入口和装饰语义。

## 影响范围

- 模块：actor, history, i18n, layout, project, testing
- 文件：仅限 claim 的 immutable file scope
- 数据格式：有兼容语义变化，但维持 project v5；legacy wizard 保存时移除 `characterStyle`
- 平台：macOS Electron 快速隔离预览；浏览器 stage 代码共用

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：gpt-5.6-sol
- 请求 reasoning：XHigh
- 实际 selected reasoning：xhigh
- Fast/priority：开启（快速预览节奏）
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：由固定 02 在 REVIEW 后组织 R2，本实现者不自审
- 数据：legacy wizard、无 semanticType char、mount/path/pose/joints/autosave/history 必须零丢失。
- UI/交互：三按钮在 1316×768 不挤压；1440×900 三类角色和朝向/关节必须清楚。
- 安全：不触及 IPC、凭据、外部服务。
- 发布：NOT INTEGRATED；固定 App 和公开发布均禁止。

## 验收条件

- [x] 模型库只有男人、女人、小朋友三个直接角色按钮，无 wizard 入口、装饰或运行时文案。
- [x] 三类精确主色分别为 `#2F6BFF`、`#F0445E`、`#FFD43B`，真实 Three geometry bounds 约为 1.78m、1.66m、1.2m。
- [x] 主要关节和五官具备可断言的命名/父级并在远景保持方向读数。
- [x] legacy wizard 保存重开/Undo 后路径、pose、joints、mount、asset 等字段零丢失，保存结果移除 `characterStyle`。
- [x] 普通无 semanticType char 往返不被静默补写 semanticType。
- [x] actor/project/history/i18n、C1、本任务 U4 cases、build、diff-check 通过；U4 全文件仅 case 26 的 2 项既有时长失败，并已在精确基线独立复现。
- [x] 1440×900 与 1316×768 隔离 Electron 人工验证和真实截图证据完成。
- [ ] 实现者之外的独立只读 R2 reviewer 已完成，阻塞问题已关闭。
- [ ] 固定 App 交付不适用：本任务是 NOT INTEGRATED 快速预览。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：actor, project, history, i18n, layout
- 主应用模块参数：actor, project, history
- 最小命令：`npm run test:module -- actor`；`npm run test:module -- project`；`npm run test:module -- history`；`npm run test:i18n`；必要的 C1/U4；`npm run build`；`git diff --check`
- 升级到全量的条件：本任务明确禁止 `test:impact`/`test:full`；发现 scope 外影响立即停在 scope gate 回报固定 02
- 人工检查尺寸/步骤：隔离 Electron 1440×900 三角色并排正/侧/3⁄4与不同姿势；1316×768 检查模型库按钮；director viewport 与 monitor 一眼分色
- 固定 App 交付：不适用；不得更新 `~/Applications/PreVision.app`

## 实施记录

- 假设：复用现有 semanticType，不新增 schema；同一 stage 对象自然覆盖 live viewport、monitor 与捕获输出。
- 关键决定：主色覆盖头、躯干、四肢；白/深色只用于五官、朝向和关节标记。人物基础几何在工厂中以真实 `Box3` 归一化，而非只信 catalog 常量。
- 实际修改：
  - 删除巫师产品入口和帽/袍/杖建模分支，增加男人、女人、小朋友三个 direct add 按钮和双语 language key。
  - 重做人物低面数共享 rig，增加正面 marker、放大五官，并为肩肘腕/髋膝踝提供命名球体/环形标记。
  - 保留用户 `scale` 与独立 `dimensions` 的组合语义；真实 bounds 分别约 1.78m、1.66m、1.2m。
  - 归一化边界把 legacy wizard 迁移为 `adult_male` 并丢弃 `characterStyle`；普通旧 char 仅运行时蓝色 fallback，不回写 semanticType。
  - 补齐 autosave/history/Undo、C1/U4、危险未知 semanticType、材质/层级/bounds 和 direct-button 回归。
  - 更新架构、当前状态、功能登记、语义 catalog 与双尺寸 Electron QA 证据。
- 中断/恢复：无
- app-server 通知消费：当前后台 turn 进行中；最终以独立 stop verification 为准，不作为 Desktop live 证据

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status`（首次） | FAIL | <1s | 缺少 `@electron/asar`；claim 后 `npm ci` 再补跑 |
| `npm ci` | PASS | 约 2s | Node 24；安装 506 packages |
| `npm run app:status` | PASS | <1s | installed source `b8da5f4...`；contains=yes；exact=no；未更新固定 App |
| Node 24 非落盘 64MiB wrapper `task:claim` | PASS | 约 145s | revision `2860504a-fbb7-41b2-adf7-171b166897cc`；ACTIVE/BACKGROUND_ONLY |
| `npm run test:module -- actor` | PASS | 约 75s | 177 通过，0 失败 |
| `npm run test:module -- project` | PASS | 约 95s | 121 通过，0 失败 |
| `npm run test:module -- history` | PASS | 约 60s | 29 通过，0 失败 |
| `npm run test:module -- layout` | PASS | 约 110s | 160 通过，0 失败 |
| `npm run test:i18n` | PASS | <1s | 217 通过，0 失败 |
| `node 测试/回归/C1_previz_roundtrip.mjs` | PASS | <1s | 52 通过，0 失败 |
| `node 测试/回归/U4_normalize_malformed.mjs` | BASELINE FAIL | <1s | 112 通过，2 失败；本任务 wizard case 通过，2 项均为 case 26 时长边界，精确基线 archive 同样 112/2 |
| `npm run build` | PASS | <1s | 生成 `预见PreVision.html` |
| QA/registry JSON 解析 | PASS | <1s | 3 个 metadata 文件均可解析 |
| Electron 1440×900 | PASS | 手工 | 三角色正面/侧面/3⁄4、stand/crouch/sit；viewport 与 monitor 同时一眼分色 |
| Electron 1316×768 | PASS | 手工 | 三按钮均为 139×34px；右栏 302/302，无横向溢出 |
| `git diff --check` | PASS | <1s | 无 whitespace error |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：不适用；本轮禁止固定 App 交付。

## 未覆盖与后续

- 独立 R2、中央集成、最终回归和固定 App 交付均后置。

## 交接

- 最终提交：本验收单所在任务提交；以任务分支 Git HEAD 为准
- PR：无；本轮禁止 GitHub 写入
- reviewer 结论：未评审
- 生命周期交接：完成本轮 stop verification 后转 REVIEW，保持 claim
- 工作区状态：实现、定向验证和双尺寸真实 Electron 证据已完成；本验收单随任务提交冻结，提交后工作区应 clean
- 下一步：固定 02 组织实现者之外的独立 R2；本实现者不自审、不 release、不 archive。
