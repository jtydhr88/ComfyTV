# 任务：01.10｜模态窗口命令所有权与背后快捷键隔离

- 状态：completed
- 日期：2026-07-16
- 对话：01.10｜模态窗口命令所有权与背后快捷键隔离
- 分支：`fix/01.10-modal-command-ownership`
- 基线：`a268ce495c97e2d41c2bb86eec186e200f81dfe0`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（`app:status`：contains yes，exact no）
- 负责人：Codex 独立短期 Bug 临时工

## 并行任务声明

- 任务 ID：`01.10-modal-command-ownership`
- 模式：write
- 模块：actor,camera,desktop,history,layout,playback,project,robustness,storyboard,testing,timeline,viewport
- UI 表面：app-shell,dialogs,topbar,left-rail,inspector,timeline,viewport
- 数据区域：actor-rig,autosave,electron-ipc,object-paths,project-v5,qa-metadata,shot-camera
- 实际修改文件：`预见PreVision.html`、`测试/冒烟测试.mjs`、`测试/桌面壳测试.mjs`、`测试/项目输入DOM探针.cjs`、本验收单、`docs/qa/modal-command-ownership/`、`docs/FEATURE_REGISTRY.md`、`qa/feature-registry.yaml`
- `task:check` 结果：实现任务执行时无硬冲突
- `task:claim`：实现期间已登记；2026-07-16 当前 `task:status` 已无本任务 claim
- `task:release`：已释放或不存在；04.7 未重新创建 01.10 claim

## 用户问题

普通模态窗口打开后，Space、Delete/Backspace 及其他画布、播放、时间轴和项目级快捷键仍可穿透并作用于背后工作区，存在播放状态变更、误删对象、误保存或误打开项目等风险；现有处理缺少统一的最上层命令所有者边界。

## 目标

- 建立唯一、可复用的当前最上层命令所有者/模态拥有者判断入口，以最上层可见 dialog/modal 作为键盘命令所有者。
- 模态期间隔离背后工作区的画布、播放、时间轴、项目与 Electron open/save 全局命令，并证明 project、selection、history、autosave、time/playing 零副作用。
- 保留分镜应用内全屏 Esc 两阶段、普通 dialog 只关闭顶层、无 dialog 清选与既有全局快捷键语义。
- 保留模态内本地控件、原生编辑、组合键、composition 和 `defaultPrevented` 语义，支持 macOS Cmd 与 Windows/Linux Ctrl。
- 覆盖嵌套 dialog、动态关闭与恢复场景，不建立持久锁。

## 非目标

- 不处理 Seedance 提示词 Cmd+C/剪贴板问题。
- 不处理窄屏门禁、右栏布局、对比度、录制/导出或主题重做。
- 不改变 project v5、autosave/history、对象路径、摄影机或时间轴数据格式与业务语义。
- 不由临时工运行 `app:deliver`，不更新固定 App。

## 证据与现状

- 代码：工作区级键盘监听、dialog 打开入口与 Electron renderer 菜单 open/save 回调均已收敛到同一实时命令所有权判断；非模态 `dialog.show()`/静态 `open` 不夺权。
- Git：最终实现与集成提交为 `a706161afd10daf3b090bf67c7b656599d344414`，父提交为任务基线 `a268ce495c97e2d41c2bb86eec186e200f81dfe0`。
- 测试/运行：真 Chromium DOM probe、真 Chrome 与隔离 Electron 均确认快捷键 dialog 中 Space/Delete 不穿透；无 modal 时原命令恢复；自动回归、impact 与 full 均通过。
- 文档/历史线索：分镜规划器已有应用内全屏 Esc 两阶段语义；APP-003/APP-004 记录项目 open/save 和原生编辑撤销边界。

## 影响范围

- 模块：actor、camera、desktop、history、layout、playback、project、robustness、storyboard、testing、timeline、viewport
- 文件：见并行任务声明
- 数据格式：无；只增加瞬时命令所有权判断与回归，不持久化锁状态
- 平台：macOS Electron/Chrome；快捷修饰键逻辑同时覆盖 Windows/Linux Ctrl

## 风险

- 数据：错误的拦截顺序可能触发删除、autosave 或 history，或反向阻断无模态项目命令；既有执行级回归覆盖零副作用。
- UI/交互：可能破坏模态内按钮、表单编辑、焦点、Tab、Enter/Space 与分镜全屏 Esc；既有自动与人工证据通过。
- 安全：Electron 原生菜单命令若绕过 renderer 所有权判断，可能打开系统文件对话框或保存背后项目；renderer callback 已纳入同一 gate。
- 发布：实现已进入当前源码，但固定 App 仍为 `7ff9aa5`；01.10 没有执行 `app:deliver`。

## 验收条件

- [x] 存在唯一、可复用且实时计算的最上层命令所有者入口，多个/嵌套 dialog 只认顶层，关闭/恢复后无永久锁。
- [x] 模态打开时 Space、Delete/Backspace、G/R/C/F/K、方向键和其他工作区全局命令均不穿透，状态零副作用。
- [x] 模态内 Cmd/Ctrl+S/Z/Y/Shift+Z、组合键、composition 与 `defaultPrevented` 遵守本地/原生语义；项目 open/save 不穿透。
- [x] 模态本地按钮、select、input/textarea/contenteditable、滚动、Tab/Shift+Tab、Enter/Space 正常。
- [x] 分镜全屏 Esc 两阶段、普通 dialog 顶层关闭、无 dialog 清选和全部既有无模态快捷键语义保持。
- [x] 自动回归覆盖快捷键 dialog、普通 dialog、分镜普通/全屏、嵌套顶层、非模态 dialog 与无 dialog 状态，以及 macOS/Windows/Linux 修饰键差异。
- [x] 相关模块、`test:i18n`、`test:desktop`、`test:impact -- --base a268ce4` 和 `test:full` 通过。
- [x] Electron 开发态与真 Chrome 人工验证完成，去敏证据进入 `docs/qa/modal-command-ownership/`。
- [x] 实现已集成为 `a706161`，01.10 claim 已释放或不存在。
- [x] 固定 App 本任务未更新；不把源码集成描述为已安装。
- [x] userData 风险事件以去敏、可持久验证的事实收口，不自动覆盖或猜测恢复。

