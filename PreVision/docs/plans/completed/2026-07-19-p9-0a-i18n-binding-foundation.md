# 任务：P9-0a 国际化绑定溯源基础

- 状态：completed
- 日期：2026-07-19
- 对话：P9-0a｜国际化绑定溯源基础（后台施工）
- 分支：test/p9-0a-i18n-binding-foundation
- 基线：1fae3e6ff4205e5ec052ed8ec56b2ba9fa947cd5
- 固定 App 来源：installed source `7ff9aa583b4e51fb4d888aa1815792b747d275d7`；current source `1fae3e6ff4205e5ec052ed8ec56b2ba9fa947cd5`；Contains installed source: yes；Exact installed source: no；本任务不更新固定 App。
- 负责人：worker:04.p9-0a-i18n-binding-foundation

## 并行任务声明

- 任务 ID：04.p9-0a-i18n-binding-foundation
- 模式：write
- 分管 owner：04
- 模块：testing,i18n,repository
- UI 表面：无
- 数据区域：qa-metadata
- 预计修改文件：
  - `测试/国际化测试.mjs`
  - `docs/TEST_STRATEGY.md`
  - `docs/plans/active/2026-07-19-p9-0a-i18n-binding-foundation.md`
  - `docs/plans/completed/2026-07-19-p9-0a-i18n-binding-foundation.md`（仅为 reviewer PASS 后机械 closeout 预声明，本轮不得创建）
  - `docs/plans/completed/README.md`（仅为 reviewer PASS 后机械 closeout 预声明，本轮不得改）
  - `docs/decisions/0016-i18n-binding-provenance-analyzer.md`
  - `docs/decisions/README.md`
- reservation：已预留（token 已核对，未写入仓库）
- reserve request key：由 04 生成并已去敏；未在仓库记录明文
- 协调登记：schema v3；claim 前 `task:status` 显示 1 个 active reservation，无 active claim；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:04.p9-0a-i18n-binding-foundation / worker:04.p9-0a-i18n-binding-foundation
- 状态更新时间 / 原因：2026-07-19T12:54:37+0800；同一 canonical 后台临时工收到 04 正式开工单，开始 fresh bounded analyzer-foundation turn
- 侧栏去重证据：canonical task/client/thread 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；后台施工不得宣称 Desktop live
- WAITING checkpoint：已完成；WAITING / 等待 04 正式开工单，且读取到 `turn/completed`
- turn stop verification：未完成；本轮不得自行进入 REVIEW/HANDED_OFF
- 失败补偿：无；claim 失败则停止并原样回报，不取消 reservation、不建副本
- `task:check` 结果：04 交接证据显示 reserve 前已用 exact scope 从 fresh baseline 运行并得到 No hard conflicts；本临时工未重复执行
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：不适用；reviewer PASS 后才可 sole-parent closeout
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

04 正式开工 P9-0a：在 fresh central baseline 上为国际化测试建立绑定溯源分析基础，先冻结 threat model，再实现 analyzer 与自动变异矩阵。不得访问、diff、复制或借鉴已取消 P9-0 的任何 Worktree 或提交。

## 目标

- 为 `npm run test:i18n` 增加 binding/provenance 基础，作为有限语法 bounded recognizer 只消费白名单内非 async/generator、参数名唯一且函数体角色非空互斥的 top-level `FunctionDeclaration`、literal default、direct `Identifier`、最多一层 const terminal alias、一层直接参数 wrapper/monitor 与 harmless top-level `EmptyStatement`。
- 统一 `Resolution={binding,complete,ambiguous}`，consumer 只在 `complete===true && ambiguous===false` 时消费；任何相关 provenance incomplete 时 producer 必须 producer-incomplete。
- 自动矩阵覆盖 binding、alias、default、monitor/forward、return、unsupported 和 metamorphic 场景，使用统一 oracle：H、0、I、A。
- 用 ADR-0016 和 `docs/TEST_STRATEGY.md` 固化支持边界、fail-closed 语义、威胁模型和验证门槛。

## 非目标

- 不修改产品代码、`预见PreVision.html`、`src/**`、`electron/**`、`i18n/locales/**`、i18n runtime 或 `qa/i18n-policy.json`。
- 不修改 `package.json`、`package-lock.json`、`qa/golden/**`、`qa/test-impact-map.yaml`，不新增依赖。
- 不做 P9-0b 运行时文案清欠，不做 P9 UI/persist/main/shim。
- 不创建公开仓库、不联网服务、不更新固定 App、不运行 `app:deliver`。
- 不自行 `task:verify-stop`、REVIEW、HANDED_OFF、release、archive、merge 或 closeout。

## 证据与现状

