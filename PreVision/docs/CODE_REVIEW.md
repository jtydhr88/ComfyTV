# 代码评审

## 评审目标

优先发现会导致用户项目丢失、路径/镜头语义改变、导出错误、安全边界扩大或跨平台构建失败的问题。格式偏好不能掩盖行为风险。

每个写任务必须由实现者之外的独立只读 reviewer 评审。reviewer 不修改项目文件、不创建实现提交、不持有 write claim；发现问题后由原临时工修复。R2/R3 reviewer 不得低于任务默认模型与 reasoning 路由，模型等级本身不构成验收证据。

## 优先级

- **P0**：数据丢失、凭据泄露、任意代码执行、无法启动、破坏现有项目。
- **P1**：核心镜头/时间逻辑错误、保存恢复不兼容、录屏/导出结果错误、严重 UI 不可操作。
- **P2**：边界条件、性能退化、部分窗口/对象错误、测试或文档与行为不一致。
- **P3**：不阻塞使用的可维护性和一致性问题。

## 必查项

### 范围

- 修改是否对应验收单。
- 是否夹带无关重构、依赖升级或格式化。
- 是否意外修改 `main`、构建产物、日志或私人数据。

### 并行任务与集成

- 验收单中的模块、UI 表面、数据区域和文件声明是否覆盖真实 diff。
- 固定 `01`–`04` 是否在创建侧栏任务前原子 `task:reserve`，并把 owner、task、title、精确 baseline 和完整范围交给临时工。
- 决定施工后是否立即创建真实 rollout/侧栏 thread；若等待开工，checkpoint 是否明确写 `WAITING / 等待谁` 并读取到 `turn/completed`，而不是只有内存占位或内部 sub-agent。
- 是否明确区分“侧栏可见任务”和“侧栏可见运行”：任务条目/rollout 存在不得当作 Desktop in-progress/圆圈和当前 turn 实时内容的证据。
- execution visibility 是否为 `DESKTOP_LIVE`、`BACKGROUND_ONLY`、`WAITING` 或 fail-closed 的 `UNKNOWN`；缺失/unknown 是否未被展示为 `DESKTOP_LIVE`。
- `DESKTOP_LIVE` 是否同时有 rollout/thread DB/sidebar present、name=set、`turnOwner=desktop`、started turn 和 `desktopLiveObserved=true`；任一 missing/failed/unknown，或 turn completed/disconnected、sidebar absent/stale、release/archive 后是否已失效为 UNKNOWN/BACKGROUND_ONLY。外部 app-server、daemon/proxy、工具调用或 `turn/completed` 是否被错误当作 Desktop live 证明。
- `BACKGROUND_ONLY` 是否在任务标题或状态明确“后台施工”；若需要实时可见，是否保留同一 thread 等待受支持的 Desktop 启动/一次人工触发，而非要求用户重建 Worktree 或复制任务。
- reserve 是否使用幂等 request key；stdout/token 输出断连或并发 replay 时，所有成功响应是否恢复同 generation、同一仍可用 token，而不是轮换出互相失效的 token 或重复占槽。补偿取消/过期后是否只允许新 request key 重派同 task ID，旧 request/token 不得复活。临时工是否用正确 token 和完全一致的 task/baseline/范围把 reservation 原子转换为 claim；新的普通 write claim 是否绕过 reservation。
- 仓库权威生命周期是否与证据一致：RESERVED/WAITING、ACTIVE、REVIEW、HANDED_OFF、INTEGRATING、RELEASED、ARCHIVE_PENDING、ARCHIVED；每次转换是否记录 owner、时间、actor、下一责任人和补偿原因。
- app-server 是否使用 canonical task/client/thread 身份，并在 `turn/start` 后持续读取通知直到 `turn/completed`；canonical thread/client 一旦建立是否在非终态不可清空或替换；不同活跃 task 是否拒绝复用同一 threadId、client id 单独复用是否仍允许；断连是否恢复同一 thread。
- active claims 与未过期 reservations 是否共同遵守两个写槽；只读 reviewer 是否未持久化权威 read claim，兼容期残留 read claim 是否有 owner/`00` 清理路径。
- 硬冲突输出是否列出 owner、任务、登记类型、重叠模块/UI/数据、后果和推荐顺序；跨部门硬冲突是否升级给 `00`。
- 软冲突是否通知 `00` 明确机械集成顺序，并在整合最新基线后重新运行影响测试。
- 错误/过期 token、范围不一致、转换冲突、malformed v3、dangling symlink、非严格 0600 是否 fail closed，且没有丢失可恢复 reservation 或 active claim。
- v3 lock owner identity 是否固定 locale 和 `TZ=UTC0`、只含启动身份且不含 command/argv/token/thread/client；跨版本 identity 不可比较或不匹配时，PID 明确存活是否仍无条件保留锁；marker 是否完整 fsync 后原子发布；reader 是否以 fd/inode 一致读取并只对瞬时 ENOENT/ESTALE 有界重试，稳定 malformed 仍 fail closed；stale candidate/hardlink 是否只在 owner 明确不存在时清理。
- 真实 c037 旧脚本 claim/release 是否被 legacy write guard 阻止修改 v3；c037 的 status/check 是否通过 guard 内 0600 只读 wrapper 路由到最新协调器，而不是把 v3 误报为空；regular-file preview guard 是否拒绝在线换型并要求 `00` 证明旧 writer 全停的离线迁移和父目录 fsync；升级前 legacy active claim 是否保持有效。
- 旧 release 遗留 lifecycle 是否按 ACTIVE-without-claim 的结构转 integrity issue，而不是只处理 `owner=legacy`；owner=01–04 的孤儿是否同样不伪造 RELEASED、计入隔离槽并阻止新 reserve，直到 `00` 提供可审计 stop evidence。
- task/title/owner/baseline 是否在写前 canonicalize 且严格校验；TAB、ESC、C0/C1、U+2028/U+2029 是否拒绝；rename 后 directory fsync 失败是否返回 token/revision 与可查询 `persistence=uncertain`。
- 侧栏创建失败、`no rollout found` 或结果不确定时是否默认保留同一 reservation/task；cancel 是否同时要求三方 missing/missing/absent、compensation confirmed，以及 turn 明确 not-started/none，或先由独立 `task:verify-stop` 持久化 completed+owner 已停止；cancel 是否禁止同命令覆盖 started/disconnected/unknown，并保留 tombstone。
- 后台 turn 成功但 Desktop live 状态缺失时，是否保留同一 thread/claim、标记 `BACKGROUND_ONLY` 并禁止盲建副本。
- ghost task 是否三方核对 rollout、`thread/list`/state DB 和 sidebar atom；人工恢复是否先备份，只清 task/client/thread 对应的精确孤立键并重启验证，未由仓库脚本修改用户的 renderer 全局状态文件。
- 停滞任务是否恢复原侧栏任务并保留 claim；重复任务是否只保留拥有 reservation/claim 的规范任务。
- 临时工完成、reviewer 通过和部门交接后是否保持 claim；是否只有 `00` 进入 INTEGRATING、在集成/最终回归成功或确认取消后 release，并只在 release 后归档。
- 归档失败是否保持 RELEASED/ARCHIVE_PENDING 并重试同一任务，未重新 reserve 或创建重复侧栏项。
- REVIEW 是否固化精确等于 baseline..任务 HEAD 的完整有序 task commit/list，拒绝子集、错序和重复；REVIEW→ACTIVE 是否清除旧 review/stop evidence，并要求当前返工轮次重新 verify-stop。HANDED_OFF 是否接受同一列表；review PASS 后的 `--closeout-commit` 是否只有 sole-parent/三文件白名单，验收单与索引是否保持常规 `100644` Markdown blob，读取时是否绑定当前 claim 的 canonical pair/scope（终态绑定 release scope snapshot/fingerprint）。REVIEW、HANDED_OFF、RELEASED、ARCHIVED 前是否已有独立持久化的 completed-turn stop verification。RELEASED/ARCHIVE_PENDING/ARCHIVED 是否有 actor=00 的有效 release outcome/evidence；integrated 是否在中央分支当前 HEAD 中为受审提交与 closeout（如有）建立保序一对一 stable patch-id 映射，并以禁用 replace refs 的 raw Git 对象语义验证最终树/净 diff；add→revert→add 缺项、central commit 复用、taskCommit=integrationCommit、全零/不存在对象、malformed terminal record 是否被拒绝。
- 旧 Worktree 是否先由 `00` 使用 `task:migrate-legacy-worktree` 核对精确 HEAD/脚本，再让原始 `npm run task:status` / `task:check` 通过 Git common-dir 的版本化只读 launcher 查询；launcher 是否不含创建任务 Worktree 绝对路径，未迁移空结果是否明确非权威，旧写入口是否 fail closed。

