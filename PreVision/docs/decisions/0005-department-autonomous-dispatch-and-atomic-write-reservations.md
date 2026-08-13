# ADR-0005：分管自治派发与原子写槽预留

- 状态：accepted
- 日期：2026-07-16
- 替代范围：替代 [ADR-0004](0004-short-lived-tasks-and-conflict-gate.md) 中“只有固定 `00` 可以创建和派发临时工”的决定；ADR-0004 的短期任务、侧栏可见、固定入口不得亲自实现、逻辑冲突分级、两个写任务上限和 `00` 集成交付边界继续有效。

## 背景

ADR-0004 把所有临时工创建集中到固定 `00`，解决了长期入口直接编码和并行语义冲突，但也让 Bug、功能、UI、工程四个分管入口的普通无冲突任务逐项等待中央批准。更严重的是，原 `task:check → 创建侧栏任务 → task:claim` 不是原子事务：固定 `01`–`04` 可能同时看到两个空槽并各自超发任务，等临时工 claim 时才发现容量已满。

侧栏任务由仓库外部系统创建，可能失败、返回 `no rollout found` 或出现结果不确定。协调登记还必须兼容升级瞬间已存在的 schema v1 active claims，不能用新制度让在途任务静默失效。

2026-07-17 的去敏反例证明：独立 `codex app-server --stdio` 客户端可以真实执行、调用工具、写入和测试，但 Codex Desktop 侧栏不一定显示 in-progress/圆圈或当前 turn 实时内容；另一独立客户端的 `thread/read` 还可能显示 `notLoaded` 或旧轮 interrupted。Desktop 主进程持有的 app-server stdio/socketpair 与 CLI daemon/proxy 不能假定共享 live 状态。因此“侧栏可见任务”和“侧栏可见运行”必须分离。

## 决定

1. 治理模式改为“分管自治、中央集成”。用户原则上只与固定 `00` 讨论，`00` 大部分时间保持可对话；固定 `01`–`04` 在各自部门范围内负责拆单、风险分级、自治派发用户侧栏可见的独立短期临时工、下达开工、组织独立只读 reviewer 和部门验收。普通无冲突任务成功 reserve 后可直接派发，只需通知固定 `00`。固定 `01`–`04` 保持“管理忙”，实际写入由更多侧栏临时工承担。
2. 固定 `01` 负责 Bug、复现和回归边界；固定 `02` 负责新功能、产品语义和数据契约；固定 `03` 负责 UI、交互、响应式和可访问性；固定 `04` 负责 Electron、测试、性能、构建和发布准备。
3. 固定 `00` 只保留全局优先级、跨部门硬冲突与集成顺序、提交接收和机械集成、最终回归、稳定预览、claim release、侧栏归档，以及用户明确授权后的正式 App 交付。
4. 固定 `00`–`04` **MUST NOT** 亲自编写业务/工程实现、持有 write claim、在长期对话堆实现代码或自行集成。固定 `01`–`04` 可以 reserve、创建并命名 Codex 项目 Worktree 侧栏任务，并在尚未 claim 的创建失败事务中 cancel reservation。固定 `05` 和 `99` 继续只读。
5. 所有实际项目文件写入 **MUST** 由负责部门自治派发给有用户侧栏可见任务条目的独立短期临时工；任务条目存在、可打开和可归档不等于当前 turn 由 Desktop 实时显示。内部 collaboration/sub-agent 仍只用于只读审计、代码审查、测试复核和调研，不得修改、提交或持有 write claim。
   每个任务对应一个可独立验收结果，不预建空任务。
