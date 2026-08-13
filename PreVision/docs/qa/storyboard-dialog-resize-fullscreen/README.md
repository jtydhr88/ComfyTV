# 分镜规划器全屏与四角缩放人工证据

- 日期：2026-07-16
- 分支：`fix/storyboard-dialog-resize-fullscreen`
- 基线：`a05b21dfa5c20263044b416dc3a27f5c3556c964`
- 运行方式：Node 24.18.0 `npm start`，当前 Worktree Electron 开发窗口
- 目标窗口：1316×768 逻辑内容区；系统截图经屏幕缩放后为 1229×768 物理像素

## 结果

| 证据 | 结果 |
| --- | --- |
| `electron-1316x768-four-corners.jpeg` | 默认 960×760 普通态四角全部可见，标题、输入、选项和 footer 稳定。 |
| `electron-1316x768-long-text.jpeg` | 13 行英文长文本生成 15 节拍 / 8 镜；输入框内部滚动，角色映射、列表和 footer 仍可用。 |
| `electron-1316x768-fullscreen.jpeg` | 应用内全屏精确铺满 PreVision 内容视口；四角不可见且从可访问树消失，显式按钮变为“还原窗口”。 |
| `electron-1316x768-restored.jpeg` | Esc 首次还原自定义几何，长文本、15 节拍 / 8 镜与滚动位置保留。 |

Computer Use 的可访问树在普通态同时检出 NW/NE/SW/SE 四个双语角控件；全屏态检出 0 个角控件。自动回归另覆盖 1600×900、900×650、760×560 视口、四角对边锚定、pointerup/cancel/lostcapture/blur/错 pointer 与双击控件排除。

## 1440×900 说明

尝试在外部浏览器设置 1440×900 后打开当前 `file://` 页面，被浏览器安全策略拒绝。本任务没有绕过安全策略，也没有启动或更新 4175。1440×900 人工截图因此未生成；几何与长文本行为由上述 Electron 实机证据和 1600×900 自动视口回归共同覆盖。
