# 任务：04.9｜分管入口自治派发与额度路由

- 状态：completed（R5 三项最小补正完成，等待新的独立只读 R3 复审）
- 日期：2026-07-16；收口日期：2026-07-17
- 对话：04.9｜分管入口自治派发与额度路由
- 分支：chore/04.9-autonomous-dispatch-model-routing
- 基线：c037a4b32ddc4557336f27af44300633281e2df4
- 固定 App 来源：7ff9aa583b4e51fb4d888aa1815792b747d275d7
- 负责人：PreVision 用户侧栏可见独立短期工程治理临时工

## 并行任务声明

- 任务 ID：04.9-autonomous-dispatch-model-routing
- 模式：write
- 分管 owner：04；本任务在新制度启用前已登记，权威 claim 以 `owner=legacy` 兼容保留
- 模块：repository, testing
- UI 表面：无
- 数据区域：qa-metadata
- 当前/预期修改文件：
  - `AGENTS.md`
  - `docs/CODE_REVIEW.md`
  - `docs/CODEX_MODEL_ROUTING.md`
  - `docs/CURRENT_STATE.md`
  - `docs/DEVELOPMENT_WORKFLOW.md`
  - `docs/INDEX.md`
  - `docs/TASK_TEMPLATE.md`
  - `docs/decisions/0005-department-autonomous-dispatch-and-atomic-write-reservations.md`
  - `docs/decisions/README.md`
  - `docs/plans/active/2026-07-16-autonomous-dispatch-model-routing.md`
  - `docs/plans/completed/2026-07-16-autonomous-dispatch-model-routing.md`
  - `docs/plans/completed/README.md`
  - `package.json`
  - `qa/task-scope-taxonomy.json`
  - `qa/test-impact-map.yaml`
  - `scripts/task-coordination.mjs`
  - `测试/并行任务协调测试.mjs`
  - `测试/仓库基础测试.mjs`
- reservation：不适用；ADR-0005 实现前已按 legacy 流程登记 active claim
- 权威生命周期：REVIEW
- 当前 actor / 下一责任人：worker:04.9-r5-correction / independent-readonly-r3-reviewer
- 状态更新时间 / 原因：2026-07-17；R5 独立 reviewer 拒绝受审提交 `40d4d71` 的三个定向阻断后，同一任务 REVIEW→ACTIVE 并作废旧 review/stop evidence；最小补正、重新 stop verification 与全量验证完成后回到 REVIEW，claim 继续占槽
- 侧栏去重证据：同一 task/client/thread 身份已在本机核对并去敏；未提交精确值
- 外部三方状态：当前 canonical 任务已由 `00` 核对为唯一连接；仓库不提交 rollout 路径、thread/list/DB 内容或 sidebar atom 内容
- 侧栏命名 / turn：同一任务恢复；本轮返工使用同一 canonical 任务并在补正后停止，后台连接完整性与 Desktop live 可见性继续分开记录
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：未观察；Desktop 侧栏没有当前任务圆圈或 turn 实时内容，不能宣称 `DESKTOP_LIVE`
- turn stop verification：R5 返工恢复 ACTIVE 时旧证据已清除；本轮补正完成后重新独立持久化 completed/background、actor/reason/evidence，未复用上一轮证据
- WAITING 首轮：不适用；本任务是制度启用前已 ACTIVE 的 legacy claim
- 失败补偿：三个 interrupted turn 均恢复同一任务、同一 Worktree 和同一 claim；未重建副本
- `task:check` 结果：仅与 03.11 在 `docs/plans/completed/README.md` 文件软冲突；`00` 机械集成时保留双方索引，建议顺序为 03.11 后 04.9
- `task:claim --reservation`：legacy active claim 兼容保留
- `task:release`：未释放；等待独立 reviewer 和 `00` 集成
- `task:archive`：未开始；只有 `00` 集成、最终回归和 release 后才可归档

## 用户问题

