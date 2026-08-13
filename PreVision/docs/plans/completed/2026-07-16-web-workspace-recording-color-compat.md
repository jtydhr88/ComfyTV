# 任务：01.4｜Web 工作区录屏兼容修复

- 状态：completed
- 日期：2026-07-16
- 对话：01.4｜Web 工作区录屏兼容修复
- 分支：fix/web-workspace-recording-color-compat
- 基线：42b2952fcafdf31f5d3a2dbcc79a0cc4f596d777
- 固定 App 来源：7ff9aa583b4e51fb4d888aa1815792b747d275d7（当前分支包含，非精确）
- 负责人：Codex 短期临时工

## 并行任务声明

- 任务 ID：01.4-web-workspace-recording-color-compat
- 模式：write
- 模块：capture
- UI 表面：topbar、capture-controls
- 数据区域：qa-metadata
- 预计修改文件：`预见PreVision.html`、`测试/冒烟测试.mjs`、本验收单及 `docs/qa/web-workspace-recording-color-compat/` 下去敏证据
- `task:check` 结果：无硬冲突；检查时无其他活动 claim。与后续 01.5 若仅重叠主 HTML/测试文件，按软冲突且集成顺序固定 01.4 先、01.5 后
- `task:claim`：已登记
- `task:release`：未释放（交接后由 00 处理）

## 用户问题

真 Chrome 默认石墨主题点击顶栏录屏下拉“录制预见工作区”立即失败；html2canvas 1.4.1 解析 Chromium 从页面 `color-mix(...)` 得到的 `color(...)` 计算样式时抛错。同会话摄影机录屏正常，既有 capture 自动测试未捕获此回归。

## 目标

- 只在工作区捕获边界归一化 html2canvas 不支持的颜色计算样式，保留四主题运行时视觉 token。
- Web 真 Chrome 至少验证石墨与另一主题可开始、持续 3–5 秒、停止并生成现有编码优先级选择的非空可播放媒体；该时长仅为测试夹具，不是产品限制。
- 补执行级/真浏览器回归测试，覆盖真实 html2canvas 路径与状态清理。
- Electron 开发版复核共享路径，记录真实保存与取消限制。

## 非目标

- 不重排截图/录屏/导出菜单。
- 不改变摄影机录屏、截图、编码、保存位置或媒体导出语义。
- 不修改全局 layout 或降级四主题视觉 token；若必须扩大到该范围，停止并报告 00。
- 不运行 `app:deliver`，不改固定 App，不占用或停止 4175 稳定预览。

## 证据与现状

- 代码：工作区录屏使用 html2canvas 1.4.1；页面主题包含 `color-mix(...)`。
- Git：HEAD 精确等于指定基线 `42b2952fcafdf31f5d3a2dbcc79a0cc4f596d777` 后创建任务分支。
- 测试/运行：已知 capture 44/44 仍绿，真 Chrome 可复现立即失败。
- 文档/历史线索：固定 00 派发内容及 CAP-002 的 `IMPLEMENTED_UNVERIFIED` 状态。

## 影响范围

- 模块：capture
- 文件：主应用工作区捕获边界、capture 冒烟测试、任务与 QA 证据
- 数据格式：无
- 平台：Web Chrome；Electron 共享 renderer 路径复核

## 风险

- 数据：无项目数据迁移；Blob 只按现有保存语义输出。
- UI/交互：若清理不完整可能残留 recording/REC/timer/RAF/stream 状态。
- 安全：不得绕过一次性保存目标授权，不保存临时录屏到仓库。
- 发布：临时工不交付固定 App；由 00 集成并决定后续交付。

## 验收条件

- [x] 仅工作区捕获路径兼容 `color(...)`/`color-mix(...)`，不改变全局主题 token 与其他捕获/导出语义。
- [x] Web 真 Chrome 石墨和雾白主题均进入录制态并生成现有优先级选择的 MP4/H.264；扩展/容器一致、非空、可解码、尺寸/时长合理，抽样帧非全黑/全透明。3–5 秒只作为交互夹具，不是产品限制。
- [x] 停止后媒体轨、RAF、timer 清理；控制台无 unhandled rejection、MediaRecorder error、WebGL context lost 或颜色解析异常。
- [x] 错误、取消、重复开始/停止、缺失 API 不残留 recording/REC/timer/RAF/stream；摄影机录屏保持正常。
- [x] Electron 开发版真实保存路径启动/停止并得到非空可解码文件；取消保存不开始。
- [x] 补充 clone 颜色转换与实际初始化失败 stream/timer/UI 清理执行级测试，并完成真 Chrome 实际 html2canvas/MediaRecorder 验证。
- [x] capture、i18n、impact、web、full 测试通过。
- [x] 未执行 `app:deliver`；固定 App 交付由 00 集成后负责。
- [x] 验收单完成并归档，去敏证据无媒体、绝对路径或敏感信息。

