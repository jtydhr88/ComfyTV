# Codex 模型与额度路由

本规范用于 PreVision 固定 `01`–`04` 在 reserve 和自治派发前选择风险档、请求模型、reasoning 与额度开关。模型只是资源路由，不是质量证明；验收仍以代码、Git、测试、构建、人工检查和独立 review 为准。

## 风险档与默认路由

| 风险档 | 典型范围 | 默认模型 | Reasoning | 备注 |
| --- | --- | --- | --- | --- |
| R0 | 文档整理、索引、机械元数据同步，不改变运行语义 | Luna | Medium | 适合确定性强、可机械验证的工作 |
| R1 | 局部 UI、低风险单模块、无数据迁移 | Terra | Medium；边界较多时 High | 仍需相关模块测试和独立 reviewer |
| R2 | `project-v5`、autosave、history、capture、export、Electron IPC、异步跨模块 | Sol | High | reviewer 不得降级；默认完整影响回归 |
| R3 | 数据迁移、安全、公开发布、架构、并发门禁和复杂集成 | Sol | XHigh | reviewer 不得降级；只有重大不确定性才短时启用 Max |

风险按实际影响取最高档，不按文件数量或改动行数降级。触及核心数据语义、安全、许可证、公开发布、正式交付或跨部门硬冲突时，除使用对应 R2/R3 路由外，还必须升级给固定 `00`/用户。

## 额度与速度开关

- Fast/priority 默认关闭。
- 优先使用标准或 Flex 队列；不能因为等待时间降低风险档或 reviewer 等级。
- Ultra 默认关闭。
- Max 默认关闭。R3 只有在重大不确定性导致普通 XHigh 无法形成可验证方案时才可短时启用，并在验收单记录开始/结束原因。
- 连续两轮不收敛、任务范围升至数据/安全，或 reviewer 发现 P0/P1，才允许升级模型、reasoning 或短时 Max。
- 预算紧张时优先缩小任务范围、补充确定性测试或拆分只读调研，不以关闭安全测试、独立 review 或冲突门禁换额度。

## 请求值与实际值

验收单必须分别记录：

- 风险档。
- 请求模型。
- 实际模型。
- 请求 reasoning。
- 实际 selected reasoning。
- Fast/priority。
- Ultra。
- Max 或其他升级原因。

代理无法观察实际模型时，必须写“不可观察，未验证”，不得把请求值复制成实际值。模型等级、reasoning 或额度开关不得作为验收证据，也不能替代 reviewer、自动测试、人工检查或固定 App 来源校验。

模型/队列标签同样不能证明任务的执行可见性。外部 app-server 使用何种模型、是否持续消费到 `turn/completed`，都不能推断 Codex Desktop 已显示当前 turn、侧栏圆圈或实时流式内容；`DESKTOP_LIVE` 必须来自受支持的 Desktop-owned 启动和实际观察，否则登记 `BACKGROUND_ONLY` 或 `UNKNOWN`。

## 独立 reviewer

每个写任务必须由实现者之外的独立只读 reviewer 复审。reviewer 不持有 write claim、不修改项目文件、不创建实现提交；发现问题后由原临时工修复并提交复核证据。

- R0/R1 reviewer 可以使用与任务风险相称的标准路由，但必须独立。
- R2/R3 reviewer 不得低于对应任务默认等级和 reasoning。
- reviewer 按 `docs/CODE_REVIEW.md` 输出 P0–P3 问题、触发条件、用户影响和未覆盖风险。
- reviewer 发现 P0/P1 时，任务不得部门验收或交接给 `00`；先升级路由并修复。
- 连续两轮 review/修复不收敛时，升级模型或把问题拆成新的明确任务，不能在原对话无限堆叠不受控范围。

## 分管入口记录责任

固定 `01`–`04` 在 reserve 前确定风险档和请求路由，并把这些字段传给侧栏临时工。临时工在验收单记录实际可观察值、升级原因和 reviewer；部门验收核对路由是否与实际 diff 匹配。固定 `00` 只检查跨部门和集成风险，不以模型标签替代机械集成与最终回归。