6. 正式协调登记使用严格 `schemaVersion: 3`、`coordinationVersion: 3`、revision、claims、reservations、tasks 与 integrity issues。reservations/tasks 缺失、为 null 或非数组都 fail closed；只迁移真正的 claims-only schema 1、schema 2 reservation 登记和精确的 04.9 首版 schema 1/coordinationVersion 3 预览格式，预览中的 integrity issues 必须完整保留，额外关键字段拒绝。旧 c037 脚本会把未知 schema 当空登记，且既有 `package.json` 不会自动调用新代码，因此新版先在 `<registry>.lock` 放置 0700 持久目录 guard/0600 marker 阻断旧写，再由 `00` 运行 `task:migrate-legacy-worktree`；迁移仅在目标 HEAD、协调脚本和全部 `task:*` npm 入口与受信来源精确一致、且目标 Worktree 可证明 clean 时，才把原标准 npm 入口替换为只读 shim，额外或改写入口一律拒绝。shim 通过 Git common-dir 中版本化 0600 只读 launcher 执行最新 `status/check`，不绑定创建任务 Worktree 的绝对路径；未迁移旧 Worktree 的空结果非权威，write 入口禁用。regular-file preview guard 不得在线双 rename 换型；新版直接 fail closed，只允许 `00` 在证明所有旧 writer 已停止的离线窗口备份、换型和 fsync 父目录。
7. v3 lock 记录 PID、固定 `LC_ALL=C`、`LANG=C`、`TZ=UTC0` 的进程启动身份、随机 nonce、device/inode，绝不保存 command/argv 或 token/thread/client 参数。marker 先完整写入 0600 candidate 并 fsync，再以 hard link 原子发布；reader 使用 `O_NOFOLLOW` fd、前后 fstat 与路径 inode 一致性，对瞬时 ENOENT/ESTALE 有界重试。跨版本 identity 不可比较或不匹配时，只要 PID 明确存活就必须等待，绝不能 unlink；只有 PID 明确不存在且 stale marker/inode 仍一致才可恢复。活跃 owner 不因 mtime 变旧而被接管；stale 恢复和释放在 recovery guard 内重新确认 owner、identity 与 inode/marker。崩溃遗留 candidate/hardlink 只在 owner 明确不存在时清理；稳定 malformed、symlink、非 0600、进程身份 UNKNOWN 和异常 recovery guard 一律 fail closed。
8. 写入使用 0600 临时普通文件、file fsync、原子 rename 和 directory fsync，并生成可查询 revision。rename 已可见但 directory fsync 失败属于不确定提交：命令返回 token、revision 与 `persistence=uncertain`，调用方先用 status 查询该 revision，禁止按普通失败盲目重试。
9. active write claims、未过期 reservations 与未解决 ACTIVE-without-claim 隔离项共同占用最多两个写槽；该隔离项只有 `00` 留下可审计停止证据后才可解决。`reserve` 在锁内同时检查容量、重复 task 和模块/UI/数据硬冲突，然后使用 common-dir 0600 恢复密钥、reservation id、request-key 哈希和 generation 派生随机不可猜 token，登记只保存 SHA-256、owner、task、title、精确且真实存在的 baseline、完整范围、创建时间、TTL 和 request-key 哈希。stdout 断连后，同一 request key 和完全相同规范的串行或并发 replay 返回同 generation、同一仍可用 token，不重复占槽；同 key 不同规范拒绝。取消/过期 tombstone 阻断旧 request/token，但新 request key 可合法重派同 task ID。第三个并发 reserve 在创建侧栏任务前失败。
10. owner 只允许 `01`–`04`。task、owner、title、baseline 和范围在写前 canonicalize/严格校验；canonical one-line 不允许首尾空格、TAB、ESC、C0/C1、U+2028/U+2029 或超过字段上限。reservation 默认 TTL 为 30 分钟；只有 reservation 可过期。过期 reservation 释放槽但保留记录和 task 唯一性，必须显式 cancel 后才能替代。active claim 永不自动过期。
11. 标准外部事务是 `reserve → 立即创建/命名真实侧栏 Worktree 临时工 → claim`。若暂时等待开工信号，在真实 thread 写入 `WAITING / 等待谁` checkpoint；若由外部 app-server 施工，标题或状态明确“后台施工”。临时工使用 token，并提交与 reservation 完全一致的 task、title、精确 baseline、modules、surfaces、data、files、thread id 和 client id。claim 在锁内用一个原子替换把 reservation 转成 active claim，不重复占槽。
12. 错误 token、过期 token、基线/范围不一致、转换时出现新硬冲突或写入失败必须 fail closed，且不得丢失 reservation 的可恢复状态。已转换 token 不能 cancel；active claim 仍只能由 `00` 在集成成功或确认取消后 release。
13. 升级前的 schema v1 active claim 作为 `owner=legacy` 保留、占槽且永不自动过期。相同 task、branch、baseline 和范围的新版兼容命令可幂等确认，不会重建登记；任何新 task ID 的普通 write claim 必须先 reserve。旧 release 删除任何 owner 的 write claim、遗留 claim-state lifecycle 时，都按 ACTIVE-without-claim 结构迁移为 integrity issue，不伪造 release evidence，也不允许静默复用。
14. 权威生命周期是 `RESERVED/WAITING → ACTIVE → REVIEW → HANDED_OFF → INTEGRATING → RELEASED → ARCHIVE_PENDING → ARCHIVED`，并独立记录 execution visibility：`DESKTOP_LIVE`、`BACKGROUND_ONLY`、`WAITING`、`UNKNOWN`。history 必须逐项连续、转换合法，尾项与当前 state/actor/reason/time/external/stop verification 完全一致。`DESKTOP_LIVE` 必须同时具备 canonical taskId/threadId/clientId、rollout/thread DB/sidebar present、name=set、`turnOwner=desktop`、started turn 和 `desktopLiveObserved=true`；任一证据缺失或失效都不得保持 live。canonical thread/client 一旦建立，非终态不可清空或替换；不同非 terminal task 的 canonical threadId 必须唯一，client id 单独可复用。只读 reviewer 不持久化权威 read claim；兼容期 read claim 有显式清理路径。
15. status/check 同时展示写槽、claim、active/expired reservation、生命周期、owner、下一责任人和登记类型，并报告登记内已有冲突。模块、UI 或数据重叠为硬冲突；输出必须包含 owner、任务、重叠范围、后果和推荐顺序。只有文件重叠仍为软冲突，并通知 `00` 固定机械集成顺序。
16. app-server 协议为 `thread/start → thread/name/set → turn/start`。一旦 turn 启动，客户端必须持续消费通知直到 `turn/completed`，不能在 start 成功后立即断连；这只证明后台连接完整性和落盘，不是 Desktop 圆圈、实时刷新或流式窗口的证据。只有受支持的 Desktop 控制能力，或用户/分管入口在 Desktop 中实际启动并观察当前 turn，才可登记 `DESKTOP_LIVE`；否则施工为 `BACKGROUND_ONLY`。
17. 补偿按外部进度决定：`thread/start` 失败或结果不确定时默认保留 reservation；cancel 除三方 missing/missing/absent 与 `--compensation-confirmed yes` 外，还必须证明 turn 为 `not-started/none`，或先通过独立 `task:verify-stop` 持久化 completed、原 desktop/background owner 已停止和证据。cancel 不接受同命令覆盖 turnState/turnOwner，成功后保留 actor/reason/evidence tombstone。started、disconnected、unknown 或 owner 未核实一律保留同一任务。thread 已创建但命名/turn 失败时保留 RESERVED 并恢复同一 thread；turn 已启动但断连时保留 WAITING/ACTIVE 和 reservation/claim；后台 turn 成功但 Desktop live 缺失时保留同一 thread/claim并标记 `BACKGROUND_ONLY`；归档失败进入 ARCHIVE_PENDING。
18. 一次去敏的真实 ghost 故障样本中，rollout 与 state DB/thread 记录缺失，但 renderer 全局侧栏状态留有 heartbeat permission、thread description、thread-client-id 三类孤立 atom 键，导致 continue/archive/delete 以 `no rollout found` 或 `failed to resolve rollout path` 失败。只有三方核对后 sidebar 已 absent、且任务尚未 claim 时，才可 `--compensation-confirmed yes` cancel；严禁把盲目重建当修复。ADR 不保存真实标识、用户绝对路径、全局状态内容或本机日志。
19. 任务停滞先恢复同一任务并保留 claim；WAITING 过期可在锁内重新检查容量和冲突后续期同一 reservation/thread。只有 `00` 确认取消并 release 后才可替代。重复任务只保留拥有 reservation 或 claim 的规范任务；ARCHIVE_PENDING 只重试归档。
20. 核心数据语义、安全、许可证、公开发布、正式交付和跨部门硬冲突必须升级给 `00`/用户。
21. 每个写任务必须有实现者之外的独立只读 reviewer；R2/R3 reviewer 不得降级。模型与额度按 `docs/CODEX_MODEL_ROUTING.md` 路由，模型等级不得作为验收证据。
22. 进入 REVIEW/HANDED_OFF/INTEGRATING/RELEASED/ARCHIVED 前必须有独立持久化的 completed-turn stop verification；started/disconnected/unknown 不得终态。REVIEW→ACTIVE 必须同时清除旧 review/stop evidence，当前返工轮次即使未显式启动新 turn，也必须重新 verify-stop。ACTIVE→REVIEW 固化的 task commit/list 必须精确等于 baseline..任务 HEAD 的完整有序集合；HANDED_OFF 由独立 reviewer 接受同一列表。review PASS 后若需要移动验收单，只允许单独的 strict mechanical closeout commit：唯一父提交为 reviewed HEAD；reviewed active 内容除唯一 active→completed 状态迁移外必须逐字保持，completed/README 只能保留原内容并追加一条规范链接，两对文件前后都必须是 mode `100644` 的常规 Markdown blob。closeout evidence 写入及每次 registry 读取都从 Git 对象重算并逐字段核对，同时绑定当前 write claim 的 canonical pair/scope；终态无 claim 时绑定 release 保存的 scope snapshot/fingerprint。`RELEASED`、`ARCHIVE_PENDING`、`ARCHIVED` 都必须有有效 release outcome/evidence：actor 为 `00`；integrated 需要中央分支当前 HEAD 为受审列表与 closeout（如有）提供保序一对一 stable patch-id 映射；任务净变化用 NUL 分隔、关闭 rename 检测收集前后路径，并逐路径核对 task/integration Git tree entry。所有权威 Git 对象证据命令强制 raw-object 语义，replace refs 不得改写 commit、patch 或 tree 判定；cancelled 需要显式确认。子集、错序、重复/复用、add→revert→add 缺项、taskCommit=integrationCommit、全零、仅格式正确但不存在、malformed 或伪造 terminal record 不得继续 archive。

