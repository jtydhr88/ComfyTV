# PreVision 开发代理入口

本文件是所有新 Codex 任务进入仓库后的第一入口。不要依赖旧聊天记录理解项目；仓库文件和可重复验证结果才是事实来源。

## 开始任何任务前

按顺序阅读：

1. `docs/INDEX.md`
2. `docs/CURRENT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/FEATURE_REGISTRY.md`
5. `qa/test-impact-map.yaml`
6. `qa/task-scope-taxonomy.json`
7. 与任务相关的 `docs/plans/active/` 验收单

判断状态的证据优先级：当前代码 → Git → 实际运行/测试/构建 → 配置与数据结构 → 项目文档 → 历史对话。

## 固定工作方式

- 一个任务对应一个 Codex 对话、一个 Git 分支和一个验收单。
- 从 `main` 或用户指定的明确基线创建分支；不得直接在 `main` 开发。
- 分支使用 `feat/`、`fix/`、`chore/`、`docs/` 或 `test/` 前缀。
- 开始修改前，从 `docs/TASK_TEMPLATE.md` 创建 `docs/plans/active/YYYY-MM-DD-任务名.md`。
- 只修改验收单列出的范围。发现旁支问题时记录到 `docs/KNOWN_ISSUES.md`，不要顺手扩大重构。
- 完成时填写实际命令、结果、风险与人工验证，并将验收单状态改为 `completed`。
- GitHub 已连接时只推任务分支并创建 Pull Request；不得自动合并、强推或覆盖远程分支。
- GitHub 未连接时保留本地提交和清晰交接，不阻塞开发。
- 开始 Bug、新功能、UI/交互或其他用户可见任务前运行 `npm run app:status`；任务分支必须包含当前固定 App 记录的来源提交。并行任务落后时先安全整合最新交付提交，不能用兄弟分支直接覆盖固定 App。
- 用户可见业务任务不以“代码已提交”作为完成。独立短期临时工提交实现和任务级验证后，由 `00` 安全集成并运行最终回归；用户明确正式更新时，再由 `00` 退出所有 PreVision 实例并用 Node 20–24 执行 `npm run app:deliver`，完成构建、固定入口更新和自动启动。临时工不得自行交付固定 App。
- 固定日常入口只有 `~/Applications/PreVision.app`；不得把工作树、`out/` 或备份中的 App 当成交付结果。

## 任务层级、上下文寿命与并行门禁

