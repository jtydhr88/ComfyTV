# 任务：Web 首页移动端文字可读性

- 状态：completed
- 日期：2026-07-16
- 对话：03.8｜Web 首页移动端文字可读性
- 分支：`fix/web-home-mobile-readability`
- 基线：`8aef7d91a2d744c866e3960f14d0eed5a490d801`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 负责人：Codex

## 并行任务声明

- 任务 ID：`03.8-web-home-mobile-readability`
- 模式：write
- 模块：`layout`
- UI 表面：`app-shell`
- 数据区域：无
- 预计修改文件：`web/home/home.css`、`测试/Web运行底座测试.mjs`、本验收单、`docs/plans/completed/README.md`、`docs/qa/web-home-mobile-readability/`
- `task:check` 结果：与 `01.7-motion-curve-pointer-lifecycle` 仅 `docs/plans/completed/README.md` 文件软冲突；固定集成顺序为 01.7 先、本任务后
- `task:claim`：已登记
- `task:release`：未释放，由 00 集成后释放

## 用户问题

390px/360px 首页暗色 SVG 文案压在深色场记板/影片上难以辨认。

## 目标

- 仅在窄屏断点内为深色 SVG 文案所在透明画布提供确定性浅色承托。
- 保留 SVG 路径、颜色、比例、相对位置和动画时序。
- 390×844 与 360×800 文案清楚、无横向溢出且不遮挡 ACTION/社交入口。
- 1316×768 与 1440×900 桌面定稿无意外变化。

## 非目标

- 不修改 SVG、影片、音频、JavaScript 导航或恢复逻辑。
- 不改变开场影片、颗粒溶解、导航时序或导演台业务界面。
- 不运行 `app:deliver`，不更新固定 App，不部署。

## 证据与现状

- 代码：窄屏视频降低亮度并叠加暗色渐变，深棕/黑色 SVG 文案缺少稳定浅色背景。
- Git：当前 HEAD 精确基于指定提交 `8aef7d91a2d744c866e3960f14d0eed5a490d801`。
- 测试/运行：Node 24.14.0；`app:status` 确认包含固定 App 来源；冲突门禁只有完成索引软冲突。
- 文档/历史线索：03.2 保留整张 SVG 排版与素材，03.3 固定完成事件后的单次同源导航和失败恢复。

## 影响范围

- 模块：`layout`
- 文件：Web 首页窄屏 CSS、相关 Web 契约测试、验收与截图证据
- 数据格式：无
- 平台：静态 Web 首页；移动 Chrome 为主，桌面外观回归

## 风险

- 数据：无项目数据读写。
- UI/交互：承托边界过大会遮挡影片或 ACTION；断点泄漏会改变桌面定稿。
- 安全：纯 CSS，无新资源与网络行为。
- 发布：不部署、不更新固定 App。

## 验收条件

- [x] 浅色承托只在窄屏断点生效，且不依赖影片采样、阴影或透明叠色。
- [x] 原 SVG、媒体和 JavaScript 时序相关文件均不修改。
- [x] 390×844 与 360×800 品牌、tagline、功能说明清楚，无横向溢出或 ACTION/社交遮挡。
- [x] 普通文字对承托背景目标 ≥4.5:1，图标/焦点环 ≥3:1。
- [x] 1316×768 与 1440×900 桌面关键几何/像素无意外变化。
- [x] `test:web`、`test:i18n`、`test:foundation`、`test:impact -- --base 8aef7d9 --module layout` 通过。
- [x] reduced-motion、媒体拒绝/失败恢复、ACTION 导航和 `prevision:intro-complete` 时序不变。
- [x] 本任务不运行 `app:deliver`，固定 App 和公网部署均不变。
- [x] 验收单和 QA 证据已归档并更新完成索引。

## 测试计划

- 影响映射模块：Web runtime、foundation
- 主应用模块参数：`layout`
- 最小命令：`npm run test:web`、`npm run test:i18n`、`npm run test:foundation`、`npm run test:impact -- --base 8aef7d9 --module layout`
- 升级到全量的条件：影响测试建议 full、出现未知文件、或导演台/导航行为异常
- 人工检查尺寸/步骤：390×844、360×800、1316×768、1440×900；检查初始首页、焦点、溢出、ACTION/社交入口与桌面截图差异
- 固定 App 交付：不适用；目标仅为静态 Web 快速预览，且明确禁止 `app:deliver`

## 实施记录

- 假设：窄屏断点沿用现有首页响应式边界。
- 关键决定：在既有 `max-aspect-ratio: 4/3` 窄屏断点内直接给四张含文字 SVG 的透明画布设置不透明米色 `#f6e8c8`；不增加 DOM 包装、不改素材。移动端交互焦点改为深棕内轮廓加米色外环，确保不依赖影片帧。
- 实际修改：仅修改 `web/home/home.css` 和对应 Web 契约断言；新增四尺寸 Chrome 截图、几何/对比度及桌面逐像素基线说明。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run test:web` (Node 24.14.0) | 通过 | 约 1s | Web runtime 10 项，压力工装 14 项；新增窄屏承托与焦点环作用域断言 |
| `npm run test:i18n` | 通过 | <1s | 21 项；无新增用户文案 |
| `npm run test:foundation` | 通过 | 约 1s | 仓库 93、协调 31、i18n 21、项目输入 wrapper 11 项 |
| `npm run test:impact -- --base 8aef7d9... --module layout` | 通过 | 约 2s | 命中 foundation、web-runtime；未建议 full |
| `npm run web:build` | 通过 | <1s | provided-home，19 个清单文件 |
| Chrome 390×844 / 360×800 | 通过 | 人工 | CSS viewport 精确；scrollWidth 等于 innerWidth；无入口遮挡；截图见 QA 目录 |
| Chrome 1316×768 / 1440×900 基线像素比较 | 通过 | 人工+像素脚本 | 两尺寸相对基线均 0 个变化像素 |
| WCAG 对比度计算 | 通过 | <1s | 深色文字 13.89–17.30:1，红色图标 3.29:1，焦点轮廓 15.64:1 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；本任务禁止更新固定 App。

## 未覆盖与后续

- 未运行 `test:full`：影响映射仅命中 foundation 与 web-runtime，且 `test:impact` 未建议升级；本任务不改主应用、数据、Electron、依赖或 JavaScript。
- 未真机覆盖 Safari/Windows；本任务以派发要求的本机真 Chrome 四尺寸为验收范围。

## 交接

- 最终提交：本验收单所在聚焦提交（以 `git show HEAD` 为准）
- PR：无（仓库未配置 remote）
- 工作区状态：提交后 clean
- 下一步：由 00 按 01.7 先、本任务后的顺序集成，随后释放 claim
