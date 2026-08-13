# 开发流程

## 核心规则

PreVision 采用“分管自治、中央集成”。用户原则上只需与固定 `00` 讨论；`00` 大部分时间保持可对话，把 Bug、功能、UI 和工程任务分别交给固定 `01`–`04` 管理。固定 `01`–`04` 在自己的职责范围内讨论、拆单、风险分级、原子预留写槽、自治派发有用户侧栏可见任务条目的独立短期临时工、下达开工、组织独立只读 reviewer 和部门验收；普通无冲突任务不逐项等待固定 `00` 批准，成功 reserve 后直接派发并通知 `00`。

固定 `00` 只保留全局优先级、跨部门硬冲突与集成顺序、提交接收和机械集成、最终回归、稳定预览、claim release、侧栏归档，以及用户明确授权后的固定 App 正式交付。固定 `01`–`04` 保持“管理忙”，实际写入由更多侧栏临时工承担。固定 `00`–`04` **MUST NOT** 亲自编写业务或工程实现、持有 write claim、在长期对话堆实现代码或自行集成。固定 `05` 和 `99` 继续只读。

每个实际写任务使用：一个精确 reservation、一个用户侧栏可见的独立短期临时工任务、一份任务描述、一个独立 Codex 对话、一个 Git 分支、一个 Codex 项目 Worktree、一个验收单、一个 write claim 和一个实现者之外的独立只读 reviewer。

- **侧栏可见任务**：独立任务条目、thread/rollout 和归档入口存在，用户可以找到并打开该任务。任务条目存在不证明当前 turn 正在 Desktop 中实时运行。
- **侧栏可见运行**：Desktop 拥有当前 turn，且用户已实际观察到侧栏 in-progress/圆圈和当前 turn 内容实时刷新。只有这种证据才能登记 `DESKTOP_LIVE`。
- 外部 `codex app-server --stdio`、独立 daemon 或 proxy 完成 turn，只能证明后台执行和落盘完整性；默认登记 `BACKGROUND_ONLY`，不能据此声称 Desktop 圆圈、窗口流式更新或 live 状态。

任务按可独立验收结果创建，不预建空任务。

内部 collaboration/sub-agent 只能用于只读审计、代码审查、测试复核和调研，**MUST NOT** 修改项目文件、创建实现提交或持有 write claim。需要写入的发现必须回到负责部门，由该部门另行自治派发侧栏可见任务。

任务之间不共享“只有聊天里知道”的状态。基线、范围、风险、模型路由、reviewer、测试和交接结论必须进入代码、文档、QA 登记或验收单。

## 固定入口职责

| 标号 | 固定入口 | 自治职责 | 必须升级 |
| --- | --- | --- | --- |
| 00 | 项目总协调与集成交付 | 全局优先级、跨部门冲突与集成顺序、机械集成、最终回归、稳定预览、release/归档、正式 App 交付 | 不派生实现语义，不亲自编码 |
| 01 | Bug 修复与回归 | Bug、复现、回归边界；独立拆单、reserve、创建并命名侧栏 Worktree 临时工、review 和部门验收 | 核心数据语义、安全或跨部门硬冲突 |
| 02 | 新功能设计与开发 | 产品语义、数据契约；独立拆单、reserve、创建并命名侧栏 Worktree 临时工、review 和部门验收 | 数据迁移、安全、许可证或跨部门硬冲突 |
| 03 | UI 与交互体验 | UI、交互、响应式、可访问性；独立拆单、reserve、创建并命名侧栏 Worktree 临时工、review 和部门验收 | 跨部门硬冲突或核心业务语义变化 |
| 04 | 工程、构建与发布 | Electron、测试、性能、构建、发布准备；独立拆单、reserve、创建并命名侧栏 Worktree 临时工、review 和部门验收 | 安全、公开发布、正式交付或跨部门硬冲突 |
| 05 | 专项入口 | 只读讨论、澄清、分类、验收口径 | 所有写任务转给 `01`–`04`/`00` |
| 99 | 历史开发归档 | 只读线索 | 不得作为当前状态来源 |

