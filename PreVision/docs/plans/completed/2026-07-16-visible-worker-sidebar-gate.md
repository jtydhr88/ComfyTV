# 任务：侧栏可见临时工门禁

- 状态：completed
- 日期：2026-07-16
- 对话：04.3｜侧栏可见临时工门禁
- 分支：chore/visible-worker-sidebar-gate
- 基线：a05b21dfa5c20263044b416dc3a27f5c3556c964
- 固定 App 来源：7ff9aa583b4e51fb4d888aa1815792b747d275d7（当前基线包含该来源；本任务不交付 App）
- 负责人：Codex 独立短期临时工 04.3

## 并行任务声明

- 任务 ID：04.3-visible-worker-sidebar-gate
- 模式：write
- 模块：repository, testing
- UI 表面：无
- 数据区域：无
- 预计修改文件：`AGENTS.md`、`docs/DEVELOPMENT_WORKFLOW.md`、`docs/decisions/0004-short-lived-tasks-and-conflict-gate.md`、`测试/并行任务协调测试.mjs`、`测试/仓库基础测试.mjs`、本验收单归档路径、`docs/plans/completed/README.md`
- `task:check` 结果：首次检查无冲突；实施期间 03.6 登记后复查仍无硬冲突，仅 `docs/plans/completed/README.md` 文件级软冲突。集成顺序固定为 04.3 先、03.6 后
- `task:claim`：已登记
- `task:release`：未释放；交接后由 `00` 集成成功再释放

## 用户问题

现有治理规则没有明确要求实际写任务必须是用户在 Codex 项目侧栏中可见的独立短期任务，也没有禁止内部 collaboration/sub-agent 承担写入、提交或 write claim，容易让不可观察的内部代理绕过长期入口与短期任务隔离。

## 目标

- 将所有项目文件写入路由到由固定 `00` 通过 Codex 项目 Worktree 新建的、用户侧栏可见的独立短期任务。
- 明确内部 collaboration/sub-agent 只能用于只读审计、代码审查、测试复核和调研，不得写项目文件、创建实现提交或持有 write claim。
- 保持固定 `01`–`05` 与 `00` 的既有职责边界，并明确短期任务按需创建、完成或取消后由 `00` release 并归档侧栏任务。
- 用协调测试与仓库基础测试锁定核心治理文件不遗漏、不互相矛盾。

## 非目标

- 不修改业务代码、用户界面、版本、App、预览或 Codex 内部 API。
- 不把无法由仓库观察的 App 内部行为假装成自动强制能力。
- 不执行 `app:deliver`，不更新 4175 或固定 App。

## 证据与现状

- 代码：现有测试仅断言“独立短期临时工”和 Worktree，尚未断言“侧栏可见”及内部 sub-agent 只读边界。
- Git：当前分支基于指定集成 HEAD `a05b21d`；创建分支前工作区干净。
- 测试/运行：Node 24.18.0；`app:status` 显示当前基线包含固定 App 来源；`task:status` 显示无 active claim。
- 文档/历史线索：`AGENTS.md`、`docs/DEVELOPMENT_WORKFLOW.md` 与 ADR-0004 已有固定入口/短期任务边界，但未明确侧栏可观察含义。

## 影响范围

- 模块：repository, testing
- 文件：治理文档、协调/基础测试、验收单与 completed 索引
- 数据格式：无
- 平台：仓库开发流程；不改变运行时平台

## 风险

- 数据：无业务数据变化。
- UI/交互：不改产品 UI；只描述 Codex 侧栏中用户可观察的任务存在性。
- 安全：防止内部不可见写代理绕过 claim、分支与验收边界。
- 发布：不构建、不安装、不发布；由 `00` 机械集成提交。

## 验收条件

- [x] 三份核心治理文件一致要求所有实际写入使用由 `00` 创建的用户侧栏可见独立短期任务。
- [x] 三份核心治理文件一致限制内部 collaboration/sub-agent 仅执行只读工作，禁止项目写入、实现提交和 write claim。
- [x] 固定 `01`–`05`、固定 `00`、按需创建、release/归档职责保持一致且无矛盾。
- [x] 协调测试与基础测试会因任一核心文件遗漏关键规则而失败。
- [x] `test:foundation`、`test:coordination`、`test:i18n` 与影响测试通过。
- [x] 不需要人工产品 UI 验证；完成文档与测试 diff 审阅。
- [x] 固定 App 交付不适用：纯治理文档/测试任务，不执行 `app:deliver`。
- [x] 验收单归档并更新 completed 索引。

## 测试计划

- 影响映射模块：foundation-test, foundation
- 主应用模块参数：无
- 最小命令：`npm run test:coordination`、`npm run test:foundation`、`npm run test:i18n`
- 升级到全量的条件：影响测试识别未知或运行时范围，或治理改动触及协调脚本/配置语义
- 人工检查尺寸/步骤：不适用；人工核对三份规范及两份测试断言一致性
- 固定 App 交付：不适用；不修改安装包内容

## 实施记录

- 假设：“侧栏可见”指固定 `00` 通过 Codex 项目 Worktree 新建任务后，该任务作为独立任务出现在用户项目侧栏，可由用户打开、观察和归档；仓库测试只验证规范文本一致性，不宣称检测 Codex App 内部状态。
- 关键决定：内部 collaboration/sub-agent 允许只读辅助，但不允许持有 write claim 或产生项目写入/实现提交。
- 实际修改：三份核心规范加入用户侧栏可见的定义、内部 collaboration/sub-agent 只读边界及按需创建/release/归档规则；协调测试与基础测试加入跨文件一致性断言。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm run app:status` | 通过 | <1s | installed `7ff9aa5`；current `a05b21d`；contains=yes, exact=no |
| Node 24 `npm run task:status` | 通过 | <1s | 无 active claim |
| `npm run test:coordination` | 31/31 通过 | <1s | 新增侧栏可见与内部子代理只读契约 |
| `npm run test:foundation` | 通过 | 约 2s | 基础 93/93、协调 31/31、i18n 21/21、输入 wrapper 11/11 |
| `npm run test:i18n` | 21/21 通过 | <1s | 显式复跑；无运行时中文变化 |
| `npm run test:impact -- --base a05b21d...` | 通过 | 1.57s | 最终 7 个变化文件；命中 foundation、foundation-test |
| 03.6 登记后复跑 `task:check` | 软冲突 | <1s | 仅 completed README；无模块/UI/data 重叠；04.3 先、03.6 后 |
| `git diff --check` | 通过 | <1s | 无空白错误 |
| 人工规范一致性审阅 | 通过 | — | 三份规范与两份测试含义一致；未声称自动检测 App 内部状态 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；本任务不修改或交付 App。

## 未覆盖与后续

- 仓库无法直接检测 Codex 项目侧栏或内部代理 API；只通过规范与测试防止核心文件遗漏/矛盾。

## 交接

- 最终提交：本任务聚焦提交（提交哈希见交接与 `git log`）
- PR：无（仓库未配置 remote）
- 工作区状态：提交前仅包含声明范围内文件；`node_modules/` 被忽略
- 下一步：由固定 `00` 按 04.3 先、03.6 后的顺序集成；成功后 release claim，并归档本侧栏任务。
