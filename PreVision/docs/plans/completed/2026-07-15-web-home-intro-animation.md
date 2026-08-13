# 任务：Web 首页开场动画

- 状态：completed
- 日期：2026-07-15
- 对话：03.2｜Web 首页开场动画
- 分支：`feat/web-home-intro-animation`
- 基线：`dcde6f0602c902f8f831ab4e340095d75ae6811e`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 负责人：Codex

## 并行任务声明

- 任务 ID：`03.2-web-home-intro-animation`
- 模式：write
- 模块：`i18n,layout`
- UI 表面：`app-shell`
- 数据区域：`i18n-resources,qa-metadata`
- 预计修改文件：`web/home/`、`i18n/locales/zh-CN.js`、`i18n/locales/en-US.js`、`qa/test-impact-map.yaml`、测试、验收单与 Web 首页 QA 证据
- `task:check` 结果：与 `04.2-windows-web-stress` 仅 `qa/test-impact-map.yaml` 文件软冲突；本任务最终未修改该文件，集成顺序仍为 04.2 证据先、03.2 页面后
- `task:claim`：已登记
- `task:release`：已释放（归档复核时共享登记已无本任务 claim）

## 用户问题

将桌面“PreVision开场设计文件”中的视频、排版参考与 SVG 素材实现为可真实预览的 Web 首页开场动画。

## 目标

- 在 `web/home/` 实现与排版参考一致的清晰首帧与响应式降级。
- ACTION 启动本地视频，并以错落、颗粒/碎散的魔法溶解退出非画面元素。
- 提供确定性测试接口、减少动效降级、键盘/ARIA、媒体失败恢复和重入/后台保护。
- 动画结束停在白场并发出可供下一任务接入 `/director/` 的完成事件/回调。

## 非目标

- 不在本任务跳转 `/director/`，不部署公网。
- 不修改导演台业务、项目数据、Electron 入口或固定 App。
- 不合并旧概念分支，不覆盖桌面母版素材。

## 证据与现状

- 代码：静态 Web 底座已约定 `web/home/` 映射 `/`，`/director/` 保持导演台。
- Git：当前 HEAD 精确为用户指定基线 `dcde6f0`，且包含固定 App 来源。
- 测试/运行：`app:status` 通过；`task:status` 显示仅 04.2 并行写任务。
- 文档/历史线索：已只读旧概念验收单和 `docs/qa/web-landing-style-concepts/README.md`。

## 影响范围

- 模块：`i18n`、`layout`。
- 文件：见并行声明。
- 数据格式：无。
- 平台：静态 Web，桌面/MacBook/4K 与基本移动降级。

## 风险

- 数据：无项目数据读写。
- UI/交互：高 DPR 颗粒效果可能过重；视频首帧与封面需对齐。
- 安全：只使用本地静态素材；外链仅小红书且使用 `noopener noreferrer`。
- 发布：视频原始码率较高，需优化且记录清晰度/体积取舍；本轮不公开部署。

## 验收条件

- [x] 首帧与参考排版一致，只有小红书和 ACTION 可交互。
- [x] ACTION 触发视频与非整组淡出的确定性魔法溶解，完成后白场并发出接入点事件。
- [x] 键盘/ARIA、减少动效、视频失败恢复、重复点击/刷新/后台保护已实现并有契约断言。
- [x] 1316×768、1440×900、3840×2160 与 390×844 人工检查完成；当前真浏览器 DPR 为 1，DPR 2 的 Canvas 上限和高分辨率资产契约已校验，Retina 真机留作兼容风险。
- [x] `web:build` 后 `/` 为首页，`/director/` 仍为导演台，本地生产预览无资源/控制台错误。
- [x] `test:i18n`、`test:web`、`test:foundation`、影响/应用测试及 Node 24 `test:full` 通过。
- [x] 验收单、QA 证据、性能/兼容风险和下一任务接入点记录完整。
- [x] 本轮快速预览未运行 `app:deliver`，未更新固定 App。

## 测试计划