固定 `01`–`04` 可以运行 `task:status`、`task:check`、`task:reserve` 和对尚未 claim 的 reservation 执行 `task:cancel-reservation`，但不得代替临时工运行 `task:claim`。固定 `00`–`04` 都不得持有 write claim；active claim 只属于侧栏可见临时工。

## 权威生命周期

仓库 common-dir 登记是任务状态的权威来源；侧栏标题、首条状态和聊天文本只是用户可观察镜像。`task:status` 必须至少区分：

```text
RESERVED / WAITING → ACTIVE → REVIEW → HANDED_OFF → INTEGRATING
                                                    → RELEASED → ARCHIVED
                                                                 ↘
                                                        ARCHIVE_PENDING
                                                                 ↓
                                                             ARCHIVED
```

- `RESERVED`：写槽已原子预留，固定 `01`–`04` 的下一责任是立即创建、命名真实侧栏任务。
- `WAITING`：真实 rollout/thread/任务条目存在但尚未施工；可用短 checkpoint 写明 `WAITING / 等待谁` 并消费到 `turn/completed`，但这不证明 Desktop live。仍由 reservation 占槽。
- `ACTIVE`：同一 thread 已开工并把 reservation 原子转换为 claim；执行可见性必须另行显示为 `DESKTOP_LIVE` 或 `BACKGROUND_ONLY`。
- `REVIEW`：实现和任务级验证完成，独立只读 reviewer 负责；claim 保留。
- `HANDED_OFF`：review 和部门验收已完成，下一责任人为 `00`；claim 保留。
- `INTEGRATING`：只能由 `00` 进入，表示机械集成和最终回归进行中；claim 保留。
- `RELEASED`：`00` 已确认集成及最终回归成功，或明确确认取消，并完成 claim release。
- `ARCHIVE_PENDING`：release 已完成，但外部侧栏归档失败；保留同一 task/thread，可重试，不得重建。
- `ARCHIVED`：`00` 已验证侧栏归档成功。worker 完工或 reviewer 通过均不得提前进入此状态。

三个 terminal 状态都必须保留结构化 release evidence：actor 必须为 `00`；integrated 必须绑定 REVIEW/HANDED_OFF 接受的精确 task commit list、中央集成 HEAD 中唯一且不同对象的 stable patch-id 等价映射和 `finalRegression=passed`；cancelled 需要显式 cancel confirmation。缺失、伪造或 malformed evidence 的 terminal record 不得 status 为健康状态，也不得继续 archive。

生命周期之外还必须记录独立的执行可见性：

| execution visibility | 含义 | 可接受证据 |
| --- | --- | --- |
| `DESKTOP_LIVE` | Desktop-owned 当前 turn 正在运行 | 存在受支持的 Desktop 跨任务启动能力，或用户/分管入口在 Desktop 中实际启动并观察到圆圈和实时内容；协调器还要求显式 `desktopLiveObserved=true` |
| `BACKGROUND_ONLY` | 外部 app-server/后台客户端执行或已完成，Desktop live 状态不保证 | 后台客户端、rollout 和工具调用证据；任务标题或状态必须明确“后台施工” |
| `WAITING` | 真实 thread/rollout 已存在，但尚未进入施工 turn | 短 checkpoint 可写明等待谁；`turn/completed` 仅证明该 checkpoint 连接完整 |
| `UNKNOWN` | 缺失、legacy 或未核验 | fail closed；不得展示或推断为 `DESKTOP_LIVE` |

`DESKTOP_LIVE` 必须同时满足 rollout present、`thread/list`/DB present、sidebar present、name=set、`turnOwner=desktop`、当前 turn 已 started、`desktopLiveObserved=true`。任一证据 missing/failed/unknown，或 turn completed/disconnected、sidebar absent/stale、release/archive，都会使 live 证据失效；没有新的显式证据时自动降级为 `UNKNOWN`，外部后台执行仍有证据时才可显式改为 `BACKGROUND_ONLY`。

