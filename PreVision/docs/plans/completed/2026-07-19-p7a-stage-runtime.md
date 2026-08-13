# 任务：P7a｜F+J->runtime 纯搬运｜测试范围修正版

- 状态：completed
- 日期：2026-07-19
- 对话：P7a stage/runtime corrected background worker
- 分支：chore/p7a-stage-runtime-test-corrected
- 基线：b89556243f7ea38a1982edaf809f44a1701c3254
- 固定 App 来源：installed source `7ff9aa583b4e51fb4d888aa1815792b747d275d7`；current source `b89556243f7ea38a1982edaf809f44a1701c3254`；contains installed source yes；exact installed source no
- 负责人：worker:04.p7a-stage-runtime-test-corrected

## 并行任务声明

- 任务 ID：04.p7a-stage-runtime-test-corrected
- 模式：write
- 分管 owner：04
- 模块：actor,camera,timeline,playback,project,viewport,background,lighting,repository,i18n
- UI 表面：viewport,canvas-controls,timeline,monitor,inspector
- 数据区域：project-v5,shot-camera,object-paths,actor-rig,i18n-resources
- 预计修改文件：src/app.js, src/core/project-data.js, src/stage/runtime.js, src/stage/factory.js, src/stage/environment.js, src/export/prompt.js, src/features/storyboard.js, i18n/locales/zh-CN.js, i18n/locales/en-US.js, 预见PreVision.html, 测试/冒烟测试.mjs, docs/decisions/0013-stage-runtime-module.md, docs/decisions/README.md, docs/plans/active/2026-07-19-p7a-stage-runtime.md, docs/plans/completed/2026-07-19-p7a-stage-runtime.md, docs/plans/completed/README.md
- reservation：已预留；reservation token 已在本 turn 核对，未落盘
- reserve request key：固定 04 已生成；本 worker 未接触明文 request key
- 协调登记：schema v3；status 已核对存在 WAITING reservation
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:04.p7a-stage-runtime-test-corrected / worker:04.p7a-stage-runtime-test-corrected
- 状态更新时间 / 原因：2026-07-18T18:47:23Z；第三次 P7a corrected scope 后台施工 turn 正式开工
- 侧栏去重证据：task id 已核对；canonical client/thread 已核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；本轮不宣称 Desktop live
- WAITING checkpoint：已完成；fresh checkpoint 确认 cwd、detached HEAD、clean、registry WAITING
- turn stop verification：未完成
- 失败补偿：无
- `task:check` 结果：未运行；固定 04 已完成 reservation
- `task:claim --reservation`：已从 reservation 原子转换为 ACTIVE write claim；明文 token 未落盘
- REVIEW commit list：未冻结
- 机械 closeout：不适用
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

第三次 P7a 测试范围修正版：从当前 clean baseline 独立实施 F+J 到 `src/stage/runtime.js` 的纯搬运，修正调用期 bridge、两项 i18n 文案和一条 smoke regex，不访问或复用已取消 P7a worktree 草稿。

## 目标

- 将 F 精确边界和 J 精确边界搬入 `src/stage/runtime.js`，函数集合和行为保持不变。
- 只做 P7a，不提前做 P7b/P8/P9，不做字段表改写。
- 保持 C1/C2 输出字节级不变，project v5、默认值、键序、精度和错误语义不变。
- 用 corrected scope 的调用期 bridge 解除运行时互相依赖，不引入 core->stage、factory/environment->runtime 真 import 或循环。
- 将 `运行错误:` 和 copyActorPathToCamera 成功提示迁入 language key，中文显示和插值逐字不变。
- 增加 ADR-0013 和索引，记录边界、9 个显式调用期访问、无 cycle、两项 i18n 偏差、测试语义修正与回滚。

## 非目标