把固定入口治理改为“分管自治、中央集成”：固定 `01`–`04` 在部门范围内自治分析、原子 reserve、创建并命名侧栏可见临时工、下达开工、组织独立复审和部门验收；固定 `00` 保留全局优先级、跨部门硬冲突、机械集成、最终回归、release/归档和正式 App 交付。仓库需要提供可恢复生命周期、外部 app-server 补偿事务、ghost task 人工恢复契约，以及 R0–R3 模型与额度路由。

## 目标与结果

- 已建立 Git common-dir 内的原子双槽门禁；active claims 与未过期 reservations 共同最多两个。
- 已实现 `reserve`、`claim --reservation`、`cancel-reservation`、`transition`、`archive`，并扩展 `status/check/release`。
- 已建立 `coordinationVersion: 3` 权威生命周期：`RESERVED/WAITING → ACTIVE → REVIEW → HANDED_OFF → INTEGRATING → RELEASED → ARCHIVE_PENDING → ARCHIVED`。
- 已固化 owner、actor、时间、下一责任人、原因、外部三方状态和 task/client/thread 去重键；claim 从 ACTIVE 保持到 `00` release。
- 已固化 `thread/start → thread/name/set → turn/start → turn/completed` 协议、WAITING 同 thread 恢复、断连恢复、归档重试和 ghost 三方核对。
- 补正后独立记录 `DESKTOP_LIVE`、`BACKGROUND_ONLY`、`WAITING`、`UNKNOWN`；任务条目存在与 Desktop 实时运行不再等同。
- 已新增 ADR-0005 和模型路由规范，并更新入口文档、评审、模板、状态、索引、taxonomy 与 impact map。

## 非目标

- 未修改 PreVision 业务、UI、Electron 运行时或用户数据。
- 未创建真实失败侧栏任务，未修改用户全局 Codex 配置。
- 未运行 `app:deliver`、`app:update`、`package`、`make`、部署或公开发布。
- 未释放本任务或其他 active claim。

## 关键实现

- 正式登记升级为严格 `schemaVersion: 3` + `coordinationVersion: 3` + revision/updatedAt/claims/reservations/tasks/integrityIssues；只有真正 legacy claims-only、schema 2 和首版预览格式可迁移，malformed v3 不静默补空。
- 真实 c037 旧脚本固定使用的 `.lock` 路径采用 0700 持久目录 guard/0600 marker 阻断旧写；`00` 用 `task:migrate-legacy-worktree` 核对精确 HEAD/脚本后，把原标准 npm status/check 迁移到 Git common-dir 版本化 0600 只读 launcher，launcher 不绑定 04.9 Worktree 路径。regular-file preview guard 不在线换型，只允许 `00` 在证明旧 writer 全停的离线窗口处理。新版 v3 lock 的 identity 固定 `LC_ALL=C`、`LANG=C`、`TZ=UTC0` 且只含启动时间，不含 command/argv；marker 完整 fsync 后原子发布，reader 用 fd/inode 一致性与有界 ENOENT/ESTALE 重试。跨版本 identity 不匹配时只要 PID 存活仍不得 unlink；stale candidate/hardlink 只在 owner 明确不存在时清理。
- 写入使用严格 0600 临时文件、file fsync、原子 rename、directory fsync 和 revision；rename 可见但目录 fsync 失败返回 token/revision 与 `persistence=uncertain`，可由 status 查询恢复。
- reserve 在锁内检查容量、重复 task 和模块/UI/数据硬冲突；token 由 common-dir 0600 恢复密钥、reservation id、request-key 哈希和 generation 派生，登记仅保存 SHA-256/request-key 哈希。stdout 断连或并发 replay 后，同一 request key/规范返回同 generation、同一仍可用 token，不重复占槽；取消/过期后新 request key 可重派同 task ID，旧 request/token 不复活。
- claim 在锁内按 task、title、baseline、模块、UI、数据、文件和外部身份完全一致地转换 reservation；错误或过期 token、范围不一致、新硬冲突和写入失败均保留可恢复 reservation。
- WAITING 续期在锁内重新检查容量与冲突；active claim 永不因 TTL 自动过期。
- cancellation 除 rollout/thread/sidebar 三方 missing/missing/absent 与 compensation confirmation 外，还要求 turn 明确 not-started/none，或此前已由独立 `task:verify-stop` 持久化 completed/owner 停止证据；cancel 不得在同一事务覆盖 running turn，成功后保留 tombstone。
- `DESKTOP_LIVE` 同时要求 rollout/thread DB/sidebar present、name=set、`turnOwner=desktop`、started turn 和实际观察；任一证据缺失即 fail closed。
- 不同活跃 task 不得复用 canonical thread；只读 reviewer 不再持久化权威 claim，兼容 read claim 有显式清理路径。
- ACTIVE→REVIEW 固化精确等于 baseline..任务 HEAD 的完整有序 task commit/list；REVIEW→ACTIVE 无条件作废旧 review/stop evidence。HANDED_OFF 接受同一列表；review PASS 后只允许 sole-parent、active→completed 验收单与 completed/README 三文件白名单的机械 closeout commit。release 的 integrated 路径只允许 `00` 在中央分支当前 HEAD 中为受审列表/closeout 建立保序一对一、不同对象 stable patch-id 映射，并验证最终树/完整净 diff 与最终回归；子集、错序、重复/复用、add→revert→add 缺项、taskCommit=integrationCommit、全零或不存在对象均拒绝。
- `status/check` 同时展示槽、claim、reservation、生命周期、owner、下一责任人、硬/软冲突后果与建议顺序。

