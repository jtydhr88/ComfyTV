# 任务：分镜文本删除键误触对象删除

- 状态：completed
- 日期：2026-07-15
- 对话：Bug 修复与回归专用对话
- 分支：fix/storyboard-text-delete-shortcut
- 基线：2440c03fba51bf00396ec6812dd9a58dd4ed5355
- 固定 App 来源：7ff9aa583b4e51fb4d888aa1815792b747d275d7
- 负责人：Codex

## 并行任务声明

- 任务 ID：01.2-storyboard-text-delete
- 模式：write
- 模块：storyboard, robustness
- UI 表面：dialogs
- 数据区域：无
- 预计修改文件：`预见PreVision.html`、`测试/冒烟测试.mjs`、本验收单
- `task:check` 结果：无硬冲突；与 `03.4-professional-camera-gizmo` 仅有文件软冲突。两项分别提交，本任务由 00 在摄影机任务之后基于最新集成 HEAD 安全整合并重跑影响测试。
- `task:claim`：已登记
- `task:release`：待 00 完成顺序集成后释放

## 用户问题

在“剧本 → 分镜”窗口的剧本文本框中删除文字时，会误弹“先在视口或对象列表中选中一个对象”的提示。

## 目标

- 文本输入控件内的 Backspace/Delete 保持原生文字编辑行为，不触发场景对象删除快捷键。
- 焦点不在可编辑控件时，现有对象删除快捷键保持不变。

## 非目标

- 不改变分镜分析、生成、应用或项目保存语义。
- 不调整对象删除规则、提示文案或其他快捷键映射。
- 本轮为快速开发预览，不更新固定 App。

## 证据与现状

- 代码：全局 `keydown` 处理器只排除了 `INPUT` 与 `SELECT`，没有排除 `TEXTAREA`；随后把 Backspace/Delete 路由到 `delActor`。
- Git：短期分支从最新集成基线 `2440c03` 创建，包含固定 App 来源 `7ff9aa5`。
- 测试/运行：待补充修复前失败、修复后通过的回归断言。
- 文档/历史线索：`storyText` 是分镜窗口内的 `textarea`。

## 影响范围

- 模块：storyboard, robustness
- 文件：`预见PreVision.html`、`测试/冒烟测试.mjs`
- 数据格式：无
- 平台：浏览器与 Electron 渲染进程

## 风险

- 数据：不写项目数据；需确认画布焦点下删除对象仍可用。
- UI/交互：若可编辑目标识别过宽，可能误屏蔽全局快捷键；以表单控件和 contenteditable 为边界。
- 安全：无新增权限或 IPC。
- 发布：本轮不正式交付固定 App，由 00 总协调后续集成。

## 验收条件

- [x] `storyText` 聚焦时按 Backspace/Delete 不触发对象删除提示，也不阻止浏览器原生编辑。
- [x] 输入框、选择框与 contenteditable 同样不会触发场景快捷键。
- [x] 焦点在画布/页面时，Backspace/Delete 仍调用现有对象删除入口。
- [x] 修复前失败、修复后通过的回归断言已加入。
- [x] 相关自动测试通过。
- [x] 需要的人工验证完成。
- [x] 用户可见任务已执行 `npm run app:deliver`，并从固定 App 看到本次变化；本轮为快速开发预览，不适用，由 00 集成后统一正式交付。
- [x] 文档和功能登记已按需更新；行为边界未改变登记功能状态，无需修改功能表。

## 测试计划

- 影响映射模块：storyboard, robustness, i18n
- 主应用模块参数：storyboard、robustness
- 最小命令：`npm run test:module -- storyboard`、`npm run test:module -- robustness`、`npm run test:i18n`
- 升级到全量的条件：全局快捷键边界出现跨模块回归、影响测试检出额外范围，或集成到最新基线时与摄影机任务发生文本冲突。
- 人工检查尺寸/步骤：开发版打开“剧本 → 分镜”，在文本框内分别用 Backspace/Delete 删除文字；随后在画布焦点下确认对象删除快捷键仍可用。
- 固定 App 交付：本轮不适用；后续由 00 总协调集成并统一处理 `~/Applications/PreVision.app`

## 实施记录

- 假设：用户截图中的提示由全局 Backspace/Delete 快捷键误触 `delActor` 产生。
- 关键决定：保留 `Escape`、`Cmd+Z`、`Cmd/Ctrl+S` 的既有处理顺序，只在场景快捷键分发前把 `TEXTAREA` 和 `contenteditable` 加入现有可编辑目标守卫，避免扩大本次行为范围。
- 实际修改：全局 `keydown` 对 `INPUT`、`TEXTAREA`、`SELECT` 与 `contenteditable` 直接返回；回归断言同时验证可编辑目标不弹提示、不阻止原生事件，以及页面非编辑区域仍进入原有删除入口。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| 修复前 `node 测试/冒烟测试.mjs --module storyboard` | 143 通过，1 失败 | 8.4s | 新回归断言稳定复现分镜文本删除误触对象删除 |
| `npm run app:status` | 通过 | <1s | 分支包含固定 App 来源 `7ff9aa5`；固定 App 未更新 |
| `npm run test:module -- storyboard` | 145 通过，0 失败 | 与其余最小测试并行约 16.5s | Backspace/Delete、INPUT/SELECT/contenteditable 与页面删除入口均通过 |
| `npm run test:module -- robustness` | 10 通过，0 失败 | 同上 | 全局按键扫描无回归 |
| `npm run test:i18n` | 21 通过，0 失败 | 同上 | 无新增用户文案或直接中文 |
| `npm run test:impact -- --base 2440c03... --module storyboard` | 通过 | 约 27s | app 582；foundation 81 + coordination 20 + i18n 21；web 10 + stress 13 |
| 最终 `npm run test:foundation` | 通过 | 3.5s | foundation 81 + coordination 20 + i18n 21，覆盖验收单归档后的最终树 |
| Electron 开发版人工验证 | 通过 | — | 分镜文本从“测试删除文字”经 Backspace 变为“测试删除文”，再经 Delete 变为“试删除文”，无弹窗 |
| 只读代码评审 | 无 P0–P3 | — | 确认不改变 Escape、Cmd+Z、Cmd/Ctrl+S、页面删除入口、项目数据或 i18n |

固定 App installed source：7ff9aa583b4e51fb4d888aa1815792b747d275d7

固定 App 人工启动结果：本轮快速预览不更新固定 App。

## 未覆盖与后续

- 正式交付由 00 总协调在摄影机任务之后按最新基线集成；本分支不得直接覆盖固定 App。
- `Cmd+Z` 与 `Cmd/Ctrl+S` 的全局处理仍先于可编辑目标守卫，这是既有行为，不在本次删除键 Bug 范围内。

## 交接

- 最终提交：本任务聚焦提交；精确哈希见总协调交接消息
- PR：无（仓库未连接远程）
- 工作区状态：提交后 clean
- 下一步：由 00 在 `03.4-professional-camera-gizmo` 之后安全集成、重跑影响测试并释放 `01.2-storyboard-text-delete` claim。