- 代码：`测试/国际化测试.mjs` 当前为轻量契约测试，约 158 行，依赖正则扫描 language key 与新增直接中文 diff；没有 AST binding/provenance 分析基础。
- Git：开工前 `pwd` 为当前 Worktree；detached HEAD 精确为基线；工作区 clean。已从精确基线创建 `test/p9-0a-i18n-binding-foundation`。
- 测试/运行：Node `v24.14.0`；`npm ci` 成功；`app:status` 在分支上通过并显示 contains installed source；`task:status` 显示本任务 WAITING reservation。
- 文档/历史线索：已完整阅读指定仓库文档、ADR-0002、QA 分类和现有 i18n 测试；Obsidian 相关线索集中于 PreVision 架构地图、拆分方案、回归测试清单、重构进度，未使用旧取消任务 Worktree。

## 影响范围

- 模块：testing,i18n,repository
- 文件：仅限并行任务声明中的文件；completed 验收单和 completed README 本轮仅预声明，不创建、不修改
- 数据格式：无用户项目数据变化
- 平台：Node 测试与仓库文档；不影响固定 App 安装包

## 风险

- 风险档：R3
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：XHigh
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：04 另行组织 R3 reviewer；本轮不自行 review
- 数据：仅 QA 元数据/测试 oracle，不触碰用户项目数据
- UI/交互：无
- 安全：fail-closed 静态分析边界，拒绝不支持的 alias/call/import/dynamic 形态；不得用正则 fallback 或名称白名单绕过 provenance
- 发布：不更新固定 App，不对外发布

## 验收条件

- [ ] 文档 threat model 已先独立提交，说明支持边界、fail-closed 语义和精确变异矩阵。
- [ ] analyzer 使用 binding identity 和统一 resolution，consumer 只消费唯一完整 binding。
- [ ] 自动矩阵覆盖任务要求的 Binding、Alias、Default、Monitor/forward、Return、Unsupported、Metamorphic 场景。
- [ ] 相关自动测试通过。
- [ ] 不涉及 UI 人工验证；固定 App 交付不适用。
- [ ] 实现者之外的独立只读 R3 reviewer 待 04 组织；本轮交付后保持 active。
- [ ] 文档和决策索引已更新。

## 测试计划

- 影响映射模块：i18n-test、foundation
- 主应用模块参数：无
- 最小命令：
  - `npm run test:i18n`
  - `npm run test:foundation`
  - `node 测试/回归/run_all.mjs`
  - `npm run test:impact -- --base 1fae3e6ff4205e5ec052ed8ec56b2ba9fa947cd5`
  - `npm run test:full`
  - `git diff --check`
- 升级到全量的条件：本任务固定要求运行全量
- 人工检查尺寸/步骤：无 UI 改动，不适用
- 固定 App 交付：不适用；目标路径固定为 `~/Applications/PreVision.app`，本任务不运行 `app:deliver`

## 实施记录

- 假设：只支持同一已解析文件内的明确语法子集；所有无法唯一证明的 producer/consumer provenance fail closed。
- 关键决定：先提交纯文档 threat model，再实现 analyzer 和自动矩阵。
- 实际修改：
  - `测试/国际化测试.mjs` 新增 Acorn test-only synthetic binding/provenance analyzer；Acorn 仅复用现有 lockfile 环境，不改 package/lock。
  - 收敛为一个中央 positive-syntax gate：parse 后先验证整个 synthetic candidate，只允许非 async/generator、参数名唯一的 top-level `FunctionDeclaration`、`const` terminal、direct call 和结构化 consumer sink；每个函数体必须非空且互斥为纯 consumer assignment 或纯 direct-call wrapper，collector/summary/eval 只消费 gate 记录的角色。
  - 00 架构裁决覆盖前序“补齐完整 JavaScript 作用域/参数语义”的探针方向：P9-0a 收敛为 bounded recognizer，只有 ADR-0016 白名单内形态可消费。
  - consumer 不按函数名白名单识别，而从合成 fixture 的 `<identifier>.textContent = <resolved parameter identifier>` 结构建立 UI producer root；`FunctionExpression`、Arrow、external const default、callee alias、多层 wrapper、所有 return producer、try/catch、container、loop 和 closure capture 均统一降级为 `I`。
  - binding identity 是声明 AST 节点；name 仅用于 bounded top-level unique lookup 与诊断。direct-call argument 仅允许 literal/`Identifier`，nested call argument 在中央 gate 直接降级为 `I`，eval 不保留旁路解释分支。
  - gate 锁边矩阵新增 async/generator、重复参数两种实参顺序、mixed/empty body 前后顺序、nested call argument，以及 direct const literal、恰一 alias edge 和超界 alias edge。
  - literal default 的 direct consumer 与一层 wrapper consumer call 均只经 `argumentOrDefault` 取值；nested lexical scope/shadow 不建模并 fail closed；top-level extra semicolon 作为 harmless `EmptyStatement` 明确保留为白名单语法。
  - synthetic 矩阵覆盖 H/0/I/A oracle、structural P1 snippets、unsupported binder/loop/export/import/meta/container ancestry、duplicate findings、control-flow/throw/import-expression fail-closed、eval/require alpha rename 和显式 sourceType。
  - R3 BLOCK（本轮四项）已以 test-first 复现并收口：一层 wrapper 缺省参数转发到 consumer literal default、consumer/wrapper/多 consumer 的 finding event multiplicity、所有顶层 const alias 与重复函数的未消费审计，以及四条冻结 P1 raw fixture 与 ADR 的 `const out = null` 逐字一致性。
  - wrapper summary 记录每个 resolved consumer event，不再用集合折叠同一 parameter；wrapper 自身缺实参时仅回退该 resolved consumer 的 literal default。central gate 在消费前审计所有顶层 const：只接受 literal 或恰一条指向 literal const 的 alias，未消费的两层/cycle/unresolved/callee alias 均 `I`；未消费的重复 top-level function 为 `A`。