## 风险与模型路由

- 风险档：R3（治理、并发门禁、架构和复杂集成）
- 请求模型：GPT-5.6-Sol
- 实际模型：不可观察，未验证
- reasoning（请求）：High（任务启动时用户明确）
- reasoning（实际）：不可观察，未验证
- 规范默认：R3 使用 Sol/XHigh；reviewer 发现 P1 后应按该默认路由复审，但不得据此声称本轮运行时 reasoning 已升级
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：reviewer 发现 P1，后续请求路由应采用 R3 默认 XHigh；Max 仍关闭，未出现需要短时 Max 的重大不确定性
- 独立只读 reviewer：R4 独立复审拒绝 `5dd075c` 并给出四个定向阻断；最小补正已完成，等待新的独立 R3 reviewer，本实现者不自评替代
- 数据风险：错误转换可能超发、卡槽或丢失 claim；通过排他锁、严格校验、原子写和 fail-closed 测试覆盖
- 安全风险：登记只保存 request-key/token 哈希，恢复密钥为 common-dir 0600 文件；stdout 断连/并发 replay 只按同一 request key/规范重算同一 token。仓库不提交真实 thread 标识、用户绝对路径、全局状态内容或本机日志
- 发布风险：纯工程治理任务，不改变安装包或固定 App

## 中断、恢复与去敏证据

- 同一任务曾因计划内 Desktop 重启和旧 app-server 客户端迟到写入竞态出现三次 interrupted；每次均从同一 Worktree、同一分支、同一 claim 和同一 canonical thread 恢复，没有重建重复任务。
- `00` 在只读核对后精确终止旧连接；最终只保留唯一 canonical 连接。本仓库不记录进程号、临时配置路径或精确 thread/client 标识。
- 一次真实 ghost task 恢复已按“备份 → 精确删除三类孤立 atom 键 → Desktop 重启 → 全局状态零命中 → thread/list 空结果 → 侧栏项消失”完成。验收单只保留去敏后的故障模式和人工恢复契约，不保存全局状态内容。
- 测试用去敏样本覆盖 rollout/DB 缺失但 sidebar atom 残留；没有制造真实坏侧栏任务。

## ce2d0bd 后执行可见性反例与补正