每次状态转换必须在锁内记录 owner、时间、actor、下一责任人、原因、execution visibility、外部 `taskId/clientId/threadId` 去重键和失败补偿。执行可见性不改变双槽、claim、release 或 archive 语义。

## 原子写槽预留

协调登记保存在所有 Worktree 共享的 Git common-dir，不进入 Git 提交。active write claims、未过期 reservations 与未解决的 ACTIVE-without-claim 隔离项共同占用两个写槽；隔离项还会让新 reserve 全局 fail closed，直到 `00` 留下可审计停止证据。所有命令在同一锁内读取、检查和原子替换登记，因此第三个并发 reserve 会在创建侧栏任务之前失败。

reservation 默认 TTL 为 30 分钟，允许上限见 `qa/task-scope-taxonomy.json`。只有 reservation 可过期；active claim 永不自动过期。过期 reservation 释放写槽但保留记录，必须显式 cancel 后才能用相同 task ID 重新派发。

标准事务：

1. 分管入口运行 `npm run task:status`，形成精确 task、title、baseline、modules、surfaces、data、files 和风险档。
2. 可选运行 `task:check` 预览冲突；它只是只读建议，不能替代原子 reserve。
3. 分管入口用稳定幂等 request key 运行 `task:reserve`。成功后得到随机不可猜 token，并立即创建真实 rollout/侧栏任务，同时通知 `00` 当前 owner、任务和软冲突顺序。若 stdout 断连，用同一 request key 和完全相同规范恢复同 generation、同一仍可用 token；并发 replay 也必须返回一致 token，不能轮换出互相失效的响应、只在内存占位或重复占槽。
4. 分管入口用精确 title/client id 创建并命名用户侧栏可见任务，把 token 和完全相同的基线/范围交给临时工。若当前只能由外部 app-server 启动施工，标题或首条状态明确写“后台施工”，登记 `BACKGROUND_ONLY`；若尚待开工，登记 `WAITING`。
5. 临时工核对分支、HEAD、cwd、工作区和 `app:status`，从模板建立验收单。
6. 真正开工时，在同一 thread 启动下一 turn；临时工用 `task:claim -- --reservation <token>` 在锁内把 reservation 原子转换为 active claim。必须显式传入 `--execution-visibility BACKGROUND_ONLY`，或在实际观察 Desktop-owned 当前 turn 后传入 `DESKTOP_LIVE --desktop-live-observed yes`。缺失值为 `UNKNOWN` 并拒绝新 claim。
7. 临时工实现和测试后先用 `task:verify-stop` 独立持久化 `turn=completed`、原 owner 已停止和证据，再以 `--task-commit`/commit list 进入 REVIEW；独立 reviewer 只接受这组精确提交，部门验收完成后以同一 commit list 进入 HANDED_OFF。started、disconnected、unknown 不能进入 REVIEW/HANDED_OFF。claim 始终保留。
8. `00` 把任务转为 INTEGRATING，机械集成并运行最终回归；成功或明确取消后 release。只有 release 完成后才能归档，失败则进入 ARCHIVE_PENDING。

示例：

```bash
npm run task:reserve -- \
  --owner 03 \
  --request-key <分管入口生成的稳定幂等请求键> \
  --task 03.12-responsive-layout \
  --title "03.12｜响应式布局" \
  --source <40位精确baseline> \
  --modules layout \
  --surfaces app-shell,inspector,timeline \
  --data ui-preferences \
  --files 预见PreVision.html,i18n/locales/zh-CN.js,i18n/locales/en-US.js

npm run task:claim -- \
  --reservation <reserve返回的token> \
  --task 03.12-responsive-layout \
  --title "03.12｜响应式布局" \
  --source <同一40位baseline> \
  --modules layout \
  --surfaces app-shell,inspector,timeline \
  --data ui-preferences \
  --files 预见PreVision.html,i18n/locales/zh-CN.js,i18n/locales/en-US.js \
  --actor worker:03.12-responsive-layout \
  --next worker:03.12-responsive-layout \
  --reason "同一侧栏 thread 已收到正式开工 turn" \
  --thread-id <thread-id> \
  --client-id <client-id> \
  --rollout-state present \
  --thread-record-state present \
  --sidebar-state present \
  --name-state set \
  --turn-state started \
  --turn-owner background \
  --execution-visibility BACKGROUND_ONLY
```