- 治理模式是“分管自治、中央集成”。用户原则上只与固定 `00` 讨论，`00` 大部分时间保持可对话并把实施管理交给固定 `01`–`04`。固定 `01`–`04` 在各自部门范围内负责讨论、澄清、只读分析、拆单、风险分级、自治派发有独立侧栏任务条目的临时工、下达开工、组织独立只读 reviewer 和部门验收；普通无冲突任务成功 `reserve` 后即可派发，只需通知固定 `00`，不逐项等待批准。固定 `01`–`04` 保持“管理忙”，实际写入由更多侧栏临时工承担。
- 固定 `01｜Bug 修复与回归` 负责 Bug、复现和回归边界；固定 `02｜新功能设计与开发` 负责产品语义和数据契约；固定 `03｜UI 与交互体验` 负责 UI、交互、响应式和可访问性；固定 `04｜工程、构建与发布` 负责 Electron、测试、性能、构建和发布准备。
- 固定 `00｜项目总协调与集成交付` 只保留全局优先级、跨部门硬冲突与集成顺序、提交接收和机械集成、最终回归、稳定预览、claim release、侧栏归档，以及用户明确授权后的固定 App 正式交付。`00` **MUST NOT** 在自身长期任务中编写业务或治理实现；冲突解决只能保留临时工已经验收的语义。
- 固定 `00`–`04` 都是长期讨论、分管或调度入口，**MUST NOT** 亲自实施 Bug、新功能、UI、测试、构建配置或其他项目文件变更，**MUST NOT** 持有 write claim、在长期对话堆实现代码或自行集成。固定 `01`–`04` 可以执行 `task:reserve`、创建并命名 Codex 项目 Worktree 侧栏任务，以及在侧栏创建失败且尚未 claim 时执行 `task:cancel-reservation`；它们不得代替临时工运行 `task:claim`。
- 固定 `05`（任何现有或未来配置的专项入口）和固定 `99`（历史开发归档）继续永久只读；只能提供线索、澄清、分类和验收口径，不能 reserve、创建写任务、claim、写入、提交或作为当前状态来源。
- 所有实际代码、UI、测试实现、构建实现或其他项目文件写入都 **MUST** 由负责部门的固定 `01`–`04` 从精确集成基线，通过 Codex 项目 Worktree 自治派发给有用户侧栏可见任务条目的独立短期临时工。**侧栏可见任务**只表示独立条目、thread/rollout 和归档入口存在；**侧栏可见运行**表示 Desktop 拥有当前 turn，且用户已实际观察到侧栏 in-progress/圆圈和当前 turn 实时内容。两者不得等同。每项任务独占自己的对话、Worktree、分支、验收单和 write claim，完成后向负责部门和 `00` 交接提交与证据。
- 内部 collaboration/sub-agent 只能用于只读审计、代码审查、测试复核和调研；**MUST NOT** 修改项目文件、创建实现提交或持有 write claim。每个写任务必须由实现者之外的独立只读 reviewer 复审；R2/R3 reviewer 不得降级。
- 每项可独立验收的具体结果都使用一个按需创建的侧栏可见短期临时工任务；不预建空任务，也不要在固定入口或同一临时工对话继续下一个无关结果。决定施工后先原子 reserve，再立即创建真实 rollout/侧栏任务。执行可见性必须登记为 `DESKTOP_LIVE`、`BACKGROUND_ONLY`、`WAITING` 或 fail-closed 的 `UNKNOWN`：只有受支持的 Desktop 跨任务控制工具，或用户/分管入口在 Desktop 中实际启动并观察当前 turn，才可写 `DESKTOP_LIVE`；外部 app-server 自动施工必须标为 `BACKGROUND_ONLY`/“后台施工”；尚未开工的真实 thread/rollout 标为 `WAITING`。任务停滞时先恢复同一侧栏任务，active claim 保留且永不自动过期；不得另建副本。
- 同时最多存在两个写任务。固定 `01`–`04` 在创建侧栏任务之前必须用 `task:reserve` 原子预留写槽；active write claims、未过期 reservations 与未解决的 ACTIVE-without-claim 隔离项共同计数。存在未解决隔离项时新 reserve 全局 fail closed。reservation 默认 30 分钟 TTL，只有 reservation 可过期；只读审查不占槽，但不得在只读声明下修改文件。
- 标准事务是：`reserve → 创建/命名侧栏 Worktree 临时工 → 临时工 claim`。临时工开工前运行 `npm run app:status`、创建验收单，再用与 reservation 完全一致的 task、title、精确 baseline、模块、UI 表面、数据区域和文件执行 `task:claim -- --reservation <token> ...`。新普通 write claim 不得绕过 reservation；升级前已存在的 legacy active claim 保持有效并走显式兼容路径。
- common-dir 正式登记使用严格 `schemaVersion: 3`。升级前真正的 claims-only/schema 2 登记可一次迁移并保留在途 legacy claim；旧 Worktree 的 c037 脚本必须被持久 legacy write guard 阻止写入 v3，不能把未知 schema 当空登记后第三 claim 或只删 claim。既有 c037 `package.json` 不会自行发现新协议，因此由 `00` 在确认目标 HEAD、协调脚本、全部 `task:*` npm 入口与受信来源精确一致，且目标 Worktree 可证明 clean 后运行 `task:migrate-legacy-worktree`：它把原标准 npm 入口替换为只允许 `status/check` 的 shim，并路由到 Git common-dir 内版本化、0600、与创建任务 Worktree 路径无关的只读 launcher；额外或改写的协调入口一律拒绝，未迁移旧 Worktree 的空结果不得作为权威状态，写命令继续禁用。旧版 regular-file preview guard **MUST NOT** 在线自动替换为目录；只能由 `00` 在证明所有旧 writer 已停止的离线窗口备份、换型并 fsync 父目录。新版互斥锁只保存固定 `LC_ALL=C`、`LANG=C`、`TZ=UTC0` 的进程启动身份，不保存 command/argv；marker 先完整 fsync 再原子发布，读取使用 fd/inode 一致性并只对瞬时 ENOENT/ESTALE 有界重试。PID 明确存活时，无论旧版 identity 能否比较或是否匹配都不得 unlink；只有 PID 明确不存在才可进入 stale 恢复。活跃 owner 不因 mtime 变旧而被接管，释放在 recovery guard 内只能删除自己创建且 identity/inode 仍匹配的锁；stale candidate/hardlink 只在 owner 明确不存在时清理。malformed、symlink、非 0600、未知 owner 身份和 recovery lock 异常一律 fail closed。
- 仓库 common-dir 登记是权威状态，侧栏标题/首条状态只是镜像。生命周期为 `RESERVED/WAITING → ACTIVE → REVIEW → HANDED_OFF → INTEGRATING → RELEASED → ARCHIVE_PENDING → ARCHIVED`，并独立记录 execution visibility。`DESKTOP_LIVE` 必须同时有 canonical thread/client、rollout/thread DB/sidebar present、name=set、`turnOwner=desktop`、started turn 和实际观察；缺失或未知可见性统一显示 `UNKNOWN`，不得推断为 live。canonical thread/client 一旦建立，在所有非终态不得清空或替换；不同活跃 task 不得复用同一 canonical thread，client id 单独可复用。只读 reviewer 不创建或持久化权威 read claim。每次转换记录 owner、时间、actor、下一责任人、原因、`taskId/clientId/threadId` 去重身份和失败补偿，history 必须连续且尾项与当前状态完全一致。claim 从 ACTIVE 保持到 `00` 完成集成/最终回归并 release。
- app-server 创建遵循 `thread/start → thread/name/set → turn/start`；一旦启动 turn，外部客户端必须持续读取通知直到 `turn/completed`，不能成功启动后立刻断连。这个条件只证明后台连接完整执行与落盘，**不是** Desktop 侧栏圆圈、实时刷新或窗口流式内容的证据。Desktop 自身 app-server 与独立 daemon/proxy 不得假定共享 live 状态；没有受支持的 Desktop 启动能力时，保留同一 thread 并标记 `BACKGROUND_ONLY`，需要实时可见时等待一次受支持的 Desktop 启动/人工触发，不要求用户手动创建 Worktree，也不得复制任务。
- 声明必须包含实际涉及的模块、UI 表面、数据区域和文件；合法名称见 `qa/task-scope-taxonomy.json`。不能只声明单体文件 `预见PreVision.html` 来规避逻辑冲突判断。
- 模块、UI 表面或数据区域重叠属于硬冲突：分管入口在创建侧栏任务前停止，并报告 owner、冲突任务、重叠范围、后果和推荐顺序。跨部门硬冲突升级给 `00`；核心数据语义、安全、许可证、公开发布和正式交付升级给 `00`/用户。仅文件重叠属于软冲突：可以继续，但必须通知 `00` 明确机械集成顺序并保留双方索引。
- `task:reserve` 必须带调用方生成的幂等 `--request-key`；登记只保存哈希。token 由 common-dir 0600 恢复密钥、reservation id、request-key 哈希和 generation 生成，不把明文写入登记；若登记已提交但输出断连，同一 request key 与完全相同规范的并发 replay 必须返回同 generation、同一仍可用 token，不得轮换出互相失效的响应或重复占槽。同 key 不同范围拒绝；补偿取消/过期后可用新 request key 重派同 task ID，旧 request/token 永不复活。
- 侧栏创建补偿必须区分：`thread/start` 失败或结果不确定时默认保留 reservation；只有 rollout=missing、thread/list/DB=missing、sidebar=absent 三方都被明确核验、turn 明确为 `not-started/none`，或先用独立 `task:verify-stop` 持久化 `completed` 与原 owner 停止证据，并传入 `--compensation-confirmed yes` 后才可 cancel。cancel 命令不得在同一事务中把 started/disconnected/unknown 覆盖成 completed；取消后保留 actor、reason、evidence 的 tombstone。thread 已创建但命名/turn 失败时保留 RESERVED 并恢复同一 thread；turn 启动后断连时保留 WAITING/ACTIVE 并重连；后台 turn 成功但 Desktop live 状态缺失时保留同一 thread/claim、标记 `BACKGROUND_ONLY` 并禁止盲建副本；归档失败进入 ARCHIVE_PENDING。rollout/DB 缺失但 sidebar atom 残留属于 ghost task，必须备份后做 rollout、thread/list/DB、sidebar atom 三方核对，只清精确孤立键并重启验证；仓库脚本不得修改用户全局 Codex 配置。停滞和重复任务都必须恢复拥有 reservation/claim 的规范任务。ACTIVE-without-claim orphan 计入隔离槽并全局阻止新 reserve，直到 `00` 用 `task:resolve-integrity` 提交可审计停止证据。
- 进入 REVIEW、HANDED_OFF、INTEGRATING、RELEASED 或 ARCHIVED 前必须已有独立持久化的 completed-turn stop verification；started、disconnected、unknown 不能只靠降低 visibility 进入终态。任何 REVIEW→ACTIVE 返工都同时作废旧 review evidence 与 stop verification；即使没有显式启动新 turn，再次 REVIEW 也必须为本轮重新 `task:verify-stop`。
- ACTIVE→REVIEW 固化的 `--task-commit`/commit list 必须精确等于 claimed baseline..当前任务 HEAD 的完整有序集合，不能遗漏、重排或重复。若独立 reviewer PASS 后才移动验收单，只允许一个 sole-parent 的机械 closeout commit：reviewed HEAD 必须只有 canonical active 验收单，closeout 只能把它按同名路径迁到 completed、将唯一状态从 active 确定性改成 completed，并在不改写既有字节的前提下向 `docs/plans/completed/README.md` 追加一条规范链接；验收单和索引前后都必须是 mode `100644` 的常规 Markdown blob。持久 closeout evidence 在写入和每次读取时都从 Git 对象重算并逐字段核对，且必须绑定当前 write claim 的 canonical active/completed scope；终态无 claim 时则绑定 release 保存的不可漂移 scope snapshot/fingerprint。`00` 以 integrated outcome release 时必须引用受审列表与 closeout（如有），在中央集成分支当前 HEAD 中按相同顺序为每个提交找到一对一、不同对象的 stable patch-id 等价提交；任务净变化路径用 `--no-renames -z` 收集完整前后集合，并逐路径核对 task HEAD 与 integration HEAD 的 Git tree entry（mode/type/object）及最终回归 passed，中文、rename source 或不可安全解析路径不得漏检。所有权威 Git 对象证据命令必须强制 raw-object 语义并禁用 replace refs；不得用子集、错序、复用 central commit、taskCommit=integrationCommit、全零、仅 40 位字符串或不存在对象伪造中央集成。
- 临时工完成交接后保持 claim；由 `00` 在集成成功或确认取消后运行 `npm run task:release -- --task <任务ID>` 并归档短期任务。固定入口在自治派发或集成前运行 `npm run task:status`，不得依赖聊天记忆判断并行状态。