- `00` 在 ce2d0bd 后核实：两个独立 app-server 客户端确实在运行、调用工具、写入和测试，但 Desktop 侧栏只显示固定 `00` 的活动状态，临时工条目没有 in-progress/圆圈，打开后也不实时显示当前 turn。
- 从另一独立客户端读取任务时可见 `notLoaded` 或旧轮 interrupted，与执行客户端的实际工作状态分裂。验收单只记录去敏结论，不提交 thread id、PID、绝对路径、全局状态内容或本机日志。
- Desktop 主进程持有的 app-server 连接没有可假定代理的命名控制 socket；CLI daemon/proxy 属于独立服务，不能据此声称共享 Desktop renderer live 状态。
- 因此 ce2d0bd 中“持续消费到 `turn/completed`”只保留为后台连接完整性要求；本任务实际执行可见性补正为 `BACKGROUND_ONLY`。若将来必须实时可见，保留同一 task/thread，等待受支持的 Desktop-owned 启动或一次人工触发，不复制任务、不要求用户手动创建 Worktree。

## 94af11a 后独立 R3 复审反例与补正

- 独立 reviewer 发现首版锁会仅凭 mtime 超过 30 秒删除，合法暂停 holder、stale-check/新 holder 接管和旧 holder 迟到释放都可能破坏互斥；补正后以进程启动 identity、nonce、device/inode 和 recovery guard 判定，mtime 不再是所有权证据。
- reviewer 真实调用 c037 旧脚本后证明：首版 `schemaVersion: 1` 会让旧 claim/release 忽略 reservations/tasks，可能第三 claim 或只删除 claim。现场还观察到一个去敏的 “claim 已被旧 release 删除、ACTIVE lifecycle 遗留” 样本。补正后正式 schema 为 3，旧写路径由 legacy guard 封闭；遗留样本只转为 integrity issue，不伪造 RELEASED。
- reviewer 指出 thread/start 不确定或三方 UNKNOWN 时首版仍可能直接 cancel；补正后 cancel 只接受明确 missing/missing/absent + compensation confirmation。
- reviewer 指出 title 等输入和 rename 后 directory fsync 失败缺少可恢复协议；补正后严格 canonical 校验，并返回可查询 revision 与 `persistence=uncertain`。
- reviewer 指出 malformed v3、dangling symlink、0700、DESKTOP_LIVE 失效、terminal evidence 可伪造等负向边界；均新增能在旧实现上失败的 oracle。验收单不提交 PID、绝对路径、真实 thread 标识、全局状态内容或本机日志。

## 5dcea9c 后三路独立 R3 复审反例与补正

- reviewer 证明 `ps lstart+command` 受 locale 影响且会把 argv 中 token/thread/client 写入 lock；本轮改为固定 `LC_ALL=C` 的启动身份，不保存 command/argv，并用跨 locale 与 lock bytes oracle 覆盖。
- reviewer 复现 holder 在 lstat 后释放会使 reader 把 ENOENT 包装为 malformed；本轮改为 `O_NOFOLLOW` fd + fstat/path inode 一致性和有界瞬时重试，并加入确定性 open-after-release hook。
- reviewer 证明 regular-file→directory 双 rename 存在 c037 写空窗；本轮删除在线迁移，保留原 inode/bytes 并 fail closed，文档要求离线全局停写与父目录 fsync。
- reviewer 复现 owner=04 的 ACTIVE-without-claim、started ghost cancel、持久 read claim、跨 task thread 复用、缺失外部证据仍 live、全零 commit release 和控制字符输入；均新增能在 `5dcea9c` 上失败的确定性负向 oracle。

## 2f6cd51 后第三轮独立 R3 复审反例与补正