新制度启用后，新的普通 write claim 不得绕过 reservation。正式登记使用严格 `schemaVersion: 3`、`coordinationVersion: 3`、revision、claims、reservations、tasks 与 integrity issues；其中 reservations/tasks 缺失、为 null 或非数组都必须 fail closed。升级瞬间真正的 claims-only schema 1、schema 2 reservation 登记，以及 04.9 首版 schema 1/coordinationVersion 3 预览格式可一次迁移；在途 legacy active claim 映射为 ACTIVE，继续显示、占槽且永不自动过期。若旧 release 已只删除 claim、遗留 ACTIVE lifecycle，新版把它保留为可查询的 `legacy-release-lifecycle-orphan` integrity issue，不能伪造 RELEASED 或静默复用 task ID。

旧 c037 脚本遇到未知顶层 schema 会把登记误读为空，因此不能只靠改 schema 号兼容；它的既有 `package.json` 也不可能凭空发现新协调器。新版先在旧脚本固定使用的 `<registry>.lock` 放置 0700 持久目录 legacy write guard 和 0600 marker，阻止旧 claim/release 改写 v3。随后由 `00` 在目标 Worktree HEAD、原协调脚本及全部 `task:*` npm 入口都与受信 commit 精确一致，且 staged/unstaged/untracked 状态可证明 clean 时执行 `npm run task:migrate-legacy-worktree -- --worktree <旧Worktree> --legacy-source <精确commit> --actor 00`；额外或改写的读写入口必须拒绝。迁移保留原 `npm run task:status` / `task:check` 命令名，把本地脚本替换为只读 shim，并从 Git common-dir 的版本化 0600 只读 launcher 运行最新协调器；launcher 不绑定创建它的任务 Worktree 绝对路径，创建任务归档或移动后仍可用。未迁移旧 Worktree 的 status/check 明确禁用为非权威，写命令始终 fail closed。旧版 regular-file preview guard 不能通过在线双 rename 换成目录，因为移走文件到放入目录之间会出现 c037 `open(wx)` 空窗；新版遇到该形态直接 fail closed。只有 `00` 建立全局停写窗口、证明所有旧 writer 已停止、备份并核对 inode 后，才可离线换型，完成后 fsync 父目录再恢复调度。

实际互斥使用独立 v3 lock。owner identity 只取固定 `LC_ALL=C`、`LANG=C`、`TZ=UTC0` 的 `ps lstart` 启动身份，不包含 command、argv、reservation token 或 task/client/thread 参数。lock marker 先写入 0600 candidate、file fsync，再用 hard link 原子发布；reader 使用 `O_NOFOLLOW` fd、前后 `fstat` 和路径 inode 一致性读取，对 holder 正常 unlink/replace 导致的 ENOENT/ESTALE 有界重试，稳定 malformed 仍 fail closed。跨版本时 identity 格式或时区可能不同，所以 PID 明确存活即视为活锁，不比较成功也不得 unlink；只有 PID 明确不存在且 marker/inode/stale 证据仍一致才可恢复。活跃 owner 无论 mtime 多旧都不能被接管；stale 恢复与释放都在 recovery guard 内重新校验 owner/identity/inode。只有 owner 明确不存在的 stale candidate/hardlink 可清理，活 PID candidate 保留。

登记写入先建立 0600 临时普通文件、file fsync、原子 rename，再 directory fsync，并为每次提交生成 revision。若 rename 已可见但 directory fsync 失败，命令返回成功但 `persistence=uncertain`，同时返回 token/revision；调用方必须用 `task:status` 查询该 revision并恢复同一事务。`reserve` 还必须使用稳定 `--request-key`，登记只存其哈希；common-dir 0600 恢复密钥与 reservation id/request-key hash/generation 共同派生 token。若 registry 已提交但 stdout 断连，同一 request key 和完全相同规范可幂等重算同一 token；两个并发 replay 的所有成功响应必须一致且继续可 claim/cancel。补偿取消或过期取消后，新 request key 可以重派同 task ID；旧 request/token 由 tombstone 阻断，不能复活或污染新 reservation。