## 中文意图与开发阶段

- 用户不需要记命令。代理必须从普通中文判断当前处于快速预览、相关验证、正式交付还是对外发布阶段，并在 commentary 中简短说明本轮采用的阶段。
- 下列阶段行为只由固定 `01`–`04` 自治派发的独立短期临时工执行。相同表达若出现在固定 `01`–`04`，分管入口先原子 reserve，再创建侧栏任务并通知 `00`；若出现在固定 `00`，`00` 只做优先级/冲突判断并请求相应部门派发，不能在固定任务中直接修改。固定 `05`/`99` 仍只读。
- “继续调一下、先改改看、我看看效果、再优化、先别正式装”等表达默认进入快速开发预览：使用当前任务工作树和 Electron 开发模式刷新效果，运行最小相关测试，不更新固定 App。
- “检查一下、验证一下、有没有回归、这个逻辑对不对”等表达进入相关验证：按影响映射运行模块/影响测试；国际化测试仍是每个任务的硬要求，不需要用户单独提醒。
- “可以了、定稿、这版完成、正式更新、安装到我平时打开的软件”等表达才进入任务最终验收：临时工提交干净代码，`00` 安全集成并运行一次 `app:deliver`，更新固定 App 并人工确认。
- “发给别人、发布版本、制作安装包、ZIP/DMG、签名/公证”等表达进入对外发布流程，不能只用本机 `app:deliver` 代替。
- 表达有歧义时默认选择快速开发预览，不擅自正式打包；但安全测试不得因此省略。任务不等于单条消息，同一任务允许多轮预览，最终只正式交付一次。