- reviewer 跨 `UTC0` 与 `Asia/Shanghai` 复现同一活 PID 的 `ps lstart` 身份不同，导致活锁被删、两个 reserve 都返回 token 但最终只剩一条登记；补正后 identity 固定 UTC，并以跨 TZ 双进程并发 oracle 验证不丢更新。
- reviewer 复现 WAITING→WAITING 可清空/替换 canonical thread/client；补正后 canonical ID 一旦建立，在所有非终态持续唯一且不可空、不可换。
- reviewer 用真实 cherry-pick 证明 Git 祖先链不能表达中央集成，并指出 taskCommit=integrationCommit 可伪造；补正后 REVIEW/HANDED_OFF 固化精确 commit list，release 在中央 HEAD 中验证唯一且不同对象的 stable patch-id 等价映射。
- reviewer 复现 started BACKGROUND_ONLY 可直接进入 REVIEW/RELEASED/ARCHIVED；补正后先独立持久化 completed-turn/owner stop verification，running、disconnected、unknown 都不能进入 review/hand-off/integration/terminal。
- reviewer 复现 ACTIVE-without-claim orphan 占 0 槽、started ghost 可在 cancel 同命令伪装 completed，以及 stdout 断连后 token 永久丢失；补正后 orphan 占隔离槽并全局阻断 reserve，ghost 需独立 stop verification 且取消保留 tombstone，reserve 用幂等 request key 恢复 token。
- reviewer 要求 lock schema 2 identity canonical、history 连续、baseline 对象存在、schema 1 preview 不丢 integrity issues、c037 status/check 不误报空、验收单路径与阶段一致，以及安全清理崩溃 candidate/hardlink；各项均新增可在 `2f6cd51` 上失败的确定性负向 oracle。

## 71ce44d 后第三轮独立 R3 复审反例与第四次补正

- 真实导出的 `2f6cd51` holder 在 `Asia/Shanghai` 持锁时，旧 contender 可因时区 identity 分裂在 holder 退出前成功；当前版以“PID 明确存活即不可 unlink”修复，并用旧 holder + 当前 contender 跨版本 oracle 验证等待。
- 既有 c037 `package.json` 无法凭空自动调用新协调器；删除绑定 04.9 绝对路径的隐藏 wrapper，改为 `00` 显式迁移门禁。测试使用真实 c037 checkout 的原始 `npm run task:status/check`，迁移后通过 common-dir 版本化只读 launcher 看到权威 v3；删除创建 launcher 的临时目录后仍有效，旧写入口禁用。
- REVIEW 列表现在精确等于 baseline..任务 HEAD 完整有序集合；自动测试拒绝只登记 B、B→A 错序和重复 commit。release 使用保序一对一映射和任务路径最终净 diff；中央 B→A、add→revert→add 仅集成前两项均拒绝。
- REVIEW→ACTIVE 无条件清除旧 review/stop evidence；`verify-stop → REVIEW → ACTIVE → REVIEW` 即使没有新 turn 也先失败，直到为当前补正轮次重新 verify-stop。
- request-key token 改为可重算 single-flight；两个并发 replay 返回同 generation、同一仍可用 token。真实 `2f6cd51` 同一 oracle 记录为 `concurrent-request-key-not-single-flight` 失败，当前版通过。
- ARCHIVED 读取校验 sidebar absent、rollout/thread/name 保留和 history/release 尾项；取消/过期 tombstone 允许新 request key 重派同 task ID，同时永久阻断旧 request/token。
- reviewer PASS 后的 closeout 采用独立机械 commit 白名单；允许验收单 active→completed + completed/README，混入 implementation 文件的反例拒绝。
- foundation 新增 CURRENT_STATE/验收单生命周期一致、所有 completed 验收单索引完整、R0–R3 到模型/reasoning 的语义映射；协调测试真实记录 `2f6cd51` 失败集合与当前版通过集合。

## 5dd075c 后 R4 独立复审反例与最小补正

- `5dd075c` 通过非 NUL `git diff --name-only` 收集路径，中文会被 C-quote，rename 只保留目标路径；真实旧版 oracle 分别接受了中央改写中文文件和重新加入 rename source。当前版用 `--no-renames -z` 收集完整前后路径，并逐路径比较 task/integration HEAD 的 Git tree entry（mode/type/object）；非法 UTF-8 或非规范仓库路径 fail closed。
- 旧 closeout 只校验三文件名、completed 状态词和索引包含 basename，可在 reviewer 后重写验收单正文或 completed README。当前版要求 reviewed HEAD 中 active 存在且 completed 不存在；completed 内容只允许一次确定性 active→completed 状态迁移，索引只能保留原字节并追加一条规范链接。
- 旧 registry read 不会按 Git 重验持久 closeout `files`。当前版由同一纯验证器服务 HANDED_OFF 写入和每次读取，从 Git 对象重算 parent、完整 changed files、tree entry、内容迁移及索引追加，并与登记字段逐项核对。
- 旧 c037 Worktree 迁移只核验 status/check 和主脚本；真实 `5dd075c` oracle 在仅改写 task:claim/task:release 后仍会迁移。当前版比较受信来源的全部 `task:*` npm 入口，并要求 staged/unstaged/untracked 可证明 clean；仅幂等重跑时允许精确 read-only shim 这一项 unstaged。
- 同一 R4 oracle 集真实运行结果：`5dd075c` 六个具体反例均复现为失败集合；当前源码对应六项全部 fail closed。fixture 只使用临时 Git 仓库和去敏路径，不保存 reviewer 临时目录。