## Codex app-server 协议与 Desktop 可见性边界

侧栏创建属于外部 app-server 事务，固定 `01`–`04` 必须遵守以下协议：

1. 用 task/client/thread 身份调用 `thread/start`，随后调用 `thread/name/set`。canonical `threadId` 在所有非 terminal task 中必须唯一；client id 单独可复用，但不同 task 不得包装同一 thread 重复占槽。
2. 若调用 `turn/start`，客户端必须持续读取通知直到对应 `turn/completed`；不得在 `turn/start` 返回成功后立刻关闭连接。该要求只证明外部后台任务完整执行与落盘，不证明 Desktop 实时可视。
3. 暂不施工时，在同一 thread 启动一个短 checkpoint，状态明确写 `WAITING / 等待谁`，消费到 `turn/completed` 后登记 WAITING。收到开工信号后在同一 thread 启动下一 turn，再转换 claim。
4. `thread/start`、命名或 turn 结果不确定时，先按精确 task title、client id 和 thread id 查询 rollout、`thread/list`/state DB 与 sidebar state；禁止盲目重试。
5. Desktop 主进程持有的 app-server stdio/socketpair 没有可假定代理的命名控制 socket；CLI daemon/proxy 是独立托管服务。除非出现受支持的 Desktop 跨任务控制工具，不能承诺从固定入口无需用户动作即可启动另一个 Desktop-owned turn。
6. 当产品能力不足以自动启动 Desktop-owned turn 时，允许继续后台施工并登记 `BACKGROUND_ONLY`；若任务必须实时可见，则保留同一 task/thread，等待一次受支持的 Desktop 启动或人工触发。人工触发只负责启动已有任务，不要求用户手动创建 Worktree。
7. 独立 app-server 的 `thread/read` 可能显示 `status.type=notLoaded` 或旧轮 interrupted，同时执行客户端仍在工作；这类分裂不能作为停止、复制任务或宣称 `DESKTOP_LIVE` 的依据。

## 冲突门禁

首次派发前声明四类范围：

- 模块：例如 `camera`、`timeline`、`layout`、`repository`。
- UI 表面：例如 `viewport`、`timeline`、`inspector`。
- 数据区域：例如 `shot-camera`、`project-v5`、`qa-metadata`。
- 文件：真实预计修改的仓库相对路径。

冲突分级：

- **硬冲突**：模块、UI 表面或数据区域重叠，active claims + reservations + orphan 隔离项已占满两个写槽，或存在未解决 ACTIVE-without-claim integrity issue。reserve 失败，不能创建侧栏任务。输出必须包含 owner、任务、登记类型、重叠范围、后果和推荐顺序。
- **跨部门硬冲突**：除上述信息外，必须升级给 `00` 决定全局优先级和集成顺序。默认先完成并集成已有任务；也可移除重叠范围后重新 reserve。
- **软冲突**：只有文件重叠。可并行，但分管入口必须通知 `00` 固定机械集成顺序；`00` 集成时保留双方验收语义和索引，并重新运行影响测试。
- **无冲突**：成功 reserve 后直接自治派发，不等待 `00` 逐项批准。

核心数据语义、安全、许可证、公开发布、正式 App 交付无论是否存在范围重叠，都必须升级给 `00`/用户。模型等级不能替代冲突判断或验收证据。

## 失败补偿、停滞和重复任务

侧栏创建是仓库外部系统，必须按补偿事务处理：