### 风险、模型与独立 review

- 风险档 R0–R3 是否符合实际 diff，尤其是 project-v5、autosave、history、capture、export、Electron IPC、安全、发布和架构范围。
- 验收单是否分别记录请求模型、实际模型、请求 reasoning、实际 selected reasoning、Fast/priority、Ultra、Max/升级原因；不可观察的实际值是否明确写“不可观察，未验证”。
- Fast/priority、Ultra 是否默认关闭；R3 Max 是否只因重大不确定性短时启用。
- 是否只有连续两轮不收敛、范围升至数据/安全，或 reviewer 发现 P0/P1 时才升级。
- reviewer 是否独立只读；R2/R3 reviewer 是否未降级；reviewer 结论是否包含 P0–P3、触发条件、用户影响和未覆盖风险。

### 数据

- 项目数据版本和旧文件是否可载入。
- 数组点数、时间、朝向和 FOV 是否保持对应。
- 自动保存失败是否有可见反馈和降级路径。
- 删除、覆盖和导出是否保护现有用户文件。

### 三维与时间

- 摄影机位置、朝向、FOV 是否使用正确时间轴。
- 对象独立预览是否误改变其他对象或全局时间。
- 直线/曲线、节点同步/独立时间的边界是否明确。
- 画布尺寸变化后 renderer 和 camera aspect 是否同步。

