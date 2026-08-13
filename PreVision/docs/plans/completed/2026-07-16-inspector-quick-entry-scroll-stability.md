# 任务：右栏快捷入口滚动稳定定位

- 状态：completed
- 日期：2026-07-16
- 对话：03.11｜右栏快捷入口滚动稳定定位
- 分支：fix/03.11-inspector-shortcut-scroll-target
- 基线：e3826edd1907a7be155a030d186a577ce1bbc0fb
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（Node 24 `app:status` 已核验；本任务未更新）
- 负责人：Codex 独立短期 UI Bug 临时工

## 并行任务声明

- 任务 ID：03.11-inspector-shortcut-scroll-stability
- 模式：write
- 模块：layout
- UI 表面：app-shell, inspector
- 数据区域：无
- 预计修改文件：
  - `预见PreVision.html`
  - `测试/冒烟测试.mjs`
  - `测试/项目输入DOM探针.cjs`
  - `docs/plans/active/2026-07-16-inspector-quick-entry-scroll-stability.md`
  - `docs/plans/completed/2026-07-16-inspector-quick-entry-scroll-stability.md`
  - `docs/plans/completed/README.md`
  - `docs/qa/inspector-quick-entry-scroll-stability/README.md`
  - `docs/qa/inspector-quick-entry-scroll-stability/` 内去敏截图
- `task:check` 结果：无硬冲突；与 01.13 的约定集成顺序为 01.13 先、03.11 后（当前共享登记仅显示本任务）。
- `task:claim`：已登记
- `task:release`：未释放（完成交接后保持 claim，等待 00 释放）

## 用户问题

右栏从收起、peek 或 director-focus 打开快捷入口时，`openInspector()` 仅等待一帧即平滑滚动；CSS 宽度过渡尚未结束，重排会使滚动目标过量，目标 summary 可能最终到底部或离开可视区。

## 目标

- 在布局稳定后，把四个右栏快捷入口的对应 summary 完整定位到 `#rightScroll` 可视区。
- 最后一次快捷入口意图获胜，并在用户手动滚动或面板状态改变时不抢夺滚动所有权。

## 非目标

- 不改项目、历史、自动保存或项目数据。
- 不改变右栏 pin/peek/expanded、宽度偏好、分隔条、director-focus、键盘/ARIA 或正常过渡语义。
- 不更新固定 App、稳定预览或发布产物。

## 证据与现状

- 代码：旧 `openInspector()` 在展开后仅用单个 `requestAnimationFrame()` 调用 smooth scroll；修复后会话 token 取消旧请求，并由 `ResizeObserver`、实际宽度与 CSS transition animation 状态共同确认连续稳定两帧后定位。
- Git：从指定 `e3826ed` 开工；业务实现提交为 `73852ce31a5380b218b89e6bf54c3b0e13ecc000`。本轮仅补充探针、截图和验证证据，不改写该实现提交。
- 测试/运行：强制运行环境为 Node v24.14.0；默认 Node 26 未用于任务命令。测试环境通过本机既有锁定 Electron 副本提供 `NODE_PATH`，未改业务依赖、lockfile 或固定 App。
- 文档/历史线索：layout 模块已有右栏状态、分隔条和 director-focus 回归。

## 影响范围

- 模块：layout
- 文件：见并行任务声明
- 数据格式：无
- 平台：macOS Chromium/Electron 开发测试与 Node 回归

## 风险

- 数据：无项目数据读写或格式变更。
- UI/交互：异步滚动必须准确取消旧意图且不覆盖用户滚动。
- 安全：QA 截图和记录去敏，不包含用户项目或绝对路径。
- 发布：快速开发预览；固定 App 不更新。

## 验收条件

- [x] 四个入口在收起、peek、expanded 与 director-focus 可用状态下稳定定位相应 summary。
- [x] 1316×768、1440×900、1600×900 触发后两秒稳定，不滚到底、不跳相邻 section。
- [x] 连续切换最后一次意图获胜；手动滚动或状态变更不被旧异步任务覆盖。
- [ ] 包装 `project-input`、impact、full 尚受 Electron GPU 启动器环境阻塞；隔离真实 Chromium 任务矩阵、layout 与 i18n 已通过，详见验证结果。
- [x] 真 Chromium 几何验证完成并保留去敏证据。
- [x] 固定 App 未更新：本任务仅快速开发与任务级验证，交由 00 集成/最终交付。
- [x] 文档和完成索引已更新。

## 测试计划

