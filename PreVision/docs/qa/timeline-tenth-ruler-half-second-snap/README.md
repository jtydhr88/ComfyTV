# 02.12 时间轴 0.1s 尺规与半秒吸附证据

- 日期：2026-07-28
- 基线：`c99968d0c547392fa046b5e1a5ac0ca9f5b7d2e5`
- 实现提交：`9ba9934ca93f4ae24eac1a77b51b27179f19f82e`
- 预览：`PreVision 02.12 Preview — NOT INTEGRATED`
- 运行环境：Node v24.18.0；Electron 43.1.0；独立临时 user-data

## 自动门禁

- `npm run test:module -- timeline`：R2 返修后 189 通过，0 失败。
- `npm run test:module -- layout`：160 通过，0 失败。
- `npm run test:i18n`：217 通过，0 失败。
- `npm run build`：通过。
- `git diff --check`：通过。
- 按任务约束未运行 `test:impact`、`test:full`、`app:deliver`。

## 真实 Electron 检查

- 1440×900：`motionSnap` 可见、默认开启、`aria-pressed=true`，tooltip 为“吸附到整秒/半秒，按住 Option 临时关闭”；尺规显示 0.0/0.5/1.0 等层级标签，工具栏无挤压。
- 1316×768：同一按钮、尺规与关键帧轨道保持可见，工具栏无横向挤压。
- 使用真实鼠标拖动摄影机关键帧，依次得到 `2.0s / 已吸附`、`1.5s / 已吸附`、`1.0s / 已吸附`。
- 手动关闭吸附后，真实拖动落在 1.4s，未出现“已吸附”反馈；重新开启后可再次吸附至 1.5s。
- Option/Alt 临时旁路、拖动中竖向 guide、preview group anchor 和 legacy actor/path 由 Node 24 确定性 timeline 回归覆盖。当前 Computer Use 的原子 drag 不能保持 Option 修饰键，也不能停在 pointermove 中截取 guide，因此未把这两项冒充为人工实证。

## 截图说明

- `electron-1316x768.png` 为 1316×768 原始控制链截图。
- 1440×900 外框尺寸在 renderer 中核对为 `outerWidth=1440`、`outerHeight=900`；Computer Use 截图传输将高度上限等比压到 768px，因此 `electron-1440x900.png` 的文件像素为 1229×768。该限制已在 `evidence.json` 明示，未做插值放大。
- 固定 App、稳定预览指针、GitHub、Pages 均未修改。

## R2 round 1 与旧截图边界

- 独立 R2 round 1 为 FAIL：P0=0、P1=1、P2=1。P1 是 foundation 被 Shift 选中但不可移动时未继续充当第二 key 的邻接边界；P2 是 snap→unsnap/Option 旁路只清 guide 与高亮、未同步清除吸附状态。
- 返修后，真实 pointer 回归确认 `[0,1]` 多选拖动仍把第二 key 限制在 0.1s，foundation 保持 0，position/aim/FOV 时间一致且只产生一次事务；另一事件序列确认 snap→unsnap、无关状态保护和 Option 旁路会同步更新 guide、高亮与状态。
- 本轮没有重启或重拍 Electron。两张 PNG 仅继续证明初版尺规、按钮和窗口布局，不作为上述 R2 结构性修复的人工证据；R2 修复证据来自 Node 24 的真实事件/DOM 回归。