## 替代方案

- 继续由 `00` 逐项创建任务：安全但形成不必要的中央排队，拒绝。
- 只增加文档、保留 check 后 claim：不能消除同时看见空槽的竞态，拒绝。
- 允许分管入口直接持有 claim 或编写实现：重新污染长期上下文并破坏独立任务审计，拒绝。
- reservation 自动创建侧栏任务：仓库无法安全控制 Codex 外部系统，也无法处理不确定结果，拒绝。
- active claim 设置 TTL：可能在临时工停滞或长测时释放真实写所有权并制造副本，拒绝。
- 保存明文 token 到 status：扩大泄露面，拒绝。登记只保存哈希；调用方用幂等 request key 和 0600 恢复密钥重算同一 token，不能把明文 token 持久化到登记，也不能通过轮换让并发成功响应互相失效。

## 后果

- 四个分管入口可在不等待 `00` 逐项批准的情况下自治派发普通任务，同时仍受全局两个写槽和逻辑冲突约束。
- reserve 把容量检查提前到外部侧栏创建之前；第三个并发派发不会制造无 claim 的坏任务。
- 外部创建失败需要按进度显式补偿，分管入口必须保存 request key、当前 token 和 task/client/thread 去重键；stdout 断连按 request key 恢复，外部结果不确定时先三方核对再处理。
- 过期 reservation 会释放容量但留下可审计记录；task ID 不会因过期被静默复用。
- legacy active claims 可平滑跨越升级提交；新版兼容语法只能幂等确认已有 legacy claim，新任务无法用它绕过 reservation。持久 legacy write guard 阻止旧 Worktree 脚本把 v3 误读为空后覆盖登记。
- `00` 的工作从逐项派发收敛到全局优先级、跨部门冲突、机械集成和最终交付。
- 仓库生命周期让 waiting、review、交接、集成和归档失败可查询、可恢复；侧栏镜像分裂时不会自动删除或制造副本。
- 自治派发可以自动后台施工，但当前 Codex 产品能力不能保证外部 app-server 与 Desktop renderer 共享 live 状态；`DESKTOP_LIVE` 必须基于实际观察，不能从 `turn/completed`、rollout 或 daemon/proxy 推断。