## 测试计划

- 影响映射模块：main-app、app-test、foundation；视工装文件决定 web-runtime/web-stress
- 主应用模块参数：capture
- 最小命令：`npm run test:module -- capture`、`npm run test:i18n`、`npm run test:impact -- --base 42b2952fcafdf31f5d3a2dbcc79a0cc4f596d777 --module capture`、`npm run test:web`、`npm run test:full`
- 升级到全量的条件：录屏/导出边界按规则必须全量；本任务固定执行
- 人工检查尺寸/步骤：真 Chrome 默认桌面视口，石墨和另一主题分别录制 3–5 秒并检查容器/解码/画面/清理；Electron 开发版复核保存/取消或明确 `not_run` 原因
- 固定 App 交付：不适用（短期临时工禁止）；目标路径由 00 最终交付时固定为 `~/Applications/PreVision.app`

## 实施记录

- 假设：兼容修复可约束在 capture 专用 clone/onclone/样式归一化边界。
- 关键决定：在 html2canvas `onclone` 中只转换克隆文档计算样式里的 `color(...)`，通过 1×1 canvas 像素结果得到等价 `rgb/rgba`；保持原页面四主题 token 和既有编码优先级不变。工作区 stream 提升为 capture 私有运行态并统一清理。
- 实际修改：新增工作区 clone 颜色归一化；构造/运行失败及停止路径统一清除 interval、hard cap、stream、snapshot、REC/UI；冒烟测试新增现代颜色、onclone 接入和构造失败资源回收断言。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24.14.0 `npm run app:status` | 通过 | <1s | installed source `7ff9aa5`，当前基线包含该来源 |
| Node 24.14.0 `npm run task:status` | 通过 | <1s | 开工前无活动 claim |
| `npm run test:module -- capture` | 通过 | <1s | 47/47 |
| `npm run test:i18n` | 通过 | <1s | 21/21 |
| `npm run test:impact -- --base 42b2952... --module capture` | 通过 | 约 75s | app 771、foundation 93、coordination 31、i18n 21、project probe、Web 10+13 全通过 |
| `npm run test:web` | 通过 | 约 2s | Web 10/10，压力工装 13/13 |
| `npm run test:full` | 通过 | 约 75s | app 771、desktop 43、local install 36+13、foundation 93、coordination 31、i18n 21 等全通过 |
| 真 Chrome 150：石墨/雾白工作区录屏 | 通过 | 每轮有界 | MP4/H.264；806052/322249 bytes；2560×1288；可解码且抽样帧非黑；控制台 0 warning/error |
| 真 Chrome 摄影机录屏回归 | 通过 | 有界 | MP4/H.264，528519 bytes；停止后 UI 恢复，控制台无错误 |
| Electron 开发版真实保存/取消 | 通过 | 有界 | 原生保存后 MP4/H.264 513435 bytes、1680×1018、可解码非黑；取消不启动 |
| packaged Electron / `app:deliver` | not_run | — | 委派只要求开发版且明确禁止交付固定 App；未用浏览器结果替代 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；本任务禁止修改或交付固定 App。

## 未覆盖与后续

- 自动化浏览器控制的交互时长会受 html2canvas 初始化和辅助功能树读取影响，因此以实际容器 duration 与可解码结果为准；这不构成产品时长限制。
- 真机媒体仅用于本地检查，未写入仓库。固定 App 仍未包含本提交，需 00 集成后决定交付。

## 交接

- 最终提交：见本任务 Git 交接提交（本文件与实现同一聚焦提交）
- PR：无（仓库无 remote）
- 工作区状态：提交前预期仅含验收范围文件
- 下一步：交固定 00 按 01.4 先、01.5 后集成；保持 claim，不自行 release。