## 测试计划

- 影响映射模块：history、layout、playback、robustness、actor、camera、project、timeline、viewport、storyboard、desktop
- 主应用模块参数：见验证结果
- 最小命令：相关 module、`npm run test:i18n`、`npm run test:desktop`
- 升级到全量的条件：本任务跨模块、涉及单体 HTML 全局键盘分发与项目命令边界，因此固定运行 impact 与 full
- 人工检查尺寸/步骤：真 Chrome 与隔离 Electron，覆盖快捷键 dialog 的 Space/Delete、分镜全屏 Esc 两阶段和无 modal 快捷键恢复
- 固定 App 交付：未执行；固定入口仍来自 `7ff9aa5`

## 实施记录

- 假设：命令所有者必须从当前真实 top-layer/modal 状态实时推导；序号仅用于多个已确认 modal 的打开顺序，不构成持久锁。
- 关键决定：原生 `<dialog>` 优先使用 Chromium `:modal` 判断，应用内 `showModal()` 入口记录打开顺序；`dialog.show()` 和静态 `<dialog open>` 明确视为非模态。ARIA modal 只在可见、可聚焦且实时参与所有权时进入候选。
- 关键决定：所有工作区命令统一经过 `currentCommandOwner` / `workspaceOwnsGlobalCommand` / `runWorkspaceCommand`；Electron 菜单 open/save 的 renderer callback 也走同一 gate。
- 关键决定：`defaultPrevented` 与 composition 优先；有 modal 时只拦截会触发浏览器/项目全局行为的精确 O/S，保留 modal 内按钮、表单、焦点、滚动与原生编辑行为。
- 实际修改：`预见PreVision.html` 增加统一命令所有权入口并接入全局键盘及桌面项目回调；应用、桌面与真 Chromium probe 增加执行级回归；功能登记与去敏 QA 证据同步更新。`electron/main.cjs` 经复核无需修改。

### userData 风险事件的去敏收口

- 曾发生 Electron 开发实例误用正式 userData；这是需要保留的风险事件事实。
- 当前没有可证明的精确事前持久快照，因此没有自动覆盖、猜测恢复或声称存在任何可供稍后恢复的临时快照。
- 用户确认 05:37 后未参与编辑。下次正式 App 更新前，应由用户从当前固定 App 手动执行“保存项目”，形成一个明确、可自行保管的项目文件；这是更新前的谨慎措施，不是对 autosave 内容的推断或恢复。
- 04.7 文档纠偏没有读取、导出、哈希、复制、恢复或修改正式 userData/用户项目，也没有把项目内容、绝对路径、本机进程或运行环境标识、隐私指纹写入仓库。

## 验证结果

以下是 01.10 已有验收证据，04.7 只校正文档状态，没有冒充重新执行：

| 命令/步骤 | 结果 | 备注 |
| --- | --- | --- |
| `npm ci` | 通过 | Node v24.14.0；仅安装锁定依赖 |
| `npm run app:status` | 通过 | installed `7ff9aa5`；01.10 基线 `a268ce4`；contains yes，exact no |
| `test:module -- history/layout/playback/robustness` | 29 / 143 / 32 / 57 | modal/nonmodal、嵌套、修饰键、composition/defaultPrevented 与零副作用覆盖 |
| `test:module -- actor/camera/project/timeline/viewport/storyboard` | 147 / 84 / 103 / 124 / 31 / 172 | Delete、项目命令、时间轴、画布与分镜 Esc 回归通过 |
| `npm run test:desktop` | 47/0 | 执行级 mock 验证 modal 开/关时 renderer open/save callback |
| `npm run test:project-input` | 通过 | Web/Electron 真 Chromium 控件、编辑、滚动与实时 topmost probe |
| `npm run test:i18n` | 21/0 | 双语 key 与直接中文守卫通过 |
| `npm run test:impact -- --base a268ce4` | 通过 | app 926、desktop 47、foundation/coordination/i18n、project-input、Web 全绿 |
| `npm run test:full` | 通过 | app 926、project-input、Web、desktop 47、local install 36、delivery 13、foundation 93、coordination 31、i18n 21 |
| 真 Chrome / 隔离 Electron 人工复核 | 通过 | Space/Delete 隔离、无 modal 恢复、分镜全屏 Esc 两阶段 |
| 04.7 `task:status` | 通过 | 当前登记中已无 `01.10-modal-command-ownership` claim |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：01.10 未运行 `app:deliver`，未更新或重新启动固定 App。

## 未覆盖与后续

- 未点击真实系统 open/save 文件对话框；已有 renderer callback 执行级 mock 与精确快捷键 gate 覆盖该边界，不夸大为系统对话框端到端。
- 下次正式 App 更新前，由用户从当前固定 App 手动“保存项目”形成明确文件；不安排自动 autosave 覆盖或猜测恢复。

## 交接

- 最终实现/集成提交：`a706161afd10daf3b090bf67c7b656599d344414`
- PR：无（仓库无 remote）
- 工作区状态：实现已进入当前集成基线；验收单由 04.7 去敏校正并归档
- 下一步：04.7 文档提交交 00 集成；固定 App 仍未交付 01.10。