## 项目级指令同步

- 固定专用入口 `01`–`04` 承担各自分管职责并可自治派发；固定 `00` 统一处理全局优先级、跨部门硬冲突、机械集成和最终交付。固定 `05`/`99` 继续只读。
- 国际化、安全边界、架构原则、分支/交付流程、测试策略等影响整个项目的核心诉求，由收到指令的分管入口升级给 `00`/用户确定全局优先级，再由归属部门创建独立短期临时工写入仓库并同步固定入口；不要求用户重复发送。
- 单一页面细节或只属于一个任务的临时要求不自动广播，避免其他工作树误改；如果该要求后来上升为项目规范，再写入仓库并同步。
- 仓库文档是持久事实来源；对话同步只是即时通知，不能代替 `AGENTS.md`、ADR、QA 映射或验收单。

## 安全边界

- 不提交 `.env`、凭据、Token、Cookie、密码、私人项目数据、本机日志或绝对路径。
- 不提交 `node_modules/`、`out/`、`.claude/`、`日志/`、缓存和临时产物。
- 不执行 `git reset --hard`、`git clean -fd`、强推、自动合并、删除分支或删除历史。
- 不调用真实付费 AI 服务做测试。
- 不为通过测试改变既有业务语义；失败先记录并判断是否为历史问题。
- 项目许可证尚未确定，不得擅自创建公开仓库或对外发布源码。

