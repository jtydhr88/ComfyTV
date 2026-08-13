# 任务：Web 跨平台压力验证

- 状态：completed
- 日期：2026-07-15
- 对话：04｜工程、构建与发布短期验证任务
- 分支：`test/web-cross-platform-stress`
- 基线：`d0c7815d64a7b3458809ff9ccfe6f6b1f76042d8`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`；本任务基线已包含该来源
- 负责人：Codex 04

## 并行任务声明

- 任务 ID：`04.web-cross-platform-stress`
- 模式：write
- 模块：`testing,repository`
- UI 表面：无
- 数据区域：无
- 预计修改文件：`package.json`、`scripts/web-stress-lib.mjs`、`scripts/run-web-stress.mjs`、`测试/Web压力测试工装测试.mjs`、`测试/仓库基础测试.mjs`、`qa/web-stress-matrix.json`、`qa/web-stress-evidence-schema.json`、`qa/test-impact-map.yaml`、`docs/WEB_PERFORMANCE.md`、`docs/INDEX.md`、`docs/CURRENT_STATE.md`、`docs/KNOWN_ISSUES.md`、`docs/TEST_STRATEGY.md`、`docs/qa/web-cross-platform-stress/**`、`docs/plans/active/2026-07-15-web-cross-platform-stress.md`、`docs/plans/completed/2026-07-15-web-cross-platform-stress.md`、`docs/plans/completed/README.md`
- `task:check` 结果：无硬冲突；与 `03.web-landing-design` 只在 `qa/test-impact-map.yaml` 存在文件级软冲突，整合顺序为本 04 任务先交给 00，03 定稿后再按新基线整合
- `task:claim`：已登记
- `task:release`：首次归档时释放；最终审查发现 Windows 退出清理缺口后按同一范围复领，完成修正与证据重跑后再次释放

## 用户问题

不对录屏时长或普通 2:1 全景图增加产品限制；先使用真实 macOS 与 Windows 浏览器执行可复现压力验证，根据证据再决定是否需要优化。

## 目标

- 建立不依赖网络或付费服务的跨平台真浏览器压测工装与固定矩阵。
- 覆盖默认场景、典型多对象、4096×2048 的 2:1 全景、反复场景切换、短镜头播放、截图、录屏与 Seedance 素材导出。
- 记录首载、JS heap/RSS、GPU/WebGL、FPS/掉帧、峰值内存、长会话增长、崩溃和 WebGL context lost。
- 在可用的真实 macOS Chrome/Safari 执行并保留去敏原始 JSON 证据。
- 只有可用的真实 Windows 环境才记录 Windows Chrome/Edge 结果；否则如实记录阻塞和最低用户动作。

## 非目标

- 不新增三分钟录屏限制，不新增全景图业务尺寸限制。
- 不修改 `预见PreVision.html`、`web/home/`、i18n 资源、03 页面视觉或 app-shell。
- 不实施业务优化，不将 CI、模拟器或 macOS 上的其他浏览器冒充 Windows 实机。
- 不连接付费云、不部署公网、不上传项目数据、不更新固定 App。

## 证据与现状

- 代码：`d0c7815` 已包含零新增依赖的静态 Web 构建与回环预览底座。
- Git：从用户指定的 `d0c7815d64a7b3458809ff9ccfe6f6b1f76042d8` 创建独立 Worktree 和分支。
- 测试/运行：00 已报告 Node 24 下 `test:web` 与 `test:full` 通过；本任务将重新运行相关验证。
- 文档/历史线索：`KI-007` 和 `KI-012` 明确记录真实媒体端到端与 Windows/公开 Web 尚未验证。

## 影响范围

- 模块：`testing`、`repository`
- 文件：压测脚本、压测工装自测、QA 矩阵、去敏证据与工程文档
- 数据格式：无；工装只在隔离浏览器会话中生成合成测试数据
- 平台：macOS Chrome/Safari；Windows Chrome/Edge 仅限真实 Windows 环境

## 风险

- 数据：压测不读取现有浏览器个人资料，Chrome/Edge 使用临时隔离 profile；证据不包含主机名、用户名或绝对路径。
- UI/交互：无用户可见代码变更；执行真浏览器验证时会短暂打开隔离浏览器窗口。
- 安全：预览仅监听 `127.0.0.1`；工装拒绝非回环目标且不保存生成的录屏或项目资料。
- 发布：纯测试/仓库任务，不运行 `app:deliver`，不产生对外发行包。

## 验收条件

- [x] 固定压力矩阵、参数和严格结果 schema 进入仓库，并有 12 项自动化契约/篡改测试。
- [x] 工装可在 macOS 启动真实 Chrome/Safari，并可在真实 Windows 启动 Chrome/Edge；真实资格、GPU 状态和 OS/浏览器/自动化组合均 fail-closed，不使用结构测试替代真机结果。
- [x] 各场景记录首载、内存、WebGL/GPU、FPS/掉帧、输出大小、长会话增长、崩溃/context lost 和不支持指标的原因。
- [x] macOS Chrome 完成 standard 真机实测并提交去敏原始 JSON；Safari 因 Remote Automation 未授权而 `blocked`，Windows 因无真实主机/获批 3D GPU VM 而 `not_run`，报告均列出最低用户动作。
- [x] 报告只基于实测证据给出结论，没有新增业务限制或实施产品优化。
- [x] `npm run test:web`、`npm run test:foundation`、`npm run test:i18n`、影响测试和 `npm run test:full` 均通过。
- [x] 真浏览器执行与双信号中断验证后，没有遗留预览服务、浏览器/profile、Crashpad、录屏、下载或构建产物。
- [x] 用户可见任务已执行 `npm run app:deliver`，并从固定 App 看到本次变化；不适用：本任务只改测试工装、QA 和文档，且 00 明确禁止更新固定 App。
- [x] `CURRENT_STATE`、`KNOWN_ISSUES`、测试策略、文档索引、QA 证据和影响映射已更新；不新增产品功能登记。

## 测试计划

- 影响映射模块：`web-stress`、`foundation`、`build-config`
- 主应用模块参数：无
- 最小命令：`npm run test:web`、`npm run test:foundation`、`npm run test:i18n`、`npm run test:impact -- --base d0c7815`
- 升级到全量的条件：包配置或影响映射要求，或真浏览器暴露未知跨模块回归
- 人工检查尺寸/步骤：1440×900 真浏览器隔离窗口；执行矩阵全流程并核对证据文件
- 固定 App 交付：不适用；不改变安装包，且本任务禁止更新 `~/Applications/PreVision.app`

## 实施记录

- 假设：不存在用户已授权的 Windows 主机时，本任务允许以“macOS 实测 + Windows 可执行工装 + 阻塞记录”交接，但不得声称 Windows 已验证。
- 关键决定：证据优先；不因压测任务修改产品行为。
- 实际修改：新增零依赖真浏览器压力工装与固定 9 场景矩阵；Chrome/Edge 通过有界面私有 CDP pipe、Safari 通过 WebDriver，使用隔离 profile、回环预览、外连抑制和幂等清理。Windows 即使浏览器根进程已退出，也会按本轮唯一 profile 精确重发现并清理 Chromium/Crashpad，拒绝相似 sibling profile。新增严格递归 evidence schema、跨字段/平台/产物签名校验、工装哈希绑定及 12 项自动测试。完成最终代码绑定的 macOS Chrome standard 真机重跑并提交去敏 JSON；记录 Safari 授权阻塞、Windows 实机阻塞和解除阻塞的最小动作。同步性能报告、当前状态、已知问题、测试策略和影响映射；未改产品 HTML、UI、i18n、app-shell 或业务行为。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| 初次 `npm run app:status` | 环境依赖阻塞 | <1s | 短期 Worktree 没有本地 `node_modules/@electron/asar`；未修改依赖或固定 App。 |
| Node 24 + 主仓库只读 `NODE_PATH` 的 `npm run app:status` | 通过 | <1s | installed source `7ff9aa5`；基线 `d0c7815` contains=yes、exact=no。 |
| `task:status` / `task:check` / `task:claim` | 通过 | <1s | 与 03 只有 `qa/test-impact-map.yaml` 文件软冲突；约定 04 先集成。 |
| Node 24 `npm run web:stress:check` | 通过 | <1s | Chrome 可运行；Safari 26.6 已安装但 Remote Automation 未授权；无 Windows 主机/VM。 |
| 最终代码 Node 24 Chrome standard + `--attestation physical-machine` | 通过 | 146.36s | Windows 清理复核修正后真实重跑；有界面真浏览器 9/9，`completed=true`、`matrixEvidenceEligible=true`、`cleanup=passed`；0 崩溃、0 context lost。 |
| 证据 schema / 跨字段 / SHA-256 / 去敏复验 | 通过 | <1s | 原始 JSON 与当前 lib、runner、matrix、schema 四个哈希一致；不含用户名、主机名、绝对路径、PID、profile 或项目/媒体字节。 |
| 双 `SIGTERM` 集成验证 | 通过 | 约 2s | 退出码 130；不写完成证据，无浏览器、profile、Crashpad、构建目录或 partial 文件残留。 |
| 最终 P0/P1 代码与安全复核 | 通过 | 人工 | 发现并修正 Windows 根进程先退时可能跳过孤儿子进程清理；最终实现按唯一 profile 重发现 Chromium/Crashpad，拒绝相似 sibling，复核无误杀/注入/命令行泄露 P0/P1。 |
| Node 24 `npm run test:web` | 通过 | 约 2s | Web 运行底座 9/9，压力工装 12/12。 |
| Node 24 `npm run test:foundation` | 通过 | 约 2s | 仓库基础 81/81、协调 20/20、i18n 21/21。 |
| Node 24 `npm run test:i18n` | 通过 | <1s | 21/21；本任务未新增或修改用户界面文案。 |
| Node 24 `npm run test:impact -- --base d0c7815` | 通过 | 1.9s | 检出 17 个变化文件；Web 9+12、Desktop 43、Foundation 81、协调 20、i18n 21 影响集全部通过。 |
| Node 24 `npm run test:full` | 通过 | 16.54s | App 562、Web 9+12、Desktop 43、安装事务 36、交付门禁 13、Foundation 81、协调 20、i18n 21 全通过。 |
| JSON 解析 / `git diff --check` / 残留与敏感信息扫描 | 通过 | <1s | QA JSON 均可解析；无空白错误、敏感本机路径、构建产物或运行残留。 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；纯测试/仓库任务，且 00 明确禁止本任务交付固定 App。

## 未覆盖与后续

- Safari 26.6 没有由用户启用 Remote Automation，故未执行 standard；最低动作是用户亲自运行 `/usr/bin/safaridriver --enable` 或在 Safari 开发菜单允许 Remote Automation，然后重跑环境审计与矩阵。不要向 Codex 提供管理员密码。
- 当前没有真实 Windows 10/11 主机、获批的 3D 加速 Windows VM 或授权连接，因此 Windows Chrome/Edge 未实测；最低动作是提供此类环境，在 Windows 内安装 Node 20–24 与 Chrome，并分别本地执行 Chrome/Edge 矩阵。CI、macOS Edge 和模拟数值不算实机证据。
- 最终工装绑定的是一次 macOS Chrome standard，不建立跨设备阈值。场景切换时 renderer resource count、JS heap 与进程树 RSS 均显著增长；后续应单独诊断资源所有权/`dispose()`，但单次 120 秒观察仍不能直接宣称无界内存泄漏或设置用户上限。
- 工装通过进程/浏览器外连抑制与回环限制保护数据，但未做系统级抓包，因此不把本轮表述为“已证明零外连尝试”。

## 交接

- 最终提交：本验收单所在的聚焦提交；完整 SHA 在 04→00 交接消息中提供
- PR：无；不连接远程
- 工作区状态：完成提交后 clean；无构建产物或运行残留
- 下一步：由 00 先集成本 04 提交，再让 03 按新基线接入；获得 Safari 授权或真实 Windows 环境后，用同一工装补齐相应真机证据。
