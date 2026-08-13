# ADR-0001：以仓库文件和分层测试作为开发上下文

状态：Accepted
日期：2026-07-13

## 背景

项目经过连续原型开发后，功能、设计理由和验证证据分散在超长对话、单体应用代码、测试和本机记录中。新的开发任务如果依赖聊天记忆，会混淆“提出过”“实现过”和“当前已验证”，也会让低风险修改默认触发全部回归。

## 决定

1. 当前代码和可重复运行的证据优先于历史对话。
2. `AGENTS.md` 与 `docs/INDEX.md` 是新对话的固定入口。
3. 功能状态只使用 `VERIFIED`、`IMPLEMENTED_UNVERIFIED`、`PARTIAL` 和 `PLANNED`。
4. 每项开发使用一个任务、一个 Codex 对话、一个分支和一个验收单。
5. 自动测试分为 foundation、core、app、desktop、full；由 `qa/test-impact-map.yaml` 选择最小安全集合，未知变化回退到 full。
6. 原始阶段由不可覆盖的本地 checkpoint 分支和提交保存；基础建设不直接写入 `main`。
7. GitHub 未连接时保留完整本地流程，不自动创建公开仓库；连接后使用 PR、Actions 和人工合并。

## 结果

- 新任务无需读取历史聊天即可得到当前架构、功能、问题、测试和发布边界。
- 纯文档或 Electron 修改不再默认运行全部应用行为断言。
- 主单文件应用或未知范围的变化仍执行全量回归，避免为了速度降低安全性。
- 机器可读 QA 登记和人类文档必须在行为变化时一起维护。

## 基线

- checkpoint 分支：`checkpoint/prevision-before-foundation-2026-07-13`
- checkpoint 提交：`ce523b2f1914e34f863826977492626dcb3bd754`
- 基础建设分支：`chore/prevision-development-foundation`