- `reserve` 成功但 `thread/start` 失败或结果不确定：默认保留原 reservation。只有明确核验 rollout=missing、`thread/list`/DB=missing、sidebar=absent，且 turn 明确为 `not-started`/`turnOwner=none`，或已 `completed` 且原 desktop/background owner 已核验停止，再传入 `--compensation-confirmed yes` 才可 cancel。started、disconnected、unknown 或 owner 未核实必须保留同一任务。
- `thread/start` 成功，但 `thread/name/set` 或首个 turn 启动失败：保留 RESERVED 和同一 thread/client id，恢复命名或 turn；不得立即 cancel 或创建副本。只有三方核对确认 rollout、thread/list/DB 均缺失，且 sidebar 精确孤立键已清理并验证 absent 后，才用 `--compensation-confirmed yes` cancel。
- turn 已启动但客户端断连：登记 `turnState=disconnected`，保留 WAITING 或 ACTIVE 及原 reservation/claim，重连同一 thread 并继续读取到 `turn/completed`；禁止另起任务。
- 后台 turn 成功、工具调用和落盘存在，但 Desktop 没有 in-progress/圆圈或当前 turn 实时内容：保留同一 thread 和 reservation/claim，登记 `BACKGROUND_ONLY`，用短阶段 checkpoint 更新 ACTIVE/REVIEW；禁止盲建副本。若必须实时可见，等待受支持的 Desktop 启动/一次人工触发。
- rollout 缺失但 renderer sidebar atom 残留：按下述 ghost task 人工恢复，不能把盲目重试当修复。
- 归档失败：任务保持 RELEASED/ARCHIVE_PENDING，由 `00` 对同一 task/thread 重试；不得重新 reserve。
- 如果外部创建结果不确定，先按精确 title/client id/thread id 搜索。找到已创建任务就恢复它；确认没有后才进入补偿。禁止盲目重试并制造副本。
- claim 转换时若 token 错误、已过期、task/baseline/范围不一致或出现新硬冲突，命令拒绝且保留 reservation 的可恢复状态；修正输入、解决冲突或显式 cancel。
- WAITING reservation 过期时，先恢复同一 task/thread；`task:transition --to WAITING --ttl-minutes <n>` 会在锁内重新检查容量和冲突后续期。不能用新 task ID 抢占替代槽。
- 临时工停滞时先恢复同一侧栏任务。active claim 保留，不能通过 TTL 自动释放，也不能另建副本占新槽。
- 只有 `00` 确认任务取消并 release 后，负责部门才可 reserve 替代任务。重复任务只保留拥有 reservation 或 active claim 的规范任务，其余归档。
- `cancel-reservation` 只能取消尚未转换的 reservation。它不得同时改写 `turnState/turnOwner`；started/disconnected/unknown 必须先恢复同一 thread，随后单独用 `task:verify-stop` 持久化 completed、owner、actor、reason 和停止证据。取消成功保留 tombstone，不能把历史擦成“从未发生”。已经转换的 active claim 只能由 `00` 在集成成功或确认取消后 `task:release`。
- ACTIVE-without-claim integrity issue 视为可能仍有 writer，计入隔离槽并阻止所有新 reserve。只有 `00` 使用 `task:resolve-integrity --stop-evidence ...` 留下可审计停止证据后才恢复容量。
- 只读 reviewer 使用 `check/status` 和测试证据，不创建权威 read claim。兼容期残留 read claim 只允许其记录 owner 或 `00` 显式清理，不能永久占用 task ID。

### 已知 ghost task 故障与人工恢复

一次去敏的真实 ghost 故障样本中，rollout 文件和 state DB/thread 记录均不存在，但 renderer 全局侧栏状态仍保留 heartbeat permission、thread description、thread-client-id 三类孤立 atom 键；继续、归档和 delete 都先解析 rollout，因此分别以 `no rollout found` 或 `failed to resolve rollout path` 失败。这是 authoritative rollout/DB 与 renderer sidebar state 分裂产生的 ghost task，不是可通过重试修复的普通创建失败。仓库只记录故障类别和恢复契约，不提交真实 task/thread 标识、用户绝对路径、全局状态内容或本机日志。

人工恢复必须由 `00` 升级处理，并严格执行：