## 40d4d71 后 R5 独立复审反例与最小补正

- 旧 registry read 只重验 closeout 自身 Git 事实，可将 sibling 验收单的自洽 evidence 移植给只声明验收单 A 的 claim。当前版每次读取都绑定该 task 的 write claim canonical active/completed pair 与完整 scope；终态无 claim 时使用 release 保存的 scope snapshot/fingerprint，失败不改变 lifecycle、claim 或 slot。
- 旧 mechanical closeout 只比较内容与路径，验收单或 completed README 变为 executable 后仍可 HANDED_OFF。当前版要求 reviewed/closeout 两对 tree entry 都是常规 `100644` Markdown blob 且 mode/type 不变，executable、symlink 或 gitlink 一律 fail closed。
- 旧 release 的 commit/patch/tree 命令受 Git replace refs 影响，可隐藏 central HEAD 后续篡改。当前版通过单一 raw Git 入口强制 `GIT_NO_REPLACE_OBJECTS=1`，覆盖 object existence、merge-base、rev-list、show/diff/patch-id、ls-tree 和 cat-file/blob。
- 同一 R5 oracle 集真实运行 `40d4d71` 脚本：`closeout-sibling-scope-swap`、`closeout-plan-mode`、`closeout-index-mode-type`、`git-replace-authoritative-evidence` 四项均在旧版复现为错误放行，当前版全部 fail closed。c037 migration 语义未改动。

## 验收条件

