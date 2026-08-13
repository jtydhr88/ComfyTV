# Modal command ownership evidence

日期：2026-07-16。任务：`01.10-modal-command-ownership`。

## 可重复 DOM probe

`npm run test:project-input` 在隔离的真实 Chromium BrowserWindow 中分别执行 Web 与 Electron 两态，并通过以下门禁：

- fixture 至少包含两个对象；快捷键 dialog 打开后真实派发 Space 与 Delete，`actors`、`actors.indexOf(selected)`、selection identity、project、history、autosave、time/playing 均不变，删除按钮 click 计数与 alert/error 数组保持为零。
- modal 内按钮 Space/Enter 各产生一次真实 click；Tab 从 textarea 移到下一个 select，Shift+Tab 确切回到 textarea。
- 真实键盘输入进入 textarea，Chromium 原生 Undo 恢复原值；真实滚轮令 `scrollTop` 从 0 变为正数。
- 原生 `showModal()` 嵌套、close 后在更新 owner 上方重开、非模态 `show()`、两个可聚焦 ARIA modal 的切换/隐藏/重显均按实时 topmost 所有权工作；ARIA modal 的 `display:none` / `aria-hidden` 祖先会释放 owner，恢复后重新按实时序号取得 owner，原生 top-layer 不被原 DOM 隐藏祖先误伤。
- modal 关闭后 Space 恢复工作区播放；probe 结束再次断言无 renderer error/alert。

## 真 Chrome 人工复核

视口为 2560×1288，使用本工作树回环开发预览和通用示例项目：

- 选中通用语义代理后打开快捷键 dialog；Space 不切换播放，Delete 不删除选择，dialog 保持 top-layer modal。
- Escape 关闭 dialog 并保留选择；无 modal 时 Space 正常开始播放，再按一次恢复停止。
- 剧本→分镜进入应用内全屏后，第一次 Escape 只退出全屏，第二次 Escape 才关闭 dialog，选择保持。

截图：`chrome-shortcuts.png`（真实 PNG，2560×1288），SHA-256 `7480e9d0165c9d9f923c35c32d4e46f194f5a597d0acd0ee647868076c817677`。

## 隔离 Electron 开发态人工复核

Electron 43.1.0 / Chrome 150，内容区 1680×1018；使用一次性隔离 profile 和应用自带通用欢迎项目，结束后 profile 已删除：

- 快捷键 dialog 内真实 Space/Delete 后，3 个通用 fixture 对象、selection identity、project、history、autosave、time/playing 全部不变。
- Escape 关闭后 selection 保持；无 modal Space 恢复播放。
- 分镜全屏 Escape 两阶段与 Chrome 一致。

截图：`electron-shortcuts.png`（真实 PNG，3360×2036），SHA-256 `752568dc3e3efa28285d4a923f508a3c0bd415c29e3920740646a57d31f9e8ed`。

## 边界与隐私

- Electron 菜单 open/save 的 renderer callbacks 由 `测试/桌面壳测试.mjs` 执行级 mock 验证 modal 开/关两态；未点击真实系统文件对话框，不将 mock 结果表述为系统对话框端到端。
- 截图只含应用自带通用示例或隔离 fixture；不含真实项目、绝对路径、凭据或个人信息。
- 本任务未运行 `app:deliver`，未更新固定 App，未使用稳定预览端口 4175。
