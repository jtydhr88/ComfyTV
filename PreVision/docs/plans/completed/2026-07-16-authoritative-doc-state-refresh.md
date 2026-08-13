# 任务：04.7｜权威状态与性能文档事实纠偏

- 状态：completed
- 日期：2026-07-16
- 对话：04.7｜权威状态与性能文档事实纠偏
- 分支：`docs/04.7-authoritative-doc-state-refresh`
- 基线：`a706161afd10daf3b090bf67c7b656599d344414`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（`app:status`：contains yes，exact no）
- 负责人：Codex 独立短期文档临时工

## 并行任务声明

- 任务 ID：`04.7-authoritative-doc-state-refresh`
- 模式：write
- 模块：`repository`
- UI 表面：无
- 数据区域：无
- 预计修改文件：`docs/CURRENT_STATE.md`、`docs/KNOWN_ISSUES.md`、`docs/WEB_PERFORMANCE.md`、`docs/WEB_RUNTIME.md`、`docs/plans/active/2026-07-16-modal-command-ownership.md`、`docs/plans/completed/2026-07-16-modal-command-ownership.md`、`docs/plans/active/2026-07-16-authoritative-doc-state-refresh.md`、`docs/plans/completed/2026-07-16-authoritative-doc-state-refresh.md`、`docs/plans/completed/README.md`
- `task:check` 结果：无硬冲突；与 `01.12-autosave-terminal-flush` 仅 `docs/plans/completed/README.md` 文件软冲突，集成顺序固定为 04.7 先、01.12 后并保留双方索引
- `task:claim`：已登记；与 check 使用完全相同范围
- `task:release`：未释放；由 00 集成成功后释放

## 用户问题

当前权威状态、Web 运行与性能文档仍把已经进入集成线的 01.10、04.5、03.2 和 03.3 成果写成 active、候选或尚未接入，容易混淆“源码已集成”“固定 App 已安装”和“Web 已公开部署”三个不同状态；01.10 验收单还保留了不可持久验证的 userData 恢复说法。

## 目标

- 以当前代码、Git、`app:status` 和既有可重复证据纠正权威状态文档。
- 明确当前集成 HEAD、04.5 资源生命周期修复、Web 首页与导演台组装的真实集成状态和交付边界。
- 在 `WEB_PERFORMANCE.md` 保留修复前压力基线，并增加修复后正式证据。
- 把 01.10 验收单去敏校正为 completed 并归档，不声称存在可供稍后恢复的临时快照。
- 归档本任务验收单并更新 completed 索引。

## 非目标

- 不修改业务代码、测试代码、i18n、QA 契约/登记、功能状态或版本号。
- 不处理新 Bug 或功能，不部署 Web，不更新稳定预览。
- 不运行 `app:deliver`、`app:update`、`package` 或 `make`，不关闭固定 App。
- 不读取、导出、哈希、复制、恢复或修改正式 userData 或用户项目。

## 证据与现状

- 代码：`web/home/` 已存在；当前源码包含模态命令所有权、Three.js 资源生命周期和首页到 `/director/` 组装实现。
- Git：当前 HEAD 为 `a706161`，分支为 `docs/04.7-authoritative-doc-state-refresh`；开工时工作区 clean。
- 测试/运行：Node 24.18.0；`app:status` 为 installed `7ff9aa5`、current `a706161`、contains yes、exact no；`task:status` 中 01.10 claim 已不存在。
- 文档/历史线索：04.5、03.2、03.3 已有 completed 验收单与去敏证据；本任务只引用其既有结果，不冒充重新执行。

## 影响范围

- 模块：`repository`
- 文件：仅并行任务声明中的文档与验收单
- 数据格式：无
- 平台：仓库文档；同时澄清 macOS 固定 App、静态 Web、Safari 与 Windows 验证边界

## 风险

- 数据：不得访问或猜测正式 userData/用户项目内容；01.10 只记录去敏、可验证事实。
- UI/交互：无运行时改动。
- 安全：不得写入绝对路径、本机进程或运行环境标识、项目内容或隐私指纹。
- 发布：必须区分源码已集成、固定 App 尚未更新、Web 尚未公网部署。

## 验收条件

- [x] `a706161`、父提交、01.10/04.5/03.2/03.3 集成关系与当前 claim 状态记录准确。
- [x] 04.5 改为“源码已集成、固定 App 待更新”，KI-021 残余风险保留。
- [x] Web 首页和导演台组装改为已进入当前源码，仍明确 Safari/Windows 真机与公网部署未完成。
- [x] `WEB_PERFORMANCE.md` 同时保留修复前压力基线与修复后正式证据。
- [x] 01.10 去敏归档，不保留不可持久验证的快照恢复说法。
- [x] `test:foundation`、`test:web`、`test:i18n`、`test:impact -- --base a706161...` 和 `git diff --check` 通过。
- [x] 陈旧表述、敏感信息、绝对路径和意外文件检查通过。
- [x] 相关自动测试通过。
- [x] 需要的人工验证完成；本任务为纯文档，无 UI 人工截图要求。
- [x] 固定 App 交付不适用：本任务未运行 `app:deliver`。
- [x] 文档状态与 completed 索引已更新。