- [x] 三个真实并发子进程 reserve 恰好两个成功；active claim + reservation 共同限 2。
- [x] 重复 task、非法 owner、错误/过期 token、基线或范围不一致，以及 malformed/symlink/权限异常安全拒绝。
- [x] reservation 原子转换为 active claim 且不重复占槽；失败不丢 reservation；active claim 不受 TTL。
- [x] 并发 reserve/cancel/claim/status/transition 不损坏登记；锁残留恢复保持安全边界。
- [x] 活跃 holder 超过旧 mtime 阈值、stale-check/新 holder 接管、旧 holder 迟到释放和三进程并发均按 identity/inode 安全，双槽不超发且登记不丢更新。
- [x] 真实 c037 旧 claim/release 在 v3 legacy guard 启用后 fail closed；legacy active claim 和 coordinationVersion 2 登记有明确迁移路径，不被升级命令破坏。
- [x] malformed v3 的 reservations/tasks 缺失、null、object、string 均 fail closed；dangling symlink、0700 和临时/登记非 0600 均拒绝。
- [x] 输入在写前 canonicalize/严格校验；rename 后目录 fsync 失败返回 token/revision 与可查询 uncertain commit。
- [x] 跨部门硬冲突报告 owner、任务、重叠范围、后果和推荐顺序；文件重叠仍为软冲突。
- [x] 合法/非法生命周期、WAITING、断连恢复、REVIEW/HANDED_OFF、INTEGRATING、release、ARCHIVE_PENDING/retry 已覆盖。
- [x] 创建、命名、turn、断连、ghost 和归档失败补偿矩阵已写入文档并由模拟测试覆盖。
- [x] missing/UNKNOWN visibility 不会显示为 DESKTOP_LIVE；BACKGROUND_ONLY、WAITING、REVIEW 与双槽/claim/archive 语义独立。
- [x] DESKTOP_LIVE 在 turn completed、sidebar absent、release/archive 后失效；terminal record 缺失/伪造 release evidence 不得 archive。
- [x] lock identity 跨 locale 一致且 lock bytes 不含 argv/token/thread/client；fd/inode TOCTOU 瞬时释放可重试，稳定 malformed 仍拒绝。
- [x] regular-file preview guard 不在线换型；真实 c037 并发时 guard inode/bytes 保持，离线迁移边界已文档化。
- [x] owner=01–04 的 ACTIVE-without-claim 同样转 integrity issue；started/disconnected/unknown ghost 不可 cancel。
- [x] read-only reviewer 不持久化 claim；canonical thread 跨活跃 task 唯一，client id 单独可复用。
- [x] DESKTOP_LIVE 校验完整外部证据；integrated release 绑定受审 commit list 和真实 cherry-pick stable patch-id 映射；控制字符/Unicode 分隔符拒绝。
- [x] lock identity 跨时区稳定；跨 TZ 并发不误删活锁、不丢 reservation，lock bytes 不含 token 或外部 ID。
- [x] canonical thread/client 在非终态不可清空或替换；不同活跃 task 不得复用同一 canonical thread。
- [x] running/disconnected/unknown turn 不得进入 REVIEW/HANDED_OFF/RELEASED/ARCHIVED；独立 stop verification 与 cancellation tombstone 已覆盖。
- [x] ACTIVE-without-claim orphan 占隔离槽并全局阻断 reserve，只有 `00` 携带可审计停止证据可解决。
- [x] reserve stdout 断连及并发 replay 可按幂等 request key single-flight 恢复同一可用 token，不重复占槽。
- [x] 真实 c037 标准 npm status/check 经显式迁移自动路由 common-dir 只读 launcher；创建 launcher 的任务目录移除后仍有效，写入口禁用。
- [x] REVIEW 列表完整有序、返工 stop 失效、保序一对一 release、最终净 diff、机械 closeout 白名单均有确定性负向 oracle。
- [x] 最终净差异以 NUL + no-renames 收集中文及 rename 前后路径，并逐路径核对 Git tree entry；中文改写和 rename source 重现均拒绝。
- [x] mechanical closeout 只允许验收单唯一状态迁移与索引单链接追加；验收单正文重写、既有索引改写和 persisted evidence 篡改均拒绝。
- [x] closeout 读取重新绑定当前 claim scope，终态绑定 release scope snapshot/fingerprint；sibling evidence 交换 fail closed 且不改变 lifecycle/claim/slot。
- [x] closeout 验收单与 completed README 前后均限定为常规 `100644` Markdown blob，executable plan/index 均拒绝。
- [x] 权威 Git 对象证据统一禁用 replace refs；central 篡改在 replace ref 存在时仍拒绝 release 并保持 INTEGRATING/claim/slot。
- [x] c037 迁移核验全部 `task:*` npm 入口和 clean Worktree；只改写 task:claim/task:release 的旧版通过反例在当前版 fail closed。
- [x] ARCHIVED 持久不变量、取消/过期后同 task ID 新 request-key 重派及旧 token/request 不复活已覆盖。
- [x] lock owner identity、history 连续性、baseline 对象、schema 1 preview、真实 c037 入口和 stale candidate/hardlink 均有确定性负向 oracle。
- [x] 模型路由、独立 reviewer 和验收单证据字段完整落库。
- [x] 已演练 `reserve → 模拟侧栏创建失败 → cancel → 槽恢复`，未创建真实坏任务。
- [x] 本轮补正后的自动测试、格式、JSON/YAML、敏感信息、绝对路径和意外文件审计完成。
- [ ] 新一轮独立只读 R3 reviewer 待执行；通过前保持 REVIEW 与 claim。
- [x] App 交付不适用且明确禁止；固定 App 未更新。

## 验证结果

