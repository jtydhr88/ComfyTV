# 任务：固定入口与临时工开发边界

- 状态：completed（已由 `00` 集成；原任务 claim 已 release）
- 日期：2026-07-15
- 对话：独立短期临时工 `fixed_thread_boundary_docs`
- 分支：`docs/fixed-thread-worker-boundary`
- 基线：`3f5f9b4df7c90228b998381f48f869e6ec6589a5`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 负责人：Codex 独立短期临时工

## 并行任务声明

- 任务 ID：`00.1-fixed-thread-worker-boundary`
- 模式：write
- 模块：`repository,testing`
- UI 表面：无
- 数据区域：无
- 预计修改文件：
  - `AGENTS.md`
  - `docs/CURRENT_STATE.md`
  - `docs/DEVELOPMENT_WORKFLOW.md`
  - `docs/decisions/0004-short-lived-tasks-and-conflict-gate.md`
  - `测试/仓库基础测试.mjs`
  - `测试/并行任务协调测试.mjs`
  - 本验收单及归档路径
  - `docs/plans/completed/README.md`
- `task:check` 结果：无硬冲突；与 `03.5-timeline-professional-preview` 无模块、UI 表面、数据区域或文件重叠
- `task:claim`：已登记
- `task:release`：已释放；`00` 在集成提交 `5d25319243bcbd52403667de1cbbb276f4c0f60f` 验证通过后释放

## 集成收尾声明

- 任务 ID：`00.1-fixed-thread-worker-boundary-closure`
- 模式：write
- 模块：`repository`
- UI 表面：无
- 数据区域：无
- 预计修改文件：仅本验收单
- `task:check` 结果：无硬冲突；与 `03.5-timeline-professional-preview` 无模块或文件重叠
- `task:claim`：已登记
- `task:release`：等待 `00` 集成本收尾提交后释放

## 用户问题

固定 `00`–`05` 应全部只承担长期讨论、分管与调度职责，为什么固定 `02` 仍在亲自工作？用户要求所有实际开发一律由 `00` 创建并委派给独立短期临时工任务与 Worktree。

## 目标

- 把固定 `00`–`05` 与独立短期临时工的强制边界写入仓库事实文件。
- 明确固定 `01`–`05` 即使收到“开始做”或“先做预览”，也只能澄清、形成验收口径并提交 `00`，不得开分支、claim 或写项目文件。
- 明确 `00` 只做冲突/依赖/派发、接收与集成、最终回归、稳定预览和固定 App 交付，不亲自堆积业务实现。
- 用基础与协调测试锁定规则，防止后续文档退回旧语义。

## 非目标

- 不创建或修改任何固定 Codex 对话，也不擅自创建 `05` 对话。
- 不修改业务代码、UI、项目数据、版本号、固定 App 或实时预览服务。
- 不改变两个并行写任务上限与既有范围冲突算法。

## 证据与现状

- 代码：现有规则允许“固定任务或总协调”创建短期 Worktree，未明确禁止固定 `01`–`04` 自己开分支、claim 和写入。
- Git：原任务提交为 `90becffa807d7374b129c181f09e46159fb1895e`；`00` 已从同一基线精确集成为 `5d25319243bcbd52403667de1cbbb276f4c0f60f`，两提交树内容一致。集成线与临时工 Worktree 在本收尾修改前均干净。
- 测试/运行：Node 24.18.0；`app:status` 证明基线包含固定 App 来源；`task:status` 显示唯一写任务为 `03.5-timeline-professional-preview`。
- 文档/历史线索：`AGENTS.md`、开发流程与 ADR-0004 仍使用“固定任务不长期承载实现”的弱表述，不能表达用户要求的绝对分工。

## 影响范围

- 模块：`repository,testing`
- 文件：仅治理文档、基础/协调测试与验收归档
- 数据格式：无
- 平台：仓库开发流程，跨平台一致

## 风险

- 数据：无项目数据变化。
- UI/交互：无产品 UI 变化。
- 安全：需避免把固定入口误写成可以用“快速预览”为由直接实现。
- 发布：纯仓库治理任务，不运行 `app:deliver`。

## 验收条件