## 国际化硬规则

- 运行时 HTML、JavaScript 和 Electron 代码不得直接新增中文用户文案；必须使用 language key。
- 浏览器端使用 `PreVisionI18n.t('domain.key', variables)` 或 `data-i18n*`；Electron 主进程使用 `i18n/node.cjs` 的 `t()`。
- 翻译文本只能放在 `i18n/locales/`。增加 key 时必须在所有受支持语言包中同步增加，当前为 `zh-CN` 和 `en-US`。
- 修改到含历史内联中文的用户界面时，在同一任务把相关文案迁移为 key，不得继续复制旧写法。
- 文档、测试说明和代码注释不属于用户界面翻译资源；但测试夹具中的用户可见文案仍应引用或验证 language key。
- 每个任务至少运行 `npm run test:i18n`；直接中文守卫或语言包 key 对齐失败时不得交接。

## 技术与环境

- 前端是原生 HTML/CSS/JavaScript，主应用集中在 `预见PreVision.html`。
- 三维引擎是内嵌 Three.js r128；没有 React/Vue 等框架。
- 桌面端是 Electron 43 + Electron Forge 7，主进程位于 `electron/`。
- 包管理器为 npm，必须使用 `package-lock.json` 和 `npm ci`。
- 推荐 Node.js 22；允许范围是 20–24。不要使用 Node.js 25/26 打包。
- 当前只构建 macOS Apple Silicon；正式 Apple 签名和公证尚未建立。

## 测试选择

先运行与变更匹配的最小测试，再按风险升级：

- 仓库文档/QA 元数据：`npm run test:foundation`
- 国际化资源或任何用户文案：`npm run test:i18n`
- Electron 主进程/预加载：`npm run test:desktop`
- 本机固定 App 安装/更新：`npm run test:local-install`
- 检查当前分支与固定 App 来源：`npm run app:status`
- 主应用核心启动：`npm run test:core`
- 主应用单模块：`npm run test:module -- <module>`；模块名见 `qa/test-impact-map.yaml`。
- 主应用行为或 `预见PreVision.html`：`npm run test:app`
- 未知影响、跨模块、发布前：`npm run test:full`
- 根据变更文件自动建议/运行：`npm run test:impact -- --base <commit>`；单体 HTML 内已知模块可追加 `--module camera` 等范围。

详细规则以 `docs/TEST_STRATEGY.md` 和 `qa/test-impact-map.yaml` 为准。当前主应用仍是单文件架构，因此改动该文件时全量应用测试仍是安全默认值。

## 完成定义

一个任务只有在以下条件全部满足时才可交接：

- 验收条件逐项有结果。
- 相关自动测试通过；未运行项写明原因。
- UI 改动完成目标尺寸的人工检查并留截图说明。
- 数据格式、用户文件和向后兼容风险已评估。
- `FEATURE_REGISTRY`、`KNOWN_ISSUES`、架构或决策文档按需更新。
- 工作区无意外文件，提交内容不含敏感信息和构建产物。
- 已有实现者之外的独立只读 reviewer 结论；R2/R3 reviewer 未降级，模型等级未被当作验收证据。
- 已创建本地提交；有 GitHub 时创建 PR，但不自动合并。
- 已进入“可以了/定稿/正式更新”等最终验收阶段的 Bug 修复、新功能、UI/交互和其他用户可见行为，临时工成果已由 `00` 集成，并由 `00` 执行一次 `npm run app:deliver`；固定 App 已自动打开，并人工确认本次变化可见、核心入口仍可用。临时工的中间预览不要求重复打包，也不得直接安装固定 App。纯文档/测试/仓库任务可跳过，但必须在验收单写明理由。
- 验收单记录固定 App 内的来源 commit、安装路径和人工检查结果；只更新工作树、开发服务器或临时构建包不得交接。