| 命令/步骤 | 结果 | 备注 |
| --- | --- | --- |
| `node --version`（固定 Node PATH） | v24.14.0 | 位于允许的 Node 20–24 |
| `npm run app:status` | 通过 | installed source `7ff9aa5`；当前基线包含它，固定 App 未更新 |
| `npm run test:coordination`（R5 最终源码多轮） | 每轮 553 通过，0 失败 | 独立运行及 foundation、impact、full 内嵌运行均通过；真实 `40d4d71` 旧脚本放行 sibling scope swap、plan/index mode 变更和 replace-ref 伪造四项，当前版全部 fail closed |
| `npm run test:foundation` | 151 通过，0 失败 | 内嵌 coordination 553、i18n 21、wrapper 11 均通过 |
| `npm run test:i18n` | 21 通过，0 失败 | 无运行时新增直写中文 |
| `npm run test:impact -- --base c037a4b32ddc4557336f27af44300633281e2df4` | 通过 | 精确识别 17 个变化文件；desktop 47、foundation 151/coordination 553/i18n 21/wrapper 11、Web 10+14 全通过 |
| `npm run test:full`（R5 最小补正后） | 通过 | app 936、project-input Web/Electron 全部、Web 10+14、desktop 47、local-install 36、delivery gate 13、foundation 151、coordination 553、i18n 21、wrapper 11 |
| `git diff --check` | 通过 | 无空白错误 |
| JSON/YAML 解析与敏感/路径/意外文件审计 | 通过 | Node 解析 JSON/JSON-compatible YAML，系统 Psych 独立解析 YAML；无真实标识、用户绝对路径、全局状态内容、凭据或意外产物 |
| 模拟创建失败补偿 | 通过 | reserve 占槽后 cancel，槽恢复为 0 且无 active claim |
| 模拟 ghost 三方补偿 | 通过 | 三方未确认时拒绝；确认精确 absent 后才允许 cancel |
| ce2d0bd 后可见性补正测试 | 通过 | UNKNOWN fail closed；BACKGROUND_ONLY/WAITING/REVIEW 正确显示；DESKTOP_LIVE 需要实际观察；状态不影响双槽、claim、release 或 archive |
| 前导连字符 reservation token 回归 | 通过 | 确定性构造 `--` 开头 token，确认不会误判为 CLI option |

固定 App installed source：7ff9aa583b4e51fb4d888aa1815792b747d275d7

固定 App 人工启动结果：不适用；纯流程任务且用户明确禁止交付。未运行 `app:deliver`，固定 App 未更新。

## 未覆盖与残余风险

- R5 独立只读复审已拒绝 `40d4d71`；三个定向阻断的最小补正已完成，仍需新的独立 R3 reviewer，当前实现者不自评替代。
- 侧栏创建/归档是仓库外部事务，协调器只能登记、校验和 fail closed，不能使外部系统原子化；不确定结果仍需要按 task/client/thread 去重并三方核对。
- 当前 Codex 产品没有向固定 `00` 暴露受支持的跨 Desktop task 启动能力；自动后台施工可行，但 Desktop 圆圈和窗口实时更新不能承诺。
- 03.11 与本任务只在 completed 索引有文件软冲突；`00` 集成时必须保留双方索引。
- 正式集成、最终回归、release 和侧栏归档由 `00` 执行；当前 claim 保留且继续占槽。

## 交接

- 最终提交：`ce2d0bd`、`94af11a`、`5dcea9c`、`2f6cd51`、`71ce44d`、`5dd075c`、`40d4d71` + 本文件所在的 R5 最小补正提交；精确 hash 以提交后 `git rev-parse HEAD` 和交接消息为准
- PR：无（仓库未配置 remote）
- reviewer 结论：R5 未通过；三个阻断点已在同一任务最小补正并具备真实调用 `40d4d71` 旧脚本的确定性负向 oracle，等待新一轮独立 R3 reviewer
- 生命周期交接：REVIEW，保持 claim
- 工作区状态：聚焦提交后 clean；验收单继续留在 active，独立 review 通过前不得移动 completed
- 下一步：独立 R3 reviewer 只读复审本次提交与权威 commit list；通过后再进入 HANDED_OFF