## 验证方式

- `npm run test:coordination`
- `npm run test:foundation`
- 三个真实并发 Node 子进程 reserve，断言恰好两个成功。
- active claim + reservation + ACTIVE-without-claim 隔离项共同占用写槽；存在未解决隔离项时新 reserve 全局 fail closed。
- 覆盖重复 task、非法 owner、非 canonical/超长/多行输入、错误/过期 token、基线/范围不一致、malformed v3、dangling symlink、严格 0600 和残留锁恢复。
- 真实调用 c037 旧脚本的 claim/release，证明升级前 legacy claim 可迁移、升级后旧 writer fail closed 且登记字节不变。
- 覆盖跨时区活跃 holder、mtime 变旧、stale-check/新 holder 接管、旧 holder 迟到释放、崩溃 candidate/hardlink 清理和三个并发进程，证明 identity/inode 互斥且双槽不超发。
- 覆盖 claim 原子转换、转换失败保留 reservation、active claim 不受 TTL、schema v1 legacy claim 幂等兼容。
- 并发执行 reserve/cancel/claim/status，最终登记仍为有效 JSON 且槽计数正确。
- 模拟 `reserve → 侧栏创建失败 → cancel`，确认槽恢复且没有 active claim。
- 覆盖 WAITING、ACTIVE、REVIEW、HANDED_OFF、INTEGRATING、RELEASED、ARCHIVE_PENDING、ARCHIVED 的合法/非法转换、history 连续性和独立 stop verification，断言 running turn 不能终态且 claim 保持到 `00` release。
- 用真实临时 Git 仓库生成 task commit 与中央 cherry-pick，验证 REVIEW/HANDED_OFF 精确 commit list、stable patch-id 等价映射和中央 HEAD 约束；taskCommit=integrationCommit 必须拒绝。
- 覆盖 stdout 断连后的 request-key single-flight token 恢复、取消后同 task ID 新 request-key 重派、canonical thread/client 非终态不可清空或替换、baseline 对象存在性、schema 1 preview integrity issues 保留，以及真实 c037 标准 npm status/check 经显式迁移使用 common-dir 只读 launcher。
- 模拟 thread/start UNKNOWN、thread/name 失败、turn 启动后断连、ghost 三方分裂和归档失败，不创建真实坏侧栏任务、不修改用户全局配置。
- 覆盖缺失/未知 execution visibility 不能显示为 `DESKTOP_LIVE`，turn completed/sidebar absent/terminal 会失效，并证明 `BACKGROUND_ONLY`、`WAITING`、REVIEW、双槽、claim 和 archive 语义彼此独立。
- 覆盖 terminal release evidence 缺失、伪造或 malformed 时拒绝 status/archive。
- 独立只读 reviewer 按 `docs/CODE_REVIEW.md` 复审 R3 实现。

## 撤销条件

当 Codex 外部系统提供具备同等原子容量、冲突和补偿语义的可信事务 API，或主应用拆分后可按模块独立配置写槽时，可新建 ADR 替代本决定。不得回写本 ADR 掩盖历史。
