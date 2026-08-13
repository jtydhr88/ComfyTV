# 时间轴播放头命中优先级真浏览器证据

日期：2026-07-16

## 环境与边界

- 测试基线：`62e20fe29066c4fa83d6354e5baacd8b099d2e2e`
- 被测实现：`438eff3ef745010242fe15ad6c92d9f38a23a0c8`（真 Chrome 证据对应的实现提交，不把未含修复的基线冒充来源）
- 浏览器：本机 Google Chrome，通过 Codex Chrome 控制接口执行，不是 VM DOM 桩。
- 页面：任务 Worktree 的静态 Web 构建，以一次性回环端口提供；未占用稳定预览 4175。
- Node：`v24.14.0`，所有构建、状态与测试命令显式使用项目允许的 Node 24 runtime PATH。
- 数据：仅在一次性回环 origin 中创建普通语义代理和预览关键帧夹具；证据不包含项目内容、媒体、绝对路径或用户身份信息。
- 固定 App：未运行 `app:deliver`，未更新 `~/Applications/PreVision.app`。

## 真实布局与拖动步骤

两个目标尺寸均执行同一组检查：

1. 用 UI 新增一个语义代理，调整“选中对象缩放”并点击“打关键帧”，生成 preview group 与 preview child key。
2. 把播放头通过标尺定位到被测元素同一 x 坐标。
3. 在元素几何中心调用浏览器原生 `document.elementFromPoint`，断言命中角色分别为 `preview-group`、`preview-key`、`key`、`clip`，而不是 `motionPlayhead`。
4. 通过 Chrome 的真实鼠标 pointer drag 移动每类元素，读取其实际 DOM `left` 变化；preview group/child 与 legacy key 同时带动播放头到新时间。
5. 在无关键帧/夹点的 lane 坐标把播放头定位到同一 x，确认 `elementFromPoint` 命中 `motionPlayhead`，再真实拖动并观察时间码变化。
6. 在 ruler 空白处真实拖动并观察播放头与时间码变化。
7. 检查 Chrome 控制台 error 日志为 0。

同一执行级契约另已接入 `npm run test:project-input`：隔离 Electron userData 与临时 session partition，使用真实 Chromium computed style、`document.elementFromPoint` 和 CDP 原生鼠标 pointer drag 覆盖四类目标与空白 lane/ruler。该入口由 `test:impact` 和 `test:full` 自动运行，因此父级 stacking context 回归会使 CI 失败。

## 结果摘要

| 尺寸 | preview group | preview child | legacy key | clip grip | 空白 lane | 空白 ruler | console error |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1316×768 | 命中自身，x 426→486 | 命中自身，x 486→526 | 命中自身，x 434→482 | 命中自身，x 532→484 | 播放头时间码 8.6s→9.7s | 播放头时间码 →8.0s | 0 |
| 1440×900 | 命中自身，x 444→489 | 命中自身，x 489→534 | 命中自身，x 452→500 | 命中自身，x 537→489 | 播放头时间码 9.1s→10.2s | 播放头时间码 →7.6s | 0 |

数值为 CSS pixel 的实际几何中心，允许浏览器亚像素取整。结构化结果见 `evidence.json`。

## 截图

- `1316x768.png`：真实 PNG（1316×768 RGB），SHA-256 `2e43914438d27a4f691f319c5415f281155cf144c032bec0ac93e7d4ffaec71c`
- `1440x900.png`：真实 PNG（1440×900 RGB），SHA-256 `24b3bbb14cb6e2f3f6bd145cd80aae8c28d8784e4214a901c29bda9d55ca982f`

截图只用于确认目标尺寸、完整时间轴和应用布局；命中与拖动结论来自上述实时浏览器几何/事件证据，而不是从截图推断。