1. 停止相关 Desktop 进程并备份全局状态文件；本仓库脚本不得自动修改用户全局 Codex 配置。
2. 三方核对：rollout 路径确实不存在；`thread/list` 与 state DB 确实无该 thread；sidebar atom 仍只剩该精确 task/thread 的孤立键。
3. 只删除该 ghost 的 heartbeat permission、thread description、thread-client-id 三个精确孤立 renderer atom 键，不做模糊搜索删除，不改其他任务。
4. 重启 Desktop，验证 sidebar 不再显示该项，rollout 与 DB 仍不存在，其他任务可继续/归档。
5. 只有尚未 claim、验证 sidebar 已 absent，且 turn 明确非运行、owner 已核验时，才记录三方状态并补偿 cancel reservation；若已有 claim，保留 claim 并升级 `00`，不得自动 release。

## 风险与模型路由

每个写任务在 reserve 前按 [Codex 模型与额度路由](CODEX_MODEL_ROUTING.md) 记录 R0–R3、请求/实际模型、reasoning、Fast/priority、Ultra、升级原因和 reviewer。实际模型不可观察时写“不可观察，未验证”，不得猜测。所有 canonical one-line 字段拒绝 TAB、ESC、C0/C1 控制字符和 U+2028/U+2029。

ACTIVE→REVIEW 时必须固化实现者提交的精确 `--task-commit` 或有序 commit list，且该列表必须等于 claimed baseline..任务当前 HEAD 的完整有序集合；子集、错序、重复项一律拒绝。REVIEW→ACTIVE 无条件清除旧 review evidence 和 stop verification，即使没有显式启动新 turn，再次 REVIEW 也要为当前返工轮次重新 `task:verify-stop`。HANDED_OFF 必须由独立 reviewer 对同一列表显式接受。若 reviewer PASS 后才移动验收单，允许额外传 `--closeout-commit`，但该 commit 必须以 reviewed HEAD 为唯一父提交：reviewed HEAD 中 active 存在且 completed 不存在；closeout 后 completed 内容只能发生一次确定性的 active→completed 状态迁移，completed/README 只能在原字节后追加该验收单的一条规范链接，验收单和索引前后都必须是 mode `100644` 的常规 Markdown blob。closeout evidence 在 HANDED_OFF 写入与每次 registry 读取时共用同一 Git 验证器，重算 parent、NUL 变更路径、tree entry 和内容迁移并逐字段核对；读取时还必须重新绑定当前 write claim 的 canonical active/completed pair 与 scope，终态无 claim 时改用 release 保存的 scope snapshot/fingerprint。`00` 以 integrated outcome release 时从中央集成分支当前 HEAD 验证受审提交与 closeout（如有）都有保持顺序的一对一、不同对象 stable patch-id 等价提交；任务净变化路径必须用 `--no-renames -z` 或等价方式收集完整前后集合，再逐路径比较 task HEAD 与 integration HEAD 的 Git tree entry（mode/type/object），不依赖文本 diff pathspec；对 commit existence、merge-base、rev-list、show/diff/patch-id、ls-tree 和 cat-file/blob 等权威证据统一强制 raw-object 语义，不接受 Git replace refs 改写。不可安全解析的路径 fail closed，claimed baseline 必须是中央 HEAD 的祖先，`finalRegression=passed`。taskCommit=integrationCommit、全零、仅格式正确但不存在或未绑定受审列表的对象都不是 release evidence。

每个写任务必须有实现者之外的独立只读 reviewer。R2/R3 reviewer 不得降级。只有连续两轮不收敛、范围升至数据/安全，或 reviewer 发现 P0/P1 时才升级模型或短时 Max。模型等级不得作为验收证据。

## 中文表达的默认阶段

| 用户常用表达 | 默认阶段 | 自治派发与中央集成 |
| --- | --- | --- |
| “继续调、先改改看、我看看效果” | 快速开发预览 | 负责部门 reserve 并派发临时工；临时工交接预览提交，`00` 集成后更新稳定预览，不替换固定 App。 |
| “检查一下、验证逻辑、有没有回归” | 相关验证 | 负责部门派发只读 reviewer 或短期验证任务；写验证工装仍需 reservation。 |
| “可以了、定稿、正式更新” | 最终验收 | 临时工提交干净成果；`00` 集成、最终回归并在用户授权后执行一次 `app:deliver`。 |
| “发给别人、发布版本、安装包、签名公证” | 对外发布 | 必须升级给 `00`/用户；由 `04` 派发发布准备临时工，`00` 统一交付发行产物。 |

