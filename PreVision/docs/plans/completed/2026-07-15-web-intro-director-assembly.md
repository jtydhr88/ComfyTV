# 任务：Web 开场动画与导演台组装

- 状态：completed
- 日期：2026-07-15
- 对话：03.3｜开场动画与导演台组装
- 分支：`feat/web-intro-director-assembly`
- 基线：`6da46a0ff3e226a8d30b58bd9918f828a0e1ac34`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 负责人：Codex

## 并行任务声明

- 任务 ID：`03.3-web-intro-director-assembly`
- 模式：write
- 模块：`layout`
- UI 表面：`app-shell`
- 数据区域：无
- 预计修改文件：`web/home/home.js`、`测试/Web运行底座测试.mjs`、`docs/FEATURE_REGISTRY.md`、`qa/feature-registry.yaml`、本验收单与 `docs/qa/web-intro-director-assembly/`
- `task:check` 结果：无硬冲突、无文件重叠；并行 `04.2-windows-web-stress` 只占用 `repository,testing`，集成顺序仍为 04.2 Windows 压力证据先、03.3 组装后
- `task:claim`：已登记
- `task:release`：已释放

## 用户问题

在 Web 上线前，把已集成的首页开场动画与 `/director/` 导演台真正组装：只在 `prevision:intro-complete` 完成后单次同源跳转，并覆盖降级、刷新、返回和直接访问。

## 目标

- 保持 ACTION 后既有声音、动画、溶解与白场时序。
- 仅在完成事件后单次同源导航到 `/director/`，不提前、不重复。
- 正常播放、减少动效、媒体播放失败/降级、刷新、返回均不出现空白死锁。
- 保持直接访问和刷新 `/director/` 的现有行为，适配静态构建与正式路由。

## 非目标

- 不修改导演台业务、桌面 Electron 首页、项目数据或固定 App。
- 不公开部署，不改变开场视觉和音频素材。
- 不扩大到 Windows/Safari 压力验证或其他 UI 重构。

## 证据与现状

- 代码：`web/home/home.js` 完成时发出 `prevision:intro-complete`，但契约明确禁止导航。
- Git：当前分支精确基于指定 `6da46a0`，包含固定 App 来源。
- 测试/运行：Node 24.14.0 依赖安装完成；`app:status` 通过；`task:status` 仅有 `04.2-windows-web-stress` 写 claim。
- 文档/历史线索：03.2 验收单明确把 `/director/` 跳转留给下一任务。

## 影响范围

- 模块：`layout`、Web runtime。
- 文件：见并行声明。
- 数据格式：无。
- 平台：静态 Web；桌面与移动浏览器。

## 风险

- 数据：同源导航继续共享 localStorage，不新增读写。
- UI/交互：过早导航会截断白场；重复事件会重复写 history；返回首页若保留完成态会空白。
- 安全：只允许已登记的同源 `/director/` 目标，不接受事件传入的任意 URL。
- 发布：未部署公网；静态主机仍需复现仓库路由契约。

## 验收条件

- [x] 完成事件后才单次导航到 `/director/`，既有媒体和动画时序不变。
- [x] 正常、减少动效契约不变；播放失败/降级、刷新、返回路径无空白死锁。
- [x] 直接访问与刷新 `/director/` 正常。
- [x] 跳转时序和单次触发有自动测试。
- [x] Web、相关应用、i18n、foundation、impact 测试通过；影响映射不要求 full。
- [x] 桌面和移动真浏览器人工检查与截图证据完成。
- [x] 未运行 `app:deliver`，未更新固定 App，未公开部署。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：Web runtime、foundation；主应用 layout 作为相关回归。
- 主应用模块参数：`layout`。
- 最小命令：`npm run test:web`、`npm run test:module -- layout`、`npm run test:i18n`、`npm run test:foundation`、`npm run test:impact -- --base 6da46a0 --module layout`。
- 升级到全量的条件：导航/历史恢复真浏览器结果异常，或 impact 建议全量。
- 人工检查尺寸/步骤：1440×900 与 390×844，从首页 ACTION 经动画/白场进入导演台；直接 `/director/`、刷新、返回、媒体失败/无声降级；控制台与网络错误。
- 固定 App 交付：不适用；用户明确禁止修改固定 App。

## 实施记录

- 假设：`/director/` 与首页同源且正式静态托管遵循 `docs/WEB_RUNTIME.md`。
- 关键决定：目标固定为代码内同源 `/director/`，不信任事件 detail；完成事件与既有回调同步结束后才排微任务导航；`location.assign` 保留返回首页历史；恢复路径显式解除所有隐藏元素。
- 实际修改：接入单次导航门禁、完成 run id 校验和 BFCache/失败恢复；为 `stalled/waiting` 增加 8 秒无进度 watchdog，并在进度恢复、完成和离页时失效；增加 VM 行为测试；更新 WEB-003 登记和桌面/移动 QA 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run test:web` (Node 24.14.0) | 通过 | <1s | Web runtime 10 项、压力工装 12 项；新增脚本执行级导航、短暂/永久 stall 与旧 watchdog 测试 |
| `npm run test:module -- layout` | 通过 | 约 6s | 108 项 |
| `npm run test:i18n` | 通过 | <1s | 21 项 |
| `npm run test:foundation` | 通过 | 约 1s | 仓库 81、协调 20、i18n 21 |
| `npm run test:impact -- --base 6da46a0... --module layout` | 通过 | 约 2s | 命中 foundation、web-runtime，全部通过 |
| `npm run web:build` | 通过 | <1s | `provided-home`，19 个清单文件 |
| 1440×900 回环真浏览器 | 部分通过 | 人工 | 首页、媒体失败恢复、导演台直达/刷新/返回通过；内嵌浏览器拒绝有声媒体，正常影片结尾未真机覆盖 |
| 390×844 回环真浏览器 | 通过（含既有限制） | 人工 | 首页无横向溢出；导演台启动且无控制台错误，既有桌面布局宽约 739px |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；本任务明确禁止更新固定 App。

## 未覆盖与后续

- 允许有声播放的外部 Chrome/Safari 仍需复核正常影片结尾白场到导演台的完整真机链路；自动测试已覆盖事件后单次导航。
- 浏览器控制面未提供 `prefers-reduced-motion` 覆盖，减少动效由未改动分支和契约断言保护。
- Safari/Windows 与公网部署未验证；390px 导演台横向滚动是既有桌面优先布局，未在本任务扩改。
- 未运行 `test:full`：影响映射只要求 web + foundation，且相关 layout、i18n 已单独通过；本任务不改主应用、数据、Electron 或依赖。

## 交接

- 最终实现提交：`993acb29d26c03a1637fad7a12575d1eebfe4265`
- PR：无（仓库未连接远程）
- 工作区状态：实现提交后 clean；本验收单由后续纯文档提交归档
- 下一步：由 00 按既定顺序集成。
