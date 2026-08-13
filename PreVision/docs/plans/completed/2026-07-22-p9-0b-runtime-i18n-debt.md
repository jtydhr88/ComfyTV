# 任务：P9-0b｜运行时文案清欠（后台施工）

- 状态：completed
- 日期：2026-07-22
- 对话：P9-0b canonical background worker
- 分支：test/p9-0b-runtime-i18n-debt
- 基线：b308adaddcae63a5c776d23832f18413f367f16a
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`；当前任务分支包含该来源但不精确相等，本任务不交付固定 App。
- 负责人：worker:04.p9-0b-runtime-i18n-debt

## 并行任务声明

- 任务 ID：04.p9-0b-runtime-i18n-debt
- 模式：write
- 分管 owner：04
- 模块：i18n, testing, repository, history, project, camera, timeline, actor, lighting, background, layout, capture
- UI 表面：app-shell, topbar, left-rail, viewport, canvas-controls, timeline, monitor, inspector, dialogs, capture-controls
- 数据区域：i18n-resources, qa-metadata
- 预计修改文件：`src/app.js`、locale、国际化测试、测试策略和本验收单；`预见PreVision.html` 仅由 build 生成。
- reservation：已预留（token 已在调用时核对，不写入仓库）
- reserve request key：已核对/已去敏
- 协调登记：历史快照，schema v3；claim 已确认。
- 权威生命周期：历史快照，不替代随后 live registry。
- 当前 actor / 下一责任人：历史快照；实时 owner 以 `npm run task:status` 为准。
- 状态更新时间 / 原因：commit `670b2528a5c2e9a7c634868913313be865e7874c` 写入时的 reconciliation 快照，不宣称为随后实时状态。
- 侧栏去重证据：已核对/已去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：历史快照；实时 turn 以 `npm run task:status` 为准。
- 执行可见性：历史快照；实时 visibility 以 registry 为准。
- Desktop live 证据：不适用
- WAITING checkpoint：已完成；后台连接状态仅作施工身份，不构成 Desktop live 证据。
- pre-REVIEW checkpoint：`670b252` stop 后已核验 ACTIVE / BACKGROUND_ONLY / turn=completed；stop verification 已持久化，claim 保留，当时尚未 REVIEW。
- 实时状态规则：该 checkpoint 是不可变历史证据；本提交后的 REVIEW/HANDED_OFF 等只以 `npm run task:status` 为准，验收单不重复冒充当前 registry。
- 失败补偿：保留 reservation/同一 thread，失败时停止并报告。
- `task:check` 结果：reserve 前已通过 No hard conflicts。
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：截至 `670b252` 的 baseline..HEAD 有序列表为 `6396b6130421abfa72d9431558a56969f53156b7`、`884f8d71ca121dfa654b669921327d840810c134`、`eb2e3295288d4d4bdd9a53cc5e53f4c85b67fd11`、`f0c7b5c13111f89aa5003230ab7ba67ad25d078d`、`339d0fab405f7fd413e8ce4ce921ce512753c362`、`670b2528a5c2e9a7c634868913313be865e7874c`。本轮 plan-only commit hash 由 04 在真实 stop 后加入 registry 冻结列表；以 registry 为准。
- 机械 closeout：不适用
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

清理 `src/app.js` 中真实 user-facing runtime 中文文案，改用 language key，并建立真实 runtime candidate adapter；不改变 project-v5 数据语义。

## 目标

- 仅迁移真实动态 UI sink 的中文文案，补齐 `zh-CN`/`en-US` keys。
- 为 `src/app.js` 建立基于 AST/位置与 sink 角色的 fail-closed runtime candidate adapter。
- 保留锁定 sentinel、默认对象持久化名称、prompt/project 数据字符串的字节和语义。

## 非目标

- 不手改生成的 `预见PreVision.html`，不改 app-shell、政策、ADR、影响映射、依赖、Electron、project-data、视觉/行为/数据格式。
- 不扩展 P9-0a recognizer 的 binding/producer 语义，不进入 P9 UI/persist/main/shim 拆除。

## 证据与现状

- 代码：从当前 baseline AST 重新盘点所有候选，不采信旧 P9-0 工作树或提交。
- Git：clean baseline `b308adaddcae63a5c776d23832f18413f367f16a`。
- 测试/运行：Node `v24.14.0`；`app:status` 成功，installed=`7ff9aa5`、current=当前任务 HEAD、contains=yes、exact=no。
- 文档/历史线索：ADR-0002、ADR-0016 和 `TEST_STRATEGY` 已读取。

## 影响范围

- 模块：声明范围内的 i18n/testing 及 UI sink 所属模块。
- 文件：严格限于 claim 文件清单。
- 数据格式：无；project-v5 sentinel、持久化默认名称与 prompt/project 数据字符串不得变更。
- 平台：浏览器 runtime；不交付固定 App。

## 风险

- 风险档：R3
- 请求模型：Terra
- 实际模型：不可观察，未验证
- 请求 reasoning：Medium
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：Terra/high；R3 不得降级。
- 数据：误迁移数据 sentinel/持久化名称会破坏兼容，按 AST sink/flow 排除。
- UI/交互：翻译插值必须保留既有默认中文语义。
- 安全：adapter 不得使用产品字符串或变量名白名单绕过。
- 发布：不执行 `app:deliver`。

## 验收条件

- [x] 所有真实动态 UI sink 的中文文案迁移至同步 locale keys。
- [x] Runtime adapter 覆盖 textContent/title/value、alert、prompt、showConfirm、模板与条件分支，并对不可唯一证明的 producer fail closed。
- [x] 数据 sentinel、默认名称和 prompt/project 数据契约保持不变。
- [x] `npm run test:i18n`、build、回归、impact、full 和 diff check 通过。
- [ ] 独立只读 reviewer 已完成。
- [ ] 不适用固定 App 交付：仅代码/测试债务清理，由 `00` 后续集成。
- [ ] `docs/TEST_STRATEGY.md` 准确记录真实 runtime adapter 已启用。

## 测试计划

- 影响映射模块：i18n-test、i18n-browser、foundation；`src/app.js` 变化按 full 升级。
- 主应用模块参数：无。
- 最小命令：`npm run test:i18n`。
- 升级到全量的条件：本任务已要求 `npm run test:full`。
- 人工检查尺寸/步骤：不涉及布局/视觉变化；核对 locale 插值语义。
- 固定 App 交付：不适用；固定路径不更新。

## 实施记录

- 假设：当前 reservation 可转换为同范围 active claim。
- 关键决定：只将 AST 角色可证明的 UI sink 文案迁移为 keys。
- 实际修改：迁移 AST 可证明的 runtime UI sink 文案；新增 locale keys；真实 runtime adapter 以 AST sink/位置提取候选并交给 bounded evaluator。
- 中断/恢复：无。
- app-server 通知消费：后台施工；完成时以 `task:verify-stop` 持久化。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci` | 通过 | 8s | 使用 bundled Node 24 安装 lockfile 依赖；审计报告 23 个既有依赖漏洞，未修改 lockfile。 |
| `npm run app:status` | 通过 | <1s | Installed `7ff9aa5`；baseline 包含该来源，非本任务交付。 |
| `npm run test:i18n` | 通过 | <1s | bundled Node v24.14.0；217 passed, 0 failed。 |
| `npm run build` | 通过 | <1s | 仅构建脚本重建 `预见PreVision.html`。 |
| `node 测试/回归/run_all.mjs` | 通过 | 最终复跑 | C1 42、C2 18、C3 25、C4 44、C5 41、C6 20、P8 38、U4 37、U1 55、U2 41、U3 173、U5 44、C8 11；V1 仅既定真机 Electron+GPU SKIP。 |
| `npm run test:impact -- --base b308…f16a` | 通过 | 约 30s | 命中 main-app，按策略升级并运行 `test:full`。 |
| `git diff --check` | 通过 | <1s | 无 whitespace error。 |
| `npm run test:foundation` | 通过 | 最终复跑 | foundation 151、C8 11、coordination 553、i18n 217、project-input wrapper 11，均 0 failed。 |
| `node 测试/回归/run_all.mjs` | 通过 | 最终复跑 | C1 42、C2 18、C3 25、C4 44、C5 41、C6 20、P8 38、U4 37、U1 55、U2 41、U3 173、U5 44、C8 11；V1 仅既定真机 Electron+GPU SKIP。 |
| `npm run test:full` | 通过 | 只读复跑 | app 968、Web 10+14、desktop 47、local-install 36+13、foundation 子项均通过。 |
| `git diff --check baseline..HEAD` | 通过 | <1s | exit 0。 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`；contains=yes，exact=no。

固定 App 人工启动结果：不适用。

## 未覆盖与后续

- 首轮独立 Terra/high R3 verdict=BLOCK（无 P0/P1）：P2-1 adapter 漏掉 identifier/alias Han producer；P2-2 lifecycle/stop/commit/app-status evidence 不一致。两项已做有界返修；第二轮结果见下一条。本 worker 不进入 REVIEW/HANDED_OFF 或 fixed-App delivery。
- 第二轮 Terra/high R3 BLOCK（唯一 P2）：复合 template/binary/call sink producer 中的 Han-bearing identifier 被遗漏。`417f4d6` 有界返修后 Han-bearing template/binary/call composite 均为 I，三个 safe 对照均为 0，`src/app.js` candidates=0；等待一次 final exact-contract review。
- 00 止损：风险仍为 R3；下一步仅做一次独立 Terra/medium exact-contract 聚焦验收，不做第三轮广泛 R3 或扩展 analyzer。若再发现同类 identifier/alias/composite P2，立即停止并回报 00，不自动第四次返修。

## 交接

- 截至本次 plan-only 提交前的完整有序提交：`6396b6130421abfa72d9431558a56969f53156b7 test: migrate runtime i18n copy debt`；`884f8d71ca121dfa654b669921327d840810c134 test: correct p9-0b review evidence`；`eb2e3295288d4d4bdd9a53cc5e53f4c85b67fd11 test: record p9-0b stop evidence`；`f0c7b5c13111f89aa5003230ab7ba67ad25d078d test: harden runtime i18n candidate adapter`；`339d0fab405f7fd413e8ce4ce921ce512753c362 test: track Han-bearing runtime binding writes`；`670b2528a5c2e9a7c634868913313be865e7874c docs: reconcile p9-0b remediation evidence`；`73858abcc6e4b18b28321d039ab8722554355600 docs: clarify p9-0b lifecycle snapshot`；`417f4d60d62efc31e1b66a203fc27e1ed4c57eb8 test: cover composite runtime i18n producers`；`473da519f99772bf435128f1aa12d479c27bdbba docs: finalize p9-0b review evidence`。本轮新 plan-only commit subject 为 `docs: correct p9-0b final evidence index`，不自引用未知 hash；由 04 stop 后加入 registry 冻结列表。
- PR：无
- reviewer 结论：前两轮 Terra/high R3 BLOCK 已分别返修；等待一次 final exact-contract review，不宣称 PASS/REVIEW/HANDED_OFF。
- 生命周期交接：ACTIVE（保持 claim）
- 工作区状态：验证后 clean。
- 下一步：一次独立 Terra/medium exact-contract 聚焦验收；本 worker 不进入 REVIEW/HANDED_OFF。