## 测试计划

- 影响映射模块：foundation、web-stress
- 主应用模块参数：无
- 最小命令：`npm run test:foundation`、`npm run test:web`、`npm run test:i18n`、`npm run test:impact -- --base a706161afd10daf3b090bf67c7b656599d344414`
- 升级到全量的条件：影响映射发现未识别或超出纯文档范围的变化
- 人工检查尺寸/步骤：不适用；人工检查 Git 祖先关系、文档措辞、敏感信息和索引完整性
- 固定 App 交付：不适用；本任务不改变安装包

## 实施记录

- 假设：04.5、03.2、03.3 的性能/真浏览器数字引用其已归档既有证据；本任务不重新运行压力矩阵。
- 关键决定：当前源码事实以 `a706161` 为界，固定 App 事实以 `app:status` installed source 为界，公网状态以仓库部署证据为界。
- 实际修改：`CURRENT_STATE` 记录 `a706161` / `a268ce4`、01.10 集成与既有验收证据；04.5 改为当前源码已含 `d4bb4be` / `f0f0572` / `62e20fe`，固定 App 仍待更新；Web 首页/导演台改为当前源码已含 `6da46a0` / `995f9e7` / `d28eaf5`。
- 实际修改：`WEB_PERFORMANCE` 保留修复前压力基线并增加修复后 40 次、120 秒与短播放正式证据；`WEB_RUNTIME` 明确当前 `/` 为 `web/home/` 首页并在完成后进入 `/director/`，同时保留缺首页时的契约回退。
- 实际修改：KI-020 改为“源码已集成、固定 App 待更新”，KI-021 不变；01.10 去敏校正为 completed 并归档，只保留可持久验证的 userData 风险事实与更新前手动保存项目建议。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci`（Node 24，隔离缓存） | 通过 | 13.34s | 安装 504 个锁定包；未修改受管文件；上游审计报告 23 个既有依赖漏洞，本纯文档任务不改依赖 |
| `npm run app:status` | 通过 | <1s | installed `7ff9aa5`；current `a706161`；contains yes；exact no |
| `npm run task:status` | 通过 | <1s | 01.10 claim 不存在；当前仅 01.12 write claim |
| 同范围 `task:check` → `task:claim` | 通过 | <1s | 无硬冲突；仅与 01.12 的 completed 索引软冲突，04.7 先、01.12 后 |
| `git merge-base --is-ancestor` × 7 | 通过 | <1s | `d4bb4be`、`f0f0572`、`62e20fe`、`6da46a0`、`995f9e7`、`d28eaf5`、`a706161` 均属于基线 HEAD |
| `npm run test:foundation` | 93 + 31 + 21 + 11 / 0 | 1.76s | foundation、coordination、i18n、project-input wrapper 全通过 |
| `npm run test:web` | 10 + 14 / 0 | 0.94s | 首次沙箱内仅因禁止监听 `127.0.0.1` 失败；获准回环监听后 Web runtime 与压力工装全通过 |
| `npm run test:i18n` | 21 / 0 | 0.43s | 双语 key、运行时、引用与直接中文守卫通过 |
| `npm run test:impact -- --base a706161...` | 通过 | 3.00s | 检测 8 个文档变化文件，仅命中 foundation、web-stress；两组均通过 |
| 陈旧表述与历史点检查 | 通过 | <1s | 权威文档无候选/未接入旧说法；03.2/03.3 历史阶段记录保留 |
| 敏感信息、绝对路径与意外文件检查 | 通过 | <1s | 无项目内容、凭据、绝对路径、本机进程或运行环境标识、隐私指纹；仅声明内文档 |
| `git diff --check` | 通过 | <1s | 无空白错误 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：未启动、未关闭、未更新；纯文档任务不适用。

## 未覆盖与后续

- Safari Remote Automation、真实 Windows Chrome/Edge 和 Web 公网部署仍未完成。
- 固定 App 继续停留在 `7ff9aa5`，由 00 在后续用户可见集成交付中统一决定更新。

## 交接

- 最终提交：本验收单所在纯文档聚焦提交（精确 hash 见 04.7 交接）
- PR：无（仓库无 remote）
- 工作区状态：提交前仅包含声明内文档；提交后由交接复核 clean
- 下一步：保持 claim 交 00 先集成 04.7；01.12 后集成并机械保留双方 completed 索引，00 集成成功后释放本 claim。