- 影响映射模块：layout
- 主应用模块参数：layout
- 最小命令：`npm run test:module -- layout`、`npm run test:project-input`、`npm run test:i18n`
- 升级到全量的条件：HTML 与应用/项目输入测试变化；执行指定 `test:impact` 和 `test:full`。
- 人工检查尺寸/步骤：1316×768、1440×900、1600×900 的四入口、收起→展开、peek、director-focus、快速切换和手动滚动所有权。
- 固定 App 交付：不适用；快速开发与任务级验证，目标路径仍为 `~/Applications/PreVision.app`，本任务不更新。

## 实施记录

- 假设：CSS `transitionend` 与几何稳定检查可替代脆弱长延时，并由会话 token 取消旧滚动。
- 关键决定：不使用固定 timer 或双 rAF 作为完成条件；仅当宽度不变、`ResizeObserver` 未报告新尺寸且 CSS transition 不在 running 时才执行一次即时定位。wheel/pointer/touch/keyboard 输入，以及 right panel/director-focus 状态变化均使 token 失效。
- 实际修改：在 `预见PreVision.html` 增加可取消的 `scheduleInspectorScroll`/`scrollInspectorSummary`；在 Electron DOM 探针增加 48 组合真 Chromium rect/scrollTop 回归、CDP wheel、最后意图和面板变更取消验证；新增三张去敏截图和 QA 说明。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| 初始 `npm run app:status` | 未完成 | <1s | 默认 Node 26 不合规且缺少 `@electron/asar`；未继续使用 Node 26。 |
| Node 24 `npm run app:status` | 通过 | <1s | 固定 App 来源为 `7ff9aa5`；未更新。 |
| Node 24 `npm run task:status` | 通过 | <1s | 本任务 scope claim 保持 active。 |
| Node 24 `npm run task:check -- ...` | 通过 | <1s | 原声明范围无硬冲突。 |
| `npm run test:module -- layout` | 通过 | <15s | 143 passed, 0 failed。 |
| `npm run test:i18n` | 通过 | <5s | 21 passed, 0 failed。 |
| Node 24 隔离 Electron Chromium 探针 | 通过 | <90s | 3 视口 × 4 模式 × 4 入口，48 项均在初稳/两秒后完整可见且稳定；CDP wheel、最后意图、面板取消通过。 |
| Node 24 隔离 Electron Chromium 探针（最终） | 通过 | <90s | 3×4×4=48；每项初稳与两秒后重新读取 summary/scrollport rect、visible、max、scrollTop。12 次 CDP wheel 均命中 `#rightScroll` 且记录前/后/旧异步窗口值；示例 1316×768：1737.5→1857.5→1857.5。 |
| `npm run test:project-input` | 未通过（环境） | <5s | 包装启动器的 Electron GPU 子进程反复以 exit 5 退出，最终 `GPU process isn't usable`，退出码 1；未改依赖规避。上述隔离真实 Chromium 探针通过。 |
| `npm run test:impact -- --base e3826edd1907a7be155a030d186a577ce1bbc0fb --module layout` | 未通过（环境） | <35s | app 931、foundation 93、coordination 31、i18n 21、probe launcher 11 均通过；随后 project-input 遇相同 GPU 启动器错误，impact 退出码 1。 |
| `npm run test:full` | 未通过（环境） | <35s | 先完成 app 931；随后 project-input 遇相同 GPU 启动器错误，full 退出码 1，后续链路未运行。 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（Node 24 `npm run app:status` 已核验；未更新）

固定 App 人工启动结果：未启动；本任务禁止更新、关闭或验收固定 App。

## 未覆盖与后续

- 残余风险：仅覆盖 macOS Chromium/Electron；Safari、Windows 和用户的自定义辅助技术滚动设置未在本任务验证。当前包装 Electron 启动器存在 GPU 子进程环境失败，因而 project-input、impact、full 尚未取得通过结果；隔离真实 Chromium 的任务矩阵通过。未读取项目数据，未改变项目格式、历史或自动保存。

## 交接

- 业务实现提交：`73852ce31a5380b218b89e6bf54c3b0e13ecc000`。
- 本轮收尾验证提交：`aadca99989a8b92e07e2bdab9785881e206b8017`；本行所在的后续纯文档提交不自引用。
- PR：无（仓库无 remote）
- 工作区状态：提交前 clean；本任务保持 claim。
- 下一步：00 按约定在 01.13 之后集成，保留本任务 claim 直至集成成功后释放；调度元数据为 GPT-5.6-Terra / high / Flex 标准速度，仅作运行记录，不作为业务验收证据。