- 中断/恢复：canonical worker 此前因 systemError 停止；本轮从 registry 自证同一 ACTIVE task/thread/client、`HEAD=31cf348`、空 index 与原 scope 四文件 WIP 后原位恢复，未新建 task、Worktree、分支或 claim。
- app-server 通知消费：后台施工；不得作为 Desktop live 证据

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci` | 通过 | 约 9s | 既有 npm deprecated/audit/allow-scripts 提示；未改 package 文件 |
| `npm run app:status` | 通过 | <1s | 分支上 Contains installed source: yes；Exact installed source: no |
| `npm run task:status` | 通过 | 约 16s | claim 前显示本任务 WAITING reservation，无 active claim |
| `npm run task:claim -- --reservation ...` | 通过 | 约 17s | 已转换为 ACTIVE/BACKGROUND_ONLY；claim token 未写入仓库 |
| 阶段 A 第一次隔离 `npm run test:i18n` | 通过 | <1s | 临时干净验证 Worktree，仅应用 docs patch；21 passed, 0 failed |
| 阶段 A 第一次隔离 `npm run test:foundation` | 通过 | 约 75s | 临时干净验证 Worktree，仅应用 docs patch；foundation 151、C8 11、coordination 553、i18n 21、project-input wrapper 11 全部 0 失败 |
| 阶段 A 第二次隔离 `npm run test:i18n` | 通过 | <1s | 临时干净验证 Worktree，仅应用 docs patch；21 passed, 0 failed |
| 阶段 A 第二次隔离 `npm run test:foundation` | 通过 | 约 72s | 临时干净验证 Worktree，仅应用 docs patch；foundation 151、C8 11、coordination 553、i18n 21、project-input wrapper 11 全部 0 失败 |
| `npm run test:i18n` | 通过 | <1s | 131 passed, 0 failed；含 Binding provenance analyzer synthetic matrix |
| 00 裁决后 `npm run test:i18n` | 通过 | <1s | 165 passed, 0 failed；bounded recognizer 白名单收敛 WIP |
| 有界复探针后 `npm run test:i18n` | 通过 | <1s | 166 passed, 0 failed；真实 runtime 证据收窄后的 positive-syntax gate |
| 最小 gate 返修后 `npm run test:i18n` | 通过 | <1s | 183 passed, 0 failed；新增 17 个 async/generator、重复参数、body role、nested-call argument 与 const alias 有界复探针 |
| literal default / scope / semicolon 返修后 `npm run test:i18n` | 通过 | <1s | 187 passed, 0 failed；direct consumer default、单层 wrapper default、显式 safe override 与 harmless top-level semicolon 均按 H/H/0/H 锁定 |
| R3 四项 BLOCK test-first `npm run test:i18n` | 预期失败 | <1s | 189 passed, 9 failed；准确复现 wrapper default H→0、三项 multiplicity A→H、四项 unused alias I→0 与 uncalled duplicate function A→0 |
| R3 四项 BLOCK 返修后 `npm run test:i18n` | 通过 | <1s | 198 passed, 0 failed；wrapper default H/safe 0、三类 multiplicity A/single H、unused alias I、uncalled duplicate function A 与四条 P1 raw `const out = null` 均锁定 |
| R3 返修 `npm run test:foundation` | 通过 | 约 73s | foundation 151、C8 11、coordination 553、i18n 198、project-input wrapper 11，全部 0 失败 |
| R3 返修 `node 测试/回归/run_all.mjs` | 通过 | 3.9s | C1/C2/C3/C4/C5/C6/P8/U4/U1/U2/U3/U5/C8 全部 PASS；V1 视觉基准按既有规则 SKIP（需要真机 Electron+GPU 录制，VM 无像素） |
| R3 返修 `npm run test:impact -- --base 1fae3e6ff4205e5ec052ed8ec56b2ba9fa947cd5` | 通过 | 73.23s | 检测 5 个变化文件，命中 foundation、i18n-test；运行 foundation 通过 |
| R3 返修 `npm run test:full` | 通过 | 约 150s | app 968、web 10+14、desktop 47、local-install 36+13、foundation 151、coordination 553、i18n 198、project-input wrapper 11 全部 0 失败；既有合成 cleanup warning 与 V1 SKIP 未作为 PASS |
| R3 前历史门禁｜`npm run test:i18n` | 通过 | <1s | 187 passed, 0 failed；保留为 R3 四项 BLOCK 前的历史证据，不与当前 198 门禁竞争 |
| R3 前历史门禁｜`npm run test:foundation` | 通过 | 约 83s | foundation 151、C8 11、coordination 553、i18n 187、project-input wrapper 11，全部 0 失败；保留为历史证据 |
| R3 前历史门禁｜`node 测试/回归/run_all.mjs` | 通过 | 4.1s | C1/C2/C3/C4/C5/C6/P8/U4/U1/U2/U3/U5/C8 全部 PASS；V1 视觉基准按既有规则 SKIP；保留为历史证据 |
| R3 前历史门禁｜`npm run test:impact -- --base 1fae3e6ff4205e5ec052ed8ec56b2ba9fa947cd5` | 通过 | 75.41s | 检测 5 个变化文件，命中 foundation、i18n-test；运行 foundation 通过；保留为历史证据 |
| R3 前历史门禁｜`npm run test:full` | 通过 | 约 193s | app 968、web 10+14、desktop 47、local-install 36+13、foundation 151、coordination 553、i18n 187、project-input wrapper 11 全部 0 失败；既有合成 cleanup warning 与 V1 SKIP 未作为 PASS；保留为历史证据 |
| `npm run test:foundation` | 通过 | 约 90s | foundation 151、C8 11、coordination 553、i18n 131、project-input wrapper 11 全部 0 失败 |
| `node 测试/回归/run_all.mjs` | 通过 | 约 4s | C1/C2/C3/C4/C5/C6/P8/U4/U1/U2/U3/U5/C8 全部 PASS；V1 视觉基准按既有规则 SKIP |
| `npm run test:impact -- --base 1fae3e6ff4205e5ec052ed8ec56b2ba9fa947cd5` | 通过 | 76.73s | 检测 5 个变化文件；命中 foundation,i18n-test；运行 `npm run test:foundation` 通过 |
| `npm run test:full` | 通过 | 约 2m | app 968、project-input、web 10+14、desktop 47、local-install 36+13、foundation 151、coordination 553、i18n 131、project-input wrapper 11 全部 0 失败 |
| `git diff --check` | 通过 | <1s | 无 whitespace error |
| 禁区 diff 检查 | 通过 | <1s | package/lock、qa/golden、qa/test-impact-map、i18n/locales、src、electron、主 HTML 零 diff |
| 敏感/绝对路径检查 | 通过 | <1s | 未在任务文件中发现 reservation token、canonical client/thread 或本机绝对路径 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；本任务不交付固定 App

## 未覆盖与后续

- import/require、member/computed/optional、call/apply/bind、对象/数组 alias、destructure/rest alias、callback/高阶、跨文件、反射/eval/Function 均为不支持边界，必须 fail closed。
- 代码 analyzer 已获独立 Terra/high R3 A-D 17 项 PASS，无同类 P2；当前仅剩 evidence consistency delta，须经独立机械 reviewer 接受后才可 closeout。

## 交接

- 代码/合同提交：七笔已完成；代码 HEAD=`6ec1f7e7108457ee0bff269d4367ff732fcf28c7`。
- PR：无
- reviewer 结论：Terra/high 代码 R3 A-D PASS；验收单证据矛盾曾 BLOCK。本提交仅修复 evidence consistency，仍待独立 mechanical delta acceptance。
- 生命周期交接：保持 ACTIVE；不得预称 final PASS、HANDED_OFF 或 closeout。
- 工作区状态：提交前待记录；本 turn 仅 active-plan evidence delta。
- 下一步：独立 Terra/medium 机械 delta review。
