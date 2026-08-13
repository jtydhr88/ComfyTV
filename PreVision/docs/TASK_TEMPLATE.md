# 任务验收单模板

复制到 `docs/plans/active/YYYY-MM-DD-任务名.md`。

```markdown
# 任务：<名称>

- 状态：active | blocked | completed
- 日期：YYYY-MM-DD
- 对话：<Codex 任务标题或链接；没有则写本地>
- 分支：<branch>
- 基线：<commit>
- 固定 App 来源：`npm run app:status` 的 installed source；纯文档任务写“不适用”
- 负责人：<人/代理>

## 并行任务声明

- 任务 ID：<如 03.1-responsive-layout>
- 模式：write | read
- 分管 owner：01 | 02 | 03 | 04 | reviewer（只读）
- 模块：<使用 qa/task-scope-taxonomy.json 中的名称>
- UI 表面：<无或分类名称>
- 数据区域：<无或分类名称>
- 预计修改文件：
- reservation：未预留 | 已预留（记录 reservation id/过期时间，不把 token 提交到仓库） | 不适用（只读/legacy）
- reserve request key：已生成并仅记录“已核对/已去敏”；stdout 断连/并发 replay 已确认返回同 generation、同一可用 token；不得提交明文 token
- 协调登记：schema v3 revision=<去敏可查询值>；persistence=confirmed | uncertain（uncertain 时记录 status 查询结果）
- 权威生命周期：RESERVED | WAITING | ACTIVE | REVIEW | HANDED_OFF | INTEGRATING | RELEASED | ARCHIVE_PENDING | ARCHIVED
- 当前 actor / 下一责任人：<固定入口、worker、reviewer 或 00>
- 状态更新时间 / 原因：<ISO 时间；为何进入当前状态>
- 侧栏去重证据：task id；client id / thread id 已在本机核对（验收单只写“已核对/已去敏”，不提交精确值或凭据）
- 外部三方状态：rollout=present|missing|unknown；thread/list/DB=present|missing|unknown；sidebar=present|absent|stale|unknown
- 侧栏命名 / turn：name=set|failed|unknown；turn=not-started|started|completed|disconnected|unknown；turnOwner=desktop|background|none|unknown
- 执行可见性：DESKTOP_LIVE | BACKGROUND_ONLY（后台施工） | WAITING | UNKNOWN（fail closed）
- Desktop live 证据：不适用 | rollout/thread DB/sidebar present + name=set + turnOwner=desktop + started turn + 已实际观察圆圈/实时内容（去敏） | 任一证据缺失/失败/未知，不能宣称 live
- WAITING checkpoint：不适用 | 已写明 WAITING/等待谁并读取到 `turn/completed`（仅后台连接完整性）
- turn stop verification：未完成 | 已用独立 `task:verify-stop` 为当前返工 attempt 持久化 completed/owner/actor/reason/evidence；REVIEW→ACTIVE 后旧证据失效，started/disconnected/unknown 不得进入 REVIEW/终态
- 失败补偿：无 | 三方明确 missing/missing/absent + turn=not-started/none，或先独立 `task:verify-stop` 持久化 completed/owner 停止证据，再以 compensation confirmed cancel reservation 并保留 tombstone | started/disconnected/UNKNOWN 保留并核对 | 恢复同一 thread | 保留 claim | ARCHIVE_PENDING | 升级 `00` 人工 ghost 恢复
- `task:check` 结果：未运行 | 无冲突 | 软冲突及通知 `00` 的集成顺序 | 硬冲突，未创建侧栏任务
- `task:claim --reservation`：未登记 | 已从 reservation 转换 | legacy active claim 兼容保留 | 不适用（只读）
- REVIEW commit list：未冻结 | 已确认精确等于 baseline..任务 HEAD 的完整有序列表（无遗漏/错序/重复）
- 机械 closeout：不适用 | reviewer PASS 后以 sole-parent `--closeout-commit` 仅移动 active→completed 验收单并更新 completed/README；不得混入其他文件
- `task:release`：未释放 | 已由 `00` 以 integrated（完整受审列表 + closeout 如有 + 中央 HEAD 保序一对一 stable patch-id 映射 + 最终树/净 diff 等价 + final regression passed）/cancelled（explicit confirmation）证据释放
- `task:archive`：未开始 | RELEASED 待归档 | ARCHIVE_PENDING | ARCHIVED

## 用户问题

<原始问题，保留业务语义。>

## 目标

-

## 非目标

-

## 证据与现状

- 代码：
- Git：
- 测试/运行：
- 文档/历史线索：

## 影响范围

- 模块：
- 文件：
- 数据格式：无 | 有，说明
- 平台：

## 风险

- 风险档：R0 | R1 | R2 | R3
- 请求模型：Luna | Terra | Sol | 其他（说明）
- 实际模型：<可观察值；不可观察时写“不可观察，未验证”>
- 请求 reasoning：Medium | High | XHigh | 其他（说明）
- 实际 selected reasoning：<可观察值；不可观察时写“不可观察，未验证”>
- Fast/priority：关闭 | 开启（原因）
- Ultra：关闭 | 开启（原因）
- Max/升级原因：无 | 连续两轮不收敛 | 范围升至数据/安全 | reviewer 发现 P0/P1 | 重大不确定性（说明）
- 独立只读 reviewer：<任务/对话/负责人；R2/R3 不得降级>
- 数据：
- UI/交互：
- 安全：
- 发布：

## 验收条件

- [ ]
- [ ] 相关自动测试通过。
- [ ] 需要的人工验证完成。
- [ ] 实现者之外的独立只读 reviewer 已完成，阻塞问题已关闭。
- [ ] 用户可见任务已执行 `npm run app:deliver`，并从固定 App 看到本次变化；不适用时已说明理由。
- [ ] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：
- 主应用模块参数：无 | camera / timeline / actor / 其他登记模块
- 最小命令：
- 升级到全量的条件：
- 人工检查尺寸/步骤：
- 固定 App 交付：需要 | 不适用；目标路径固定为 `~/Applications/PreVision.app`

## 实施记录

- 假设：
- 关键决定：
- 实际修改：
- 中断/恢复：无 | 原 task/thread/claim 的中断时间、恢复证据与下一责任人
- app-server 通知消费：未启动 turn | 已持续读取到 `turn/completed` | 断连后恢复同一 thread；不得作为 Desktop live 证据

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| | | | |

固定 App installed source：

固定 App 人工启动结果：

## 未覆盖与后续

-

## 交接

- 最终提交：
- PR：无 | URL
- reviewer 结论：未评审 | 未发现阻塞问题 | 有阻塞问题（列 P0–P3）
- 生命周期交接：REVIEW | HANDED_OFF（保持 claim） | INTEGRATING（仅 `00`） | RELEASED/ARCHIVE_PENDING/ARCHIVED
- 工作区状态：
- 下一步：
```