- 不做 P7 字段表、ACTOR_FIELDS/SHOT_FIELDS、normalizeProjectActor/Shot 改写或字段覆盖率测试。
- 不改 qa/golden/**、build/census 工具、package.json、package-lock.json、qa/test-impact-map.yaml。
- 不运行 app:deliver，不中央合并，不 release，不更新固定 App。
- 不访问、复制、参考或复用已取消 P7a worktree 的未提交草稿，包括旧 d36d 与 ca9e worktree。

## 证据与现状

- 代码：当前 baseline 为 `b89556243f7ea38a1982edaf809f44a1701c3254`。
- Git：从精确 baseline 创建 `chore/p7a-stage-runtime-test-corrected`，开工前工作树 clean。
- 测试/运行：已使用 bundled Node 24.14.0；`npm ci` 仅因缺少 `node_modules` 执行，lockfile 不应变化；`npm run app:status` 已执行。
- 文档/历史线索：已读取 AGENTS、入口文档、ADR-0006~0012、Obsidian 预见拆分与回归相关笔记；Mirror 只读未写入。

## 影响范围

- 模块：actor,camera,timeline,playback,project,viewport,background,lighting,repository,i18n
- 文件：见并行任务声明。
- 数据格式：无预期变化；C1/C2 字节级不变。
- 平台：浏览器/Electron 共享构建产物；不交付固定 App。

## 风险

- 风险档：R3
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：XHigh
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：固定 04 后续组织 R3 reviewer
- 数据：P7a 触碰 `project-v5`、actor runtime 和 stageToData，需要 C1/C2/impact/full 兜底。
- UI/交互：RefreshHub 注册数必须保持 app 21 + prompt 1 = 22；UI mutable state 留守 app。
- 安全：不扩大 Electron/preload/desktop 桥面，不新增依赖。
- 发布：不执行 `app:deliver`。

## 验收条件

- [x] F/J 精确边界和指定 helper 搬入 `src/stage/runtime.js`，留 app 清单保持留守。
- [x] corrected scope 的调用期 bridge 按清单完成，且无新增循环依赖。
- [x] `src/app.js` 两条指定分区注释改为英文 ASCII；`src/stage/runtime.js` 无裸汉字。
- [x] 新增两个 language key，zh-CN/en-US 同步，中文显示和插值逐字不变。
- [x] smoke regex 只增强 clearStage 起始匹配的空白容忍，继续验证 `disposeOwnedObject3D(a.obj)` 关系。
- [x] ADR-0013 与索引完成。
- [x] 相关自动测试通过。
- [ ] 实现者之外的独立只读 reviewer 已完成，阻塞问题已关闭。
- [ ] 固定 App 交付不适用；本任务不运行 `app:deliver`。

## 测试计划

- 影响映射模块：actor,camera,project,timeline,playback,background,lighting,viewport,i18n,foundation,app
- 主应用模块参数：actor / camera / project / timeline / playback / background / lighting / viewport
- 最小命令：`npm run build`，C1/C2/run_all，模块测试，`test:app`，`test:i18n`，`test:foundation`
- 升级到全量的条件：本任务默认执行 `npm run test:full` 与 `npm run test:impact -- --base "$BASE"`
- 人工检查尺寸/步骤：不涉及 UI 视觉交付；通过自动回归和 reviewer 复核。
- 固定 App 交付：不适用；目标路径固定为 `~/Applications/PreVision.app`

## 实施记录

- 假设：本任务只允许从当前 clean baseline 独立实施；旧取消 worktree 草稿不作为输入。
- 关键决定：P7a 只做纯搬运，不执行 P7 字段表改写。
- 实际修改：新增 `src/stage/runtime.js`，将 F+J 边界和 helper 纯搬运；`src/app.js` 通过 runtime import 重新暴露桥名，留守 viewport framing、pose/text、preview mutable state、GROUND_QUICK、timing register 和 UI RefreshHub handler；`factory.js`/`environment.js`/`project-data.js` 使用 9 个显式调用期 `globalThis`；`prompt.js`/`storyboard.js` 使用 runtime 别名真 import；新增两项 i18n key；仅调整 clearStage smoke regex 空白容忍；新增 ADR-0013 与索引。
- 审计修正：等待 impact 完整退出后，仅恢复 `/* ============ 播放系统 ============ */` 基线注释，并从 factory 边界注释留守清单移除已迁走的 `cleanDimensions`/`actorJointsFromData`。
- 中断/恢复：无
- app-server 通知消费：后台施工；不得作为 Desktop live 证据

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status` | 通过 | <1s | installed source `7ff9aa5`；current source `b8955624`；contains yes；exact no |
| `npm run build` + SHA-256 双跑 | 通过 | <1s | 重测最终 hash 均为 `a5dd325327f537bf047810bc4f469790bfd6133587cfba3796bde395dbeed078` |
| `node 测试/回归/C1_previz_roundtrip.mjs` | 通过 | <1s | 13 通过, 0 失败 |
| `node 测试/回归/C2_legacy_migration.mjs` | 通过 | <1s | 18 通过, 0 失败 |
| `node 测试/回归/run_all.mjs` | 通过 | 约4s | C1/C2/C3/C4/C6/U1/U2/U3/U4/U5/C8 全绿；V1 既有真机 Electron+GPU SKIP |
| `npm run test:module -- actor` | 通过 | 约30s | 147 通过, 0 失败 |
| `npm run test:module -- camera` | 通过 | 约30s | 84 通过, 0 失败 |
| `npm run test:module -- project` | 通过 | 约30s | 112 通过, 0 失败 |
| `npm run test:module -- timeline` | 通过 | 约30s | 124 通过, 0 失败 |
| `npm run test:module -- playback` | 通过 | 约30s | 32 通过, 0 失败 |
| `npm run test:module -- background` | 通过 | 约30s | 81 通过, 0 失败 |
| `npm run test:module -- lighting` | 通过 | 约30s | 32 通过, 0 失败 |
| `npm run test:module -- viewport` | 通过 | 约30s | 31 通过, 0 失败 |
| `npm run test:i18n` | 通过 | <1s | 重测最终 21 passed, 0 failed |
| `npm run test:app` | 通过 | 约30s | 重测最终 968 通过, 0 失败 |
| `npm run test:foundation` | 通过 | 约70s | 重测最终含 coordination 553 通过、i18n 21 passed、project-input-wrapper 11 passed |
| `npm run test:full` | 通过 | 约150s | 重测最终 app/project-input/web/desktop/local-install/foundation 全通过 |
| `npm run test:impact -- --base "$BASE"` | 通过 | 163.36s | 14 个变化文件；升级运行 `npm run test:full` 并通过 |
| `node scripts/census-functions.mjs --ref "$BASE"` | 通过 | <1s | 484 -> 484；函数集合差异 0 |
| RefreshHub 计数 | 通过 | <1s | 构建产物 22；app 21；prompt 1 |
| `git diff --check` | 通过 | <1s | 无 whitespace error |
| 禁止路径 diff | 通过 | <1s | `qa/golden/**`、build/census scripts、package/lock、`qa/test-impact-map.yaml` 零变化 |
| 敏感信息/本机绝对路径扫描 | 通过 | <1s | 无真实 secret、reservation token 或本机绝对路径；仅命中既有测试假 token/CSS token 命名 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；本任务不交付固定 App。

## 未覆盖与后续

- 独立 R3 reviewer 尚未执行。
- 不更新固定 App；由 `00` 后续中央集成和交付裁决。

## 交接

- 实现提交：以本验收单进入 REVIEW 时冻结的 baseline..HEAD 有序列表为准
- PR：无
- reviewer 结论：未评审
- 生命周期交接：ACTIVE（保持 claim）
- 工作区状态：提交后复查 clean
- 下一步：本 worker 提交后交给固定 04 组织独立只读 R3 reviewer。
