# PreVision 项目文档索引

本目录用于替代超长开发对话。新开发者或新 Codex 任务应从这里开始。

## 当前事实

- [当前状态](CURRENT_STATE.md)：版本、Git、已验证命令、环境和阻塞项。
- [架构](ARCHITECTURE.md)：运行时、数据流、Electron 边界和高风险区域。
- [功能登记](FEATURE_REGISTRY.md)：已验证、未验证、部分完成和计划功能。
- [已知问题](KNOWN_ISSUES.md)：当前限制、技术债和发布阻塞项。
- [历史决策](HISTORICAL_DECISIONS.md)：已经形成且能在代码中找到证据的设计选择。

## 开发与质量

- [开发流程](DEVELOPMENT_WORKFLOW.md)：固定分流入口、短期 Worktree 任务、原子写槽、权威生命周期、Desktop live/后台施工可见性、app-server 补偿和中央集成。
- [Codex 模型与额度路由](CODEX_MODEL_ROUTING.md)：R0–R3、模型/reasoning、Fast/Ultra/Max 和独立 reviewer 规范。
- [任务模板](TASK_TEMPLATE.md)：所有任务验收单的固定格式。
- [测试策略](TEST_STRATEGY.md)：核心冒烟、模块测试、全量测试和影响选择。
- [代码评审](CODE_REVIEW.md)：审查优先级、数据安全和 UI 验证标准。
- [发布流程](RELEASE_PROCESS.md)：版本、构建、签名、产物和 GitHub Release 流程。
- [静态 Web 运行底座](WEB_RUNTIME.md)：Web 构建、首页插槽、路由、回环预览、安全响应头和静态部署契约。
- [Web 跨平台压力验证](WEB_PERFORMANCE.md)：真浏览器压力矩阵、指标口径、macOS 实测证据以及 Safari/Windows 阻塞。

## 产品材料

- [功能说明](FEATURES.md)
- [产品路线图](ROADMAP.md)
- [架构/流程决策记录](decisions/README.md)，记录开发基础、国际化与固定 App 统一交付决策。
- 国际化规范见 [ADR-0002](decisions/0002-language-key-internationalization.md)，任何用户文案任务都必须运行 `npm run test:i18n`。
- 本机交付规范见 [ADR-0003](decisions/0003-canonical-local-app-delivery.md)，任何用户可见任务都必须更新并验收固定 App。
- 并行开发规范见 [ADR-0004](decisions/0004-short-lived-tasks-and-conflict-gate.md)，写任务必须先声明范围并通过冲突门禁。
- 分管自治派发见 [ADR-0005](decisions/0005-department-autonomous-dispatch-and-atomic-write-reservations.md)：固定 `01`–`04` 原子 reserve 后自治创建真实侧栏任务，仓库登记生命周期；旧 Worktree 通过 `task:migrate-legacy-worktree` 接入 common-dir 只读 launcher，固定 `00` 负责中央机械集成、release 与归档。
- [进行中的验收单](plans/active/README.md)
- [已完成的验收单](plans/completed/README.md)

## 机器可读 QA 数据

- `qa/feature-registry.yaml`：功能状态与证据。
- `qa/core-flows.yaml`：发布前必须保护的核心用户流程。
- `qa/test-impact-map.yaml`：文件/模块变化对应的最小测试范围。
- `qa/i18n-policy.json`：language key、受支持语言与直接中文守卫边界。
- `qa/local-delivery-policy.json`：固定 App 的可信迁移基线与构建来源记录契约。
- `qa/task-scope-taxonomy.json`：短期任务路由模板、模块/UI/数据范围名称与并发写上限。
- `qa/web-stress-matrix.json`：macOS/Windows 真浏览器压力场景、固定参数、指标和证据安全契约。
- `qa/web-stress-evidence-schema.json`：去敏压力证据的严格字段、类型、枚举与嵌套结构契约。

## 维护规则

- 代码行为变化时，同一任务同步更新相关文档和 QA 登记。
- `CURRENT_STATE.md` 只记录当前事实，不堆积完整历史。
- 重要架构选择在 `docs/decisions/` 新建记录，不回写旧记录掩盖变化。
- 历史聊天和本机 `日志/` 只能提供线索，不能替代测试证据。
