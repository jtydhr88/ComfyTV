# 专业电影摄影机可视化 QA

日期：2026-07-15

分支：`feat/professional-camera-gizmo`
基线：`2440c03fba51bf00396ec6812dd9a58dd4ed5355`

## 人工检查

- `chrome-1440x900-light.jpg`：Chrome 1440×900、雾白日间、中距离。主 viewport 左侧可辨长镜头、盒体、顶提把/天线与镜头方向；右侧 monitor 正常显示人物/道具，不含编辑摄影机。
- `chrome-1440x900-dark.jpg`：Chrome 1440×900、石墨深海、中距离。主 viewport 中的摄影机、其他红色路径点、黄色调度点和场景对象均可辨。
- `chrome-1440x900-monitor-hidden.jpg`：Chrome 1440×900远距离；主 viewport 中摄影机仍保持可辨的屏幕尺寸，monitor 仍正常显示人物/箱子而无 overlay。
- `electron-1229x768-dark.jpg`：开发 Electron 实例的实际宿主外层为 1229×768（物理屏幕无法提供原计划 1316×768）。切换到 8 镜双人对话场景并全局取景后，主 viewport 左上的专业摄影机清晰可辨；右 monitor 正常显示双人/箱子且无 overlay。Chrome 与 Electron 的不同环绕视角共同覆盖镜头前侧与后电池/机身后侧轮廓。

图片均经 `file` 复核为与扩展名一致的 JPEG；不保留伪 `.png` 文件。

## 自动证据边界

- 真实 Three.js `Vector3.project()` 回归覆盖近/远、屏内边缘、zoom=2、高 DPR、宽 FOV、小视口和小于 `viewCam.near` 的极近情形，核心尺寸为 48±0.2 CSS px。
- 独立 overlay camera 同步位姿/FOV/aspect/zoom，并按含天线的完整模型包围球动态收紧 near/far；断言完整球在裁剪范围内且 far/near < 20，保留机身自遮挡深度精度。
- 渲染顺序是主世界 → `clearDepth` → overlay；`clearDepth` 或 overlay render 抛错时 `try/finally` 恢复 `renderer.autoClear`。
- 可见性策略和 `setExportLook(true)` 回归覆盖 monitor、纯摄影机画面、thumbnail、摄影机捕获与 Seedance 导出隐藏；workspace 捕获保留主编辑 viewport。
- `stageToData()`、project root、`previz_autosave_v3`、FOV、路径、当前时间和 undo 在 12 次重建/渲染前后字节等价；重复 rebuild 及 duplicate scene → `loadScene()` → 切回时，camera overlay 的对象/几何/材质集合与命名子对象引用稳定。

## 未执行的交付

本任务没有运行 `app:deliver`，没有更新固定 App，也没有部署公网。