- [x] `AGENTS.md`、开发流程、ADR-0004 和当前状态一致声明固定 `00`–`05` 不亲自开发。
- [x] 所有代码、UI、测试、构建或项目文件写入均由 `00` 派发给独立短期临时工；`00` 只保留协调、集成、回归、预览和最终交付职责。
- [x] 固定 `01`–`05` 收到明确开工/预览指令时仍不得开分支、claim 或写入，必须提交 `00`。
- [x] `99` 保持只读；临时工完成后向 `00` 汇报，集成成功后 release 并归档。
- [x] 自动断言覆盖以上边界。
- [x] `test:foundation`、`test:coordination`、`test:i18n` 与影响测试通过。
- [x] 固定 App 未更新，稳定预览服务未修改。
- [x] 文档已更新；本任务不涉及功能登记。

## 测试计划

- 影响映射模块：foundation
- 主应用模块参数：无
- 最小命令：`npm run test:coordination`、`npm run test:foundation`、`npm run test:i18n`
- 升级到全量的条件：影响映射检出未知文件或误触业务/运行时代码。
- 人工检查尺寸/步骤：不适用；逐条人工核对规则文件无矛盾。
- 固定 App 交付：不适用；纯文档与测试治理任务。

## 实施记录

- 假设：`05` 当前是否存在不影响规则；规则覆盖 `00`–`05`，但本任务不创建固定入口。
- 关键决定：固定入口与临时工的区别以“能否开分支、claim、写项目文件”作为可测试边界。
- 实际修改：
  - 在 `AGENTS.md`、`docs/DEVELOPMENT_WORKFLOW.md` 和 ADR-0004 中加入固定 `00`–`05` 的 **MUST NOT** 实现边界、独立临时工 **MUST** 写入边界，以及 `00` 的派发/集成/release 职责。
  - 在 `docs/CURRENT_STATE.md` 记录当前生效的强制分工，并注明规则不创建 Codex `05` 对话。
  - 在基础与协调测试中新增 12 项治理断言，锁定明确开工不例外、不得 claim、临时工写入、`99` 只读和 `00` 集成后 release。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status` | 通过 | <1s | 当前基线包含固定 App 来源，非精确来源 |
| `npm run task:status` | 通过 | <1s | 唯一写任务为 03.5 |
| `npm run task:check -- ...` | 通过 | <1s | `repository,testing`；无 UI/data 声明；无硬冲突 |
| `npm run task:claim -- ...` | 通过 | <1s | `00.1-fixed-thread-worker-boundary` 已登记 |
| `npm run test:coordination` | 通过 | <1s | 26/26 |
| `npm run test:foundation` | 通过 | 约 1s | Foundation 87、Coordination 26、i18n 21，全部 0 失败 |
| `npm run test:i18n` | 通过 | <1s | 21/21 |
| `npm run test:impact -- --base 3f5f9b4df7c90228b998381f48f869e6ec6589a5` | 通过 | 约 2s | 命中 foundation、foundation-test；全部通过 |
| `git diff --check` | 通过 | <1s | 无空白错误 |
| `00` 集成回归（Node 24） | 通过 | 由 `00` 记录 | Foundation 87、Coordination 26、i18n 21，全部 0 失败 |
| `git diff --quiet 90becff 5d25319` | 通过 | <1s | 临时工提交与 `00` 集成提交树内容一致 |
| closure `task:check` / `task:claim` | 通过 | <1s | 仅 `repository` + 本验收单；claim 等待 `00` 集成后释放 |
| closure `npm run test:foundation`（Node 24.18.0） | 通过 | 约 2s | Foundation 87、Coordination 26、i18n 21，全部 0 失败 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用，未更新或启动固定 App。

## 未覆盖与后续

- Codex 侧边栏是否已有固定 `05` 入口不由仓库控制；本任务只定义任何现有或未来 `05` 的职责边界。
- 自动测试只能保护仓库规则文本，不能从仓库技术上禁止固定对话调用写工具；每个固定入口仍必须遵守 `AGENTS.md`。

## 交接

- 原任务提交：`90becffa807d7374b129c181f09e46159fb1895e`
- `00` 集成提交：`5d25319243bcbd52403667de1cbbb276f4c0f60f`
- 收尾提交：本验收单聚焦提交（哈希见向 `00` 的交接消息）
- PR：无（仓库无 remote）
- 工作区状态：`00` 集成线和临时工 Worktree 在收尾前均干净；收尾只修改本验收单
- 下一步：原任务已完成。由 `00` 集成本收尾提交并 release `00.1-fixed-thread-worker-boundary-closure`，无需其他业务或固定 App 操作。