- 影响映射模块：Web runtime、i18n-browser、foundation；页面行为新增专项断言。
- 主应用模块参数：`layout`。
- 最小命令：`npm run test:i18n`、`npm run test:web`、`npm run test:foundation`、`npm run test:impact -- --base dcde6f0 --module layout`。
- 升级到全量的条件：交接前固定使用 Node 20–24 运行 `npm run test:full`。
- 人工检查尺寸/步骤：1316×768、1440×900、3840×2160/DPR 2、390×844；检查首帧、ACTION、视频首帧、溶解、白场、失败恢复、后台切换、控制台与资源缓存。
- 固定 App 交付：不适用；本轮是快速 Web 生产预览。

## 实施记录

- 假设：桌面素材由用户提供并授权本任务在本项目内使用；不将其上传到外部服务。
- 关键决定：使用视频第 0 帧 poster 保护启动连续性；保留原片 AAC 双声道音轨并增加本地合成点击声；用平滑 CSS 与固定种子 Canvas 三级颗粒实现有界魔法溶解；完成仅发事件不导航。
- 实际修改：新增首页 HTML/CSS/JS、发布优化媒体与 SVG；增加双语 key、Web 契约测试、功能登记和多尺寸 QA 证据。用户复核后按 SVG 可见边界下移 ACTION；将溶解细化为“大块松散 → 中块承接 → 微粒消散”；品牌恢复为单张原始 `3.svg`，避免裁切叠层造成双影和形变；顶部 `1.svg` 只整体右移到与 PREVISION 的 P 可见左边对齐，未修改素材字号、比例和红线长度；功能区整张 SVG 内部排列未拆分。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run test:i18n` (Node 24.14.0) | 通过 | <1s | 21 项 |
| `npm run test:web` (Node 24.14.0) | 通过 | 约 1s | Web runtime 10 项，压测工装 12 项 |
| `npm run web:build` | 通过 | <1s | `provided-home`，19 个清单文件 |
| `npm run test:foundation` | 通过 | 约 1s | 仓库 81、协调 20、i18n 21 |
| `npm run test:impact -- --base dcde6f0 --module layout` | 通过 | 16.79s | 因中间 PDF/素材预览文件尚在 `tmp/` 时检测到未识别路径，安全升级并通过全量；中间文件随后删除 |
| `npm run test:full` (Node 24.14.0) | 通过 | 约 17s | app 562、web 10+12、desktop 43、local install 36+13、foundation 81+20+21 |
| 回环生产预览 | 通过 | 人工 | 390×844、1316×768、1440×900、3840×2160；动画中帧、白场、URL 不跳转、控制台无警告/错误 |
| 用户复核调整：`test:i18n`、`test:web`、`test:foundation`、`test:impact -- --base HEAD --module layout` | 通过 | 约 3s | ACTION 可见底边对齐；溶解分为 680ms 大块与 1.7s 细像素两阶段；新截图已替换 |
| 本轮音频/三级碎化/品牌复原：上述四项与 `web:build` (Node 24.14.0) | 通过 | 约 3s | 4K H.264 + AAC-LC 双声道；品牌为单张原 SVG；1440×900 可见左边实测约 953 px |
| 外部浏览器 ACTION 启动修复 | 资源与契约通过，待用户外部浏览器确认有声输出 | 约 3s | 重启生产预览清单；视频 URL 版本化；点击声离线混入音轨；内嵌自动化浏览器的有声媒体策略不作为外部浏览器音频结论 |
| poster/视频亮度连续性 | 相关测试通过，待用户视觉确认 | 约 2s | 亮度统计约 97.8 / 100.0；桌面播放态补偿至 `.975` 并以 180 ms 过渡 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；快速预览不更新固定 App。

## 未覆盖与后续

- 下一任务把完成事件接入 `/director/` 路由。

## 交接

- 最终提交：`6da46a0ff3e226a8d30b58bd9918f828a0e1ac34`
- PR：无（仓库未连接远程）
- 工作区状态：实现交接时 clean；归档由 03.3 纯文档收尾提交完成
- 下一步：00 按“04.2 证据先、03.2 页面后”集成；后续任务监听 `prevision:intro-complete` 并接入 `/director/`
