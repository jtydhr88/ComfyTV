# 右栏快捷入口滚动稳定定位

日期：2026-07-16。证据来自隔离 Electron userData 的真实 Chromium `BrowserWindow`，未读取用户项目或固定 App。

- 视口：1316×768、1440×900、1600×900。
- 每个视口：四个快捷入口 × rail/peek/expanded/director-focus 共 16 组合，合计 48 组合。每项先等待产品的 `inspectorScrollIsSettled()`：right 宽高、`#rightScroll` rect、target summary rect 和 `scrollTop` 连续 rAF 稳定后才执行一次最终补滚。随后在初稳与两秒后重新读取 summary/`#rightScroll` rect 和 `scrollTop`，要求 summary 完整可见、未抵达 scroll 最大值、两次 `scrollTop` 相同；两秒只用于检验不漂移，不是完成条件。
- Chromium CDP wheel 额外验证等待期手动滚动所有权；每个模式记录 `#rightScroll` 命中及 wheel 前、wheel 后、取消旧异步定位后的 `scrollTop`，例如 1316×768 为 1737.5→1857.5→1857.5。连续摄影机→太阳与光影以最后一次意图为准；面板状态变更取消待执行定位。
- 截图：`inspector-1316x768.png`、`inspector-1440x900.png`、`inspector-1600x900.png`。每张均在太阳与光影完成稳定定位后、所有 ownership/panel-collapse 情景之前采集；人工核看显示展开右栏与可见的“太阳与光影” summary。截图不含用户项目、路径、凭据或个人数据。

2026-07-26 真实 owner QA：`/tmp/prevision-04.16-inspector-qa-final.CthkXU`（项目外临时目录，独立 R2 前保留）包含 12 张桌面 BrowserWindow 截图及原子 `inspector-qa-metadata.json`。每组均记录 owner、窗口标题、local `file://` URL、content/inner size、DPR、原始 PNG 尺寸、SHA-256、步骤和 PASS 结果；metadata 的 12 个哈希已由独立读取重算并逐项匹配。真实矩阵以 1316×768、1440×900、1600×900 的 rail/peek/expanded/director-focus 跑完；48 个目标均 visible、non-bottom 且 2 秒 `scrollTop` 不漂移，wheel、panel-state 和最后意图断言通过。390×844 记为 N/A：它是非阻断响应式观察，未修改布局或把移动检查并入桌面硬合同。

自动探针输出：`inspector quick entries: 3 viewports × 4 modes × 4 entries; 48 stable rect/scroll samples + last intent and user/panel scroll ownership`。
