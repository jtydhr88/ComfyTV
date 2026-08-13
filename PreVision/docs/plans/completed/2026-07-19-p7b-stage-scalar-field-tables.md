# 任务：P7b 标量字段表等价改写

- 状态：completed
- 日期：2026-07-19
- 对话：P7b｜标量字段表等价改写
- 分支：chore/p7b-stage-scalar-field-tables
- 基线：0178240bb6f4d2fb51c210311e3d279df7f11f0b
- 固定 App 来源：installed `7ff9aa583b4e51fb4d888aa1815792b747d275d7`；预提交 current 为 baseline；提交后 current 为本实现提交（见交接消息）；contains=yes；exact=no
- 负责人：worker:04.p7b-stage-scalar-field-tables

## 并行任务声明

- 任务 ID：04.p7b-stage-scalar-field-tables
- 模式：write
- 分管 owner：04
- 模块：actor,camera,timeline,playback,project,testing,repository
- UI 表面：无
- 数据区域：project-v5,shot-camera,object-paths,qa-metadata
- 预计修改文件：src/core/project-data.js, src/stage/runtime.js, 预见PreVision.html, 测试/回归/C1_previz_roundtrip.mjs, 测试/回归/U4_normalize_malformed.mjs, docs/decisions/0014-stage-scalar-field-tables.md, docs/decisions/README.md, docs/plans/active/2026-07-19-p7b-stage-scalar-field-tables.md
- reservation：已预留并转换为 active claim（token 不提交）
- reserve request key：已核对/已去敏
- 协调登记：schema v3；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:04.p7b-stage-scalar-field-tables / worker:04.p7b-stage-scalar-field-tables
- 状态更新时间 / 原因：2026-07-18T19:51:33.067Z；从 canonical WAITING reservation 正式开工
- 侧栏去重证据：task id 已核对；client id / thread id 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：任一证据缺失/失败/未知，不能宣称 live
- WAITING checkpoint：已完成；本任务已从 WAITING reservation 转 ACTIVE
- turn stop verification：未完成
- 失败补偿：无
- `task:check` 结果：未运行；claim 转换时无硬冲突
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：不适用
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

在 P7a 舞台运行时搬迁之后，进行 P7b 标量字段表等价改写：在 `core/project-data.js` 定义供应商中立的 actor/shot 标量字段表，并让 normalize、runtime build/data 和 loadScene shot 重建消费同一描述表，同时保持 project v5、golden、键序、精度、依赖方向和产品行为不变。

## 目标

- 在 `src/core/project-data.js` export 纯数据 `ACTOR_FIELDS` / `SHOT_FIELDS`。
- `src/stage/runtime.js` 真 import 字段表，并在 `buildActor`、`stageToData`、`loadScene` shot 重建中消费表。
- `normalizeProjectActor` / `normalizeProjectShot` 消费同一字段表，但保持现有键序、默认值、精度和不可信输入白名单语义。
- C1 直接 import 字段表，增加表键唯一性、复杂字段禁区、手写白名单互斥和 golden 键覆盖断言。
- 新增 ADR-0014 并同步 ADR 索引。

## 非目标

- 不做 P8/P9、UI、i18n 文案、固定 App 交付或中央集成。
- 不新增依赖、不改 schema/version、不改 product behavior。
- 不把复杂字段偷带进表：actor pos/path/pathTimes/pathEase、mount、joints/rig、semanticType+dimensions、asset、terrainVersion、timeLinkShot、运行时 pathPts/Three/挂载骑乘；shot cam/camAim、times/ease、camPts/camKeys 继续手写。
- 不新增 globalThis bridge/exposure，不建立 core -> stage 或 factory/environment -> runtime 回边。
- 不修改 golden、run_all、冒烟测试、locale、qa/test-impact-map、package/lock、build/census 脚本或 src/app.js。

## 证据与现状

