# 任务：截图与录屏保存位置修复

- 状态：completed
- 日期：2026-07-15
- 对话：01｜Bug 修复与回归
- 分支：`feat/editor-first-impression-polish`
- 基线：`de0c6acfff21ecae683b9ffa33d79780cedad351`
- 固定 App 来源：任务开始时为 `de0c6acfff21ecae683b9ffa33d79780cedad351`；最终随 0.7.2 从 `7ff9aa583b4e51fb4d888aa1815792b747d275d7` 统一交付
- 负责人：Codex

## 并行任务声明

- 任务 ID：`01.legacy-capture-save-location`
- 模式：write
- 模块：`capture`、`desktop`、`i18n`、`testing`
- UI 表面：`topbar`、`capture-controls`、`dialogs`
- 数据区域：`electron-ipc`、`i18n-resources`、`qa-metadata`
- 预计修改文件：主应用 Capture 区、Electron 主进程/预加载桥、双语言资源、Capture/Desktop 回归、架构/功能/QA 登记及本验收单
- `task:check` 结果：无硬冲突；这是新流程启用前唯一允许继续的在途例外
- `task:claim`：已登记
- `task:release`：已由 00 在 `83b17ea` 安全集成后释放

## 用户问题

顶部两种截图和两种录屏会直接保存到固定导出目录，用户无法在操作前选择保存位置。顶部保存结果又以省略号截断，无法确认完整目录、文件名和后缀。

## 目标

- Electron 中的摄影机画面截图、工作区截图、摄影机画面录屏和工作区录屏都先打开系统保存对话框。
- 取消截图时不写文件；取消录屏时不进入录制状态。
- 保存位置授权仅绑定发起 renderer、捕获类型和系统批准路径，且一次消费、自动过期。
- 录屏对话框的文件后缀与实际预选容器一致，不把 WebM 内容写成 MP4 后缀。
- 顶部完整显示成功保存的实际路径与后缀，右侧固定在截图入口之前，长路径向左利用空间。
- 浏览器模式和普通导出继续保持原有下载/固定导出语义。

## 非目标

- 不改变项目打开/保存、镜头视频批量导出、Seedance 素材包或普通导出目录。
- 不修改项目 v5、摄影机、人物、场景、缩略图或其他编辑语义。
- 不从遗留旧分支运行 `app:deliver`；固定 App 只由 00 总协调在最新集成基线上交付。
- 不删除、重置、覆盖或提交当前工作树中其他受保护的未提交成果。

## 证据与现状

- 代码：旧 `workspace:capture`、顶部截图和录屏完成回调直接写固定导出目录；`#saveState` 使用 `max-width` 与 `text-overflow:ellipsis`。
- Git：遗留分支基于固定 App 精确来源 `de0c6ac`；工作树还混有其他受保护修改，本结果必须制作 capture-only commit。
- 测试/运行：开始收口时 Capture 28/28、Desktop 39/39、i18n 21/21 通过，但异步停止、错误恢复和容器回退边界尚未覆盖。
- 文档/历史线索：用户录屏 `录屏2026-07-15 06.54.36.mov` 在 00:07–01:06 指出四入口缺少保存位置，01:06–01:29 指出路径被截断。

## 影响范围

- 模块：`capture`、`desktop`、`i18n`、`testing`
- 文件：见并行任务声明；最终提交只包含 Capture 相关 hunk
- 数据格式：无
- 平台：macOS Electron；浏览器回退保持兼容

## 风险

- 数据：系统批准路径的写入失败不得误报成功；取消不得产生空文件。
- UI/交互：快速双击不能并发打开多个保存对话框；长路径不得挤走右侧截图入口。
- 安全：renderer 不能获得任意路径写权限；token 必须绑定 sender、一次消费并过期。
- 媒体：MediaRecorder 构造、启动或运行失败时必须恢复速度、播放和录制 UI；工作区异步初始化期间停止后不能在后台继续启动。
- 发布：当前旧分支不能覆盖固定 App；仅把聚焦提交交给 00 cherry-pick。

## 验收条件

- [x] 顶部两种截图都先弹出系统保存位置；取消后不写文件。
- [x] 顶部两种录屏都在开始前弹出系统保存位置；取消后不进入录制状态。
- [x] 授权绑定 sender 与类型、一次消费并过期；错误类型和跨 renderer 请求不消费合法授权。
- [x] 录制容器、过滤器和最终后缀一致；保存或录制失败返回失败并完整清理状态。
- [x] 保存成功后顶部完整显示实际路径和后缀，右侧锚点稳定。
- [x] Capture、Desktop、i18n、App、Foundation 与 Full 回归通过。
- [x] Electron 开发版完成人工保存/取消和完整路径检查。
- [x] 固定 App 未从本分支交付，已明确移交 00 总协调。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：`capture`、Electron、国际化、文档/QA
- 主应用模块参数：`capture`
- 最小命令：`npm run test:module -- capture`、`npm run test:desktop`、`npm run test:i18n`
- 升级到全量的条件：录屏/导出与 Electron IPC 按策略强制运行 `npm run test:app`、`npm run test:foundation`、`npm run test:full`
- 人工检查尺寸/步骤：Electron 开发窗口依次检查四入口保存对话框与取消；成功保存临时 PNG，确认顶部显示完整路径与后缀并删除测试临时文件
- 固定 App 交付：由 00 总协调在最新集成基线上执行；本遗留分支不适用

