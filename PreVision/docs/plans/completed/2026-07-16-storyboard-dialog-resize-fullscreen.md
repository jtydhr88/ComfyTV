# 任务：分镜规划器全屏与四角缩放

- 状态：completed
- 日期：2026-07-16
- 对话：03.6｜分镜规划器全屏与四角缩放
- 分支：`fix/storyboard-dialog-resize-fullscreen`
- 基线：`a05b21dfa5c20263044b416dc3a27f5c3556c964`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 负责人：Codex 独立短期临时工

## 并行任务声明

- 任务 ID：`03.6-storyboard-dialog-resize-fullscreen`
- 模式：write
- 模块：`storyboard,layout,i18n`
- UI 表面：`dialogs`
- 数据区域：`i18n-resources`
- 预计修改文件：`预见PreVision.html`、`测试/冒烟测试.mjs`、两个语言包、本验收单、`docs/qa/storyboard-dialog-resize-fullscreen/`、`docs/plans/completed/README.md`
- `task:check` 结果：无硬冲突；仅 completed README 与 04.3 文件重叠，按 04.3 先、本任务后集成
- `task:claim`：已登记
- `task:release`：未释放，交 00 集成后释放

## 用户问题

分镜规划器现有单一右下角缩放和全屏往返的操作、键盘、视口夹取与无副作用保障不完整，长文本还可能挤压固定区域。

## 目标

- 普通态提供 NW/NE/SW/SE 四角指针与键盘缩放，对边稳定、最小/最大/视口边距正确。
- 标题栏空白区双击切换应用内全屏，全屏时角控件不可见、不可聚焦且不响应。
- 还原进全屏前几何并按新视口夹取；Esc 两阶段且输入、计划、选择和滚动零丢失。
- 仅 `#storyText` 禁用 textarea 原生缩放，长文本在输入框内部滚动。

## 非目标

- 不新增四条边缩放，不新增标题栏单击拖动，不调用 macOS 原生全屏。
- 不改变 StoryboardPlan、project v5、autosave 或分镜分析/应用语义。
- 不执行 `app:deliver`，不更新固定 App 或 4175。

## 证据与现状

- 代码：基线仅 `#storyResizeHandle` 右下角缩放；全屏按钮与 Esc 一次还原已存在。
- Git：干净基线 `a05b21d`，固定 App 来源是其祖先，当前已建独立分支。
- 测试/运行：Node 24.18.0 `npm ci` 完成；`app:status` 通过；初次 `task:status` 无 active claim。
- 文档/历史线索：已完整读取离线分镜 v2 验收单，本任务是其窗口交互增量。

## 影响范围

- 模块：storyboard、layout、i18n。
- 文件：以 claim 中完整列表为准。
- 数据格式：无。
- 平台：Web 渲染进程与 Electron 开发预览。

## 风险

- 数据：全屏/还原不得触发 plan、project、autosave 或 selection 写入。
- UI/交互：四角锚定、小视口夹取、指针结束事件与焦点可访问性风险高。
- 安全：不引入网络或真实付费 AI。
- 发布：仅开发预览，不安装固定 App。

## 验收条件

- [x] 仅 `#storyText` 为 `resize:none`，长文本仅输入框内部滚动，固定标题/角色/footer 不被挤走。
- [x] 普通态四角至少 24×24，对角光标正确；960×760、760×640、16px 边距与小视口 viewport-32 正确。
- [x] 标题栏非交互空白区双击全屏/还原，交互控件被排除。
- [x] 全屏精确铺满内容视口，角控件隐藏、不可聚焦、指针/键盘无效；resize 后仍铺满。
- [x] Esc 首次还原、第二次关闭，且剧本/计划/选择/滚动位置不丢失。
- [x] 四角有双语 aria 和焦点环，方向键按角缩放，Home 恢复默认。
- [x] 自动回归覆盖四角锚定、夹取、所有结束路径、错 pointer、全屏禁缩放、双击排除、Esc 两阶段和零副作用。
- [x] storyboard/layout/robustness/i18n、impact 选中的 app/foundation 及高风险 `test:full` 通过。
- [x] Electron 1316×768 逻辑内容窗口已完成四张截图；1440×900 外部浏览器被 `file://` 安全策略拒绝，未绕过，由 1600×900 自动视口回归补足几何覆盖。
- [x] 本轮不执行 `app:deliver`，不更新 4175，交 00 集成。

## 测试计划

- 影响映射模块：storyboard、layout、robustness、i18n、foundation。
- 主应用模块参数：`storyboard`、`layout`、`robustness`。
- 最小命令：三个 `test:module`、`npm run test:i18n`。
- 升级到全量的条件：本任务属 UI 高风险，收尾固定运行 `test:full`。
- 人工检查尺寸/步骤：Electron 1316×768 及 1440×900 响应式内容视口，长文本分析后验证四角、全屏往返、滚动保留。
- 固定 App 交付：不适用；按委派明确禁止。

## 实施记录

- 假设：角控件复用现有 16px/Shift+64px 键盘步长。
- 关键决定：四角共用 corner 几何会话并固定对边；全屏同时禁用、移出 Tab 序和隐藏角控件。
- 实际修改：增加 NW/NE/SW/SE 四角、角向键盘语义、标题栏双击排除、全屏禁缩放和 `#storyText` 内部滚动；同步双语 aria、回归和截图证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm ci` | 通过 | 8s | 504 packages，lockfile 未改 |
| `npm run app:status` | 通过 | <1s | installed `7ff9aa5`，current `a05b21d`，contains yes |
| `npm run task:status` | 通过 | <1s | claim 前无 active task |
| `task:check` / `task:claim` | 通过 | <1s | 仅 completed README 与 04.3 软冲突；04.3 先集成 |
| 三个 `test:module` + `test:i18n` | 通过 | 约 45s | storyboard 172、layout 121、robustness 23、i18n 21 |
| `npm run test:impact -- --base a05b21d...` | 通过 | 约 45s | app 768、foundation 87、coordination 26、i18n 21、project-input、Web 全通过 |
| `npm run test:full` | 通过 | 约 60s | app 768、Web 10+13、desktop 43、install 36+13、foundation 87、coordination 26、i18n 21 |
| Electron 人工验证 | 通过 | 约 3m | 四角、长文本、全屏、Esc 还原四张截图 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：本轮不交付，不启动固定 App 验收。

## 未覆盖与后续

- 四条边缩放和标题栏拖动明确不在范围。

## 交接

- 最终提交：本任务单一清洁提交（精确 hash 见交接消息与 Git HEAD）。
- PR：无（仓库无 remote）。
- 工作区状态：待提交。
- 下一步：完成后保留 claim，交 00 按 04.3 先、本任务后的顺序集成。