### Electron 与安全

- preload 是否只暴露必要函数。
- IPC 输入是否校验路径、文件名和数据类型。
- 是否保持 `contextIsolation:true`、`nodeIntegration:false`。
- 外部导航是否仍被阻止或交给系统浏览器。

### 国际化

- 运行时 HTML/JavaScript/Electron 是否只使用 language key，不含新增直接中文用户文案。
- 新 key 是否在 `zh-CN`、`en-US` 及以后新增的全部语言包中同时存在。
- 动态变量是否通过占位符插值，没有用字符串拼接绕过语言层。
- 修改历史内联中文所在区域时，相关用户文案是否一并迁移到语言资源。
- `npm run test:i18n` 是否通过，缺失 key 是否有明确失败证据。

### 测试

- 影响测试是否符合 `qa/test-impact-map.yaml`。
- 使用 `--module` 时，diff 是否确实只属于该登记模块；跨模块变化不得用模块参数降级。
- Bug 修复是否有回归断言。
- 自动测试是否真实验证行为，而不是只搜索文案。
- 需要人工/真机验证的部分是否有证据。

### 本机交付

- 用户可见任务开始时是否确认分支包含固定 App 的 installed source。
- 是否先提交并保持工作区干净，再执行 `npm run app:deliver`。
- 固定入口是否仍为 `~/Applications/PreVision.app`，没有从 `out/`、备份或其他工作树启动。
- 验收单是否记录安装来源 commit、App 自动打开和本次变化可见的证据。
- 如果因并行分支不包含最新 installed source 被拒绝，是否通过正常合并/变基解决，而非绕过门禁或改写历史。

## PR 结论格式

- 先列问题，按 P0 → P3 排序。
- 每个问题说明文件、最小行范围、触发条件和用户影响。
- 没有阻塞问题时明确写“未发现阻塞问题”，同时列出仍未覆盖的风险。
- 写明 reviewer 身份/任务、只读边界、风险档和复核命令；不要把请求模型当作通过理由。
- 不用“应该没问题”“看起来可以”代替证据。