## 实施记录

- 假设：顶部 Capture 是用户明确指出的四个入口；普通导出继续直接写统一导出目录。
- 关键决定：主进程保存对话框返回不可伪造的随机 token，主进程保存批准路径；renderer 只拿 token 和显示路径，不能提交任意路径。
- 实际修改：Electron 主进程新增保存对话框与 sender 绑定的一次性捕获授权；preload 只暴露选择目标、token 写入和 token 化工作区截图。顶部四入口在写入/录制前取得目标，取消直接返回；保存路径完整右锚定显示。录屏按预选容器固定后缀，重复对话框、异步初始化中止、六小时上限、MediaRecorder 构造/启动/运行错误、Blob 读取和写入失败均有清理与失败结果。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status`（主仓库） | 通过 | <1s | installed `de0c6ac`；遗留分支基线精确包含该来源 |
| `npm run task:status` / `task:check` / `task:claim` | 通过 | <1s | 唯一活动写任务，无硬冲突；已补齐实际范围 |
| `npm run test:module -- capture` | 通过 | <1s | 37 通过，0 失败；覆盖四入口、取消、并发锁、异步停止、容器和录制错误恢复 |
| `npm run test:desktop` | 通过 | <1s | 43 通过，0 失败；覆盖系统目标、sender/类型绑定、一次消费、TTL、后缀和 preload 白名单 |
| `npm run test:i18n` | 通过 | <1s | 21 通过，0 失败；双语言 key 对齐且无新增运行时内联中文 |
| `npm run test:app` | 通过 | 约 13s | 477 通过，0 失败 |
| `npm run test:foundation` | 通过 | 约 1s | 仓库基础 58 通过；内含 i18n 21 通过，全部 0 失败 |
| `npm run test:full` | 通过 | 16.6s | App 477、Desktop 43、本机安装 36、交付门禁 13、Foundation 58、i18n 21，全部 0 失败 |
| 暂存快照：`npm run test:module -- capture` / `test:desktop` / `test:i18n` | 通过 | <1s | 基于 `de0c6ac` 的独立 detached worktree 仅应用暂存补丁；Capture 31、Desktop 43、i18n 21，全部 0 失败。Capture 数量不含其他受保护任务的 6 条断言 |
| 暂存快照：Node 24 `npm run test:full` | 通过 | 14.6s | 独立快照 App 449、Desktop 43、本机安装 36、交付门禁 13、Foundation 58、i18n 21，全部 0 失败；证明 capture-only 提交不依赖工作树中的其他未提交成果 |
| Electron 开发版四入口 | 通过 | 人工 | 两种截图与两种录屏均出现对应保存对话框；取消后无文件/无录制状态 |
| 摄影机截图真实保存 | 通过 | 人工 | 省略后缀保存为 1920×1080 PNG；顶部显示系统临时目录下 `PreVision_capture_save_location_qa.png` 的完整路径，右锚点稳定；测试文件已删除 |
| 开发实例清理 | 通过 | 人工 | 隔离 Electron 开发进程和临时 profile 已关闭/删除 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（0.7.2）

固定 App 人工启动结果：0.7.2 已从 `~/Applications/PreVision.app` 普通启动；顶部截图/录屏入口、工作区/摄影机范围文案和“开始前选择保存位置”提示可见。系统保存对话框、取消语义与真实 PNG 保存沿用本任务开发版人工证据及桌面 IPC 自动回归；长录制仍不据此宣称完成实机稳定性验证。

## 未覆盖与后续

- 最终固定 App 的系统对话框、长录制与实际播放器兼容性由 00 在集成提交上复核；自动测试不替代真实长录制。
- 独立快照首次直接运行全量时，系统 Node 26 且临时 worktree 无 `node_modules`，在 App 449/449、Desktop 43/43 通过后因缺少 `@electron/asar` 停止；挂载仓库既有依赖并按项目允许范围改用 Node 24 后，全量门禁通过。该次停止属于验证环境，不是代码或断言失败。

## 交接

- 最终提交：任务提交 `e5e263894136a3801647b03001428582d9e754c6`；00 集成提交 `83b17eaef30e7b7c9fd139721e74caf580fdddf0`
- PR：无（仓库无 remote）
- 工作区状态：Capture 结果已完成；除本任务外仍保留受保护的历史未提交修改
- 下一步：继续观察真实长录制、编码器和播放器兼容性。未提交的遗留编辑实验仍留在原工作树，不属于本任务。