- 代码：P7a 已有 `src/stage/runtime.js`；ADR-0013 明确 core 不得 import stage，factory/environment 不得 import runtime。
- Git：开工前 HEAD 为 0178240bb6f4d2fb51c210311e3d279df7f11f0b，工作树 clean。
- 测试/运行：WAITING checkpoint 已完成；fresh Worktree 缺 `node_modules/@electron/asar`，Node 24 `app:status` 需在 `npm ci` 后重跑。
- 文档/历史线索：Obsidian 架构地图、拆分方案、开发手册和回归测试清单均提示 P7 字段表是高风险阶段，C1/C2 字节级不变和 U4 malformed normalize 是硬裁判。

## 影响范围

- 模块：actor,camera,timeline,playback,project,testing,repository
- 文件：见并行任务声明
- 数据格式：无；project v5 键、值、精度、顺序必须等价
- 平台：Node 24 测试；固定 App 不交付

## 风险

- 风险档：R3
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：XHigh
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：范围升至数据/安全
- 独立只读 reviewer：待 04 组织 R3
- 数据：最高风险；normalize/stageToData 键序和字段精度不得漂移
- UI/交互：无 UI 表面变更
- 安全：不枚举/spread 不可信输入；危险键不得穿透
- 发布：不涉及固定 App 或对外发布

## 验收条件

- [x] `ACTOR_FIELDS` 精确覆盖 kind,label,pose,rotY,height,scale,pathMode,timeLink,timeOffset。
- [x] `SHOT_FIELDS` 精确覆盖 name,desc,dur,lock,fov,camMode,timingMode,syncActor,yaw,pitch。
- [x] normalize、buildActor、stageToData、loadScene shot 重建实际消费字段表，并保持各 phase 独立 adapter/order。
- [x] 复杂字段保持显式手写，没有进入字段表。
- [x] C1/C2 golden 字节级不变，golden 文件无 diff。
- [x] 相关自动测试通过。
- [x] V1 记录既有真机 GPU SKIP，不冒充通过。
- [ ] 实现者之外的独立只读 reviewer 已完成，阻塞问题已关闭。
- [x] 固定 App 交付不适用：本任务不更新 `~/Applications/PreVision.app`。
- [x] 文档和 ADR 索引已更新。

## 测试计划

- 影响映射模块：actor,camera,project,timeline,playback,foundation
- 主应用模块参数：actor / camera / project / timeline / playback
- 最小命令：Node 24 下 C1、C2、U4、run_all、目标 module 测试、test:app、test:i18n、test:foundation、test:impact
- 升级到全量的条件：本任务必须执行 `npm run test:full`
- 人工检查尺寸/步骤：V1 真机 GPU 仅记录 SKIP
- 固定 App 交付：不适用；目标路径固定为 `~/Applications/PreVision.app`

## 实施记录