有歧义时默认快速开发预览，不擅自正式打包；相关测试和 `test:i18n` 不能省略。

## 临时工实施步骤

### 1. 开工核对

- 核对 `pwd`、分支、精确 HEAD 和 clean 工作区。
- 阅读 `AGENTS.md`、入口文档、相关 ADR 和验收单。
- 使用 Node 20–24；安装依赖必须使用 `npm ci` 和锁文件。
- 运行 `npm run app:status` 与 `npm run task:status`。
- 从 `docs/TASK_TEMPLATE.md` 建立 active 验收单。
- 使用 reservation token 和完全一致的范围运行 `task:claim`；失败时不得写代码。

### 2. 实现

- 只做验收单范围内最小改动。
- 新增或修复行为必须增加真实自动测试。
- 用户文案只通过 language key；触及历史内联中文时同任务迁移。
- 发现旁支问题登记 `KNOWN_ISSUES`，不顺手扩大重构。

### 3. 验证和 review

- 先按 `qa/test-impact-map.yaml` 运行最小测试，再按风险升级。
- 每个任务至少运行 `npm run test:i18n`。
- 数据结构、跨模块、Electron IPC、安全、发布和复杂集成使用全量回归。
- 运行 `git diff --check`、JSON/YAML 解析、敏感信息/绝对路径和意外文件检查。
- 独立只读 reviewer 按 `CODE_REVIEW.md` 输出 P0–P3 结论；实现者修复后补充复核证据。

### 4. 提交和部门验收

- 填写验收单实际命令、结果、风险、模型路由、reviewer 和未覆盖范围。
- 创建一个聚焦提交，不提交 `node_modules/`、`out/`、`dist/`、日志、密钥或本机配置。
- 部门验收确认范围、测试和 reviewer 结论后通知 `00`，交接分支、提交、基线和软冲突顺序。
- 临时工保持 claim，不自行 release、集成或更新固定 App。

## `00` 中央集成与固定 App

`00` 从最新集成线机械接收已验收提交，只可保留双方已验收语义地解决文本冲突，不能借集成扩展功能。它先把 HANDED_OFF 任务转为 INTEGRATING，运行最终影响/全量回归并更新稳定预览。集成成功时：

```bash
npm run task:release -- \
  --task <任务ID> \
  --actor 00 \
  --outcome integrated \
  --task-commit <REVIEW/HANDED_OFF 固化并接受的精确任务提交；多提交用 --task-commits> \
  --integration-commit <40位集成提交> \
  --final-regression passed \
  --next 00-archive \
  --reason "机械集成和最终回归已完成"
```

release 后才尝试归档，并用 `task:archive -- --result success|failed` 记录结果。归档失败进入 ARCHIVE_PENDING；自动归档只能在集成、最终回归和 release 全部成功后执行。用户明确表达“正式更新/安装到平时打开的软件”时，`00` 才使用 Node 20–24 执行一次：

```bash
npm run app:deliver
```

该命令完成全量测试、来源谱系检查、macOS arm64 构建、固定入口更新、校验和自动启动。临时工不得运行 `app:deliver`。纯文档、纯测试或不改变安装包的仓库治理任务可跳过，但验收单必须说明。

## GitHub 与归档

GitHub 已连接时只推任务分支并创建 PR，不自动合并、强推或覆盖远程分支。未连接时保留本地提交和清晰交接。

临时工完成实现和任务级验证后，先保持验收单在 `active/` 且生命周期转为 REVIEW，等待独立 reviewer。reviewer 阻塞关闭并完成部门验收后，才把验收单状态改为 `completed`、移动到 `docs/plans/completed/` 并更新索引；这表示成果可交接，不表示已经进入固定 App。`00` 集成成功后 release claim 并归档侧栏任务。