- 假设：字段表只表达归一化后必有标量，不承载 stage/THREE/runtime 闭包。
- 关键决定：字段表公开 key 顺序保持 P7b 指定顺序；normalize 使用 `normalizePhase`/`normalizeOrder` 分段遍历,保留 baseline 首错优先级；runtime/data/loadScene 各自使用 phase-specific adapter 生成 scalar map,输出对象仍显式保持旧键序。
- 实际修改：`src/core/project-data.js` 新增纯数据 `ACTOR_FIELDS`/`SHOT_FIELDS` 和 normalize scalar helper；`src/stage/runtime.js` import 字段表并让 buildActor、stageToData actor/shot、loadScene shot 重建遍历字段表；C1 直接 import 字段表做 key/白名单/golden 覆盖护栏；U4 增加 actor/shot 多缺陷首错优先级 probe；新增 ADR-0014 并同步索引；根 HTML 由 `npm run build` 生成。
- 中断/恢复：Node 26 环境曾触发 `test:impact` 内 Web 压力工装版本失败,该结果仅记为环境失败、不计验收；最终证据全部使用 bundled Node 24.14.0。
- app-server 通知消费：后台 turn 已 started；不得作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `git rev-parse HEAD` | 0178240bb6f4d2fb51c210311e3d279df7f11f0b | <1s | 开工前 |
| `git status --short --branch` | clean, detached HEAD | <1s | 开工前 |
| `npm run task:claim -- --reservation ...` | CLAIMED FROM RESERVATION | 9s | Node 24；token 去敏 |
| `export PATH="<bundled-node-24>/bin:$PATH"; node -v; npm -v` | v24.14.0 / 11.16.0 | <1s | 最终验收 Node；本机绝对路径不提交 |
| `npm ci` | pass | 1m | fresh Worktree 缺依赖后执行；package/lock 无 diff |
| `npm run app:status` | pass | <1s | 预提交:installed `7ff9aa583b4e51fb4d888aa1815792b747d275d7`; current baseline; contains=yes; exact=no。提交后 current 为本实现提交,交接消息报告精确 hash |
| `npm run build` x2 + SHA-256 | pass | <1s | `599a8bd4ba847447cdb826b9de8f3c037ff6e28d7fd2e55a5ea2e4f30b6a1575`; size 1151075; 双跑一致 |
| `node 测试/回归/C1_previz_roundtrip.mjs` | 42 通过, 0 失败 | <1s | Node typeless ESM warning; 未改 package |
| `node 测试/回归/C2_legacy_migration.mjs` | 18 通过, 0 失败 | <1s |  |
| `node 测试/回归/U4_normalize_malformed.mjs` | 37 通过, 0 失败 | <1s | 含 actor/shot 多缺陷首错优先级 probe |
| `node 测试/回归/run_all.mjs` | 全部通过; V1 SKIP | 4s | V1 为既有真机 Electron+GPU SKIP |
| `npm run test:module -- actor` | 147 通过, 0 失败 | 21s | 合成 capture cleanup warning 为既有测试路径 |
| `npm run test:module -- camera` | 84 通过, 0 失败 | 21s | 同上 |
| `npm run test:module -- project` | 112 通过, 0 失败 | 24s | 同上 |
| `npm run test:module -- timeline` | 124 通过, 0 失败 | 15s | 同上 |
| `npm run test:module -- playback` | 32 通过, 0 失败 | 15s | 同上 |
| `npm run test:app` | 968 通过, 0 失败 | 33s | 合成 warning 为既有测试路径 |
| `npm run test:i18n` | 21 passed, 0 failed | <1s |  |
| `npm run test:foundation` | pass | 60s | 仓库基础 151/0; C8 11/0; coordination 553/0; i18n 21/0; wrapper 11/0 |
| `npm run test:impact -- --base 0178240bb6f4d2fb51c210311e3d279df7f11f0b` | pass | 146s | 8 changed files; 自动升级 `npm run test:full` 并通过 |
| `npm run test:full` | pass | 134s | 显式 full: app/project-input/web/desktop/local-install/foundation 全通过 |
| `node scripts/census-functions.mjs --ref 0178240bb6f4d2fb51c210311e3d279df7f11f0b` | diagnostic diff | <1s | 484 -> 491; 新增真实 helper: actorDataScalars, normalizeProjectScalarField, normalizeProjectScalars, projectScalarSource, scalarMap, shotDataScalars, shotRuntimeScalars |
| `rg -o "refresh\\.register\\(" 预见PreVision.html \| wc -l` | 22 | <1s | RefreshHub 计数不变 |
| `git diff --check` | pass | <1s | 无输出 |
| forbidden diff 检查 | pass | <1s | package/lock、qa/golden、qa/test-impact-map、build/census 脚本、run_all、i18n、src/app.js 无 diff |
| 敏感信息/绝对路径扫描 | pass | <1s | 无 token/canonical id/绝对路径/私钥命中 |
| `npm run task:status` | ACTIVE claim present | 9s | 本任务唯一 active write claim; visibility=BACKGROUND_ONLY |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用

## 未覆盖与后续

- 独立 R3 reviewer 由 04 在实现提交后组织。
- 固定 App 交付、中央 release 与归档由 00/04 后续处理。

## 交接

- 最终提交：本实现提交（自身 hash 不写入本提交；交接消息报告 baseline..HEAD）
- PR：无
- reviewer 结论：未评审
- 生命周期交接：ACTIVE（保持 claim）
- 工作区状态：提交后应为 clean
- 下一步：创建单一实现提交后等待 04 组织独立 R3
