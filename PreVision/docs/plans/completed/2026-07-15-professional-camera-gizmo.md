# 任务：专业电影摄影机可视化

- 状态：completed
- 日期：2026-07-15
- 对话：03.4｜专业电影摄影机可视化
- 分支：feat/professional-camera-gizmo
- 基线：2440c03fba51bf00396ec6812dd9a58dd4ed5355
- 固定 App 来源：7ff9aa583b4e51fb4d888aa1815792b747d275d7（当前基线已包含）
- 负责人：Codex 03.4

## 并行任务声明

- 任务 ID：03.4-professional-camera-gizmo
- 模式：write
- 模块：camera
- UI 表面：viewport
- 数据区域：shot-camera
- 实际修改文件：`预见PreVision.html`、`测试/冒烟测试.mjs`、`docs/CURRENT_STATE.md`、`docs/FEATURES.md`、`docs/FEATURE_REGISTRY.md`、`docs/plans/completed/2026-07-15-professional-camera-gizmo.md`、`docs/plans/completed/README.md`、`docs/qa/professional-camera-gizmo/README.md`、`docs/qa/professional-camera-gizmo/electron-1229x768-dark.jpg`、`docs/qa/professional-camera-gizmo/chrome-1440x900-light.jpg`、`docs/qa/professional-camera-gizmo/chrome-1440x900-dark.jpg`、`docs/qa/professional-camera-gizmo/chrome-1440x900-monitor-hidden.jpg`、`qa/feature-registry.yaml`、`qa/test-impact-map.yaml`
- `task:check` 结果：无硬冲突
- `task:claim`：已登记
- `task:release`：完成后已释放

## 用户问题

当前导演台只用红色机位点表示当前摄影机，无法直观判断专业电影摄影机的机身、镜头和视轴方向，且机位远近变化会让普通世界尺寸模型过大或过小。

## 目标

- 在独立 `cameraVizScene` 中程序化构建无品牌专业电影摄影机：长镜头/镜片、盒体、后电池、底轨、侧屏、旋钮、录制键/灯、顶板/提把和双天线。
- 模型位置和四元数跟随 `shotCam`，主体核心对不同景深、FOV、视口、DPR 和 zoom 稳定保持 48 CSS px，天线不计入核心尺寸。
- 当前机位红球替换为透明可命中代理，其他路径红点保持；命中区约 27 CSS px，原有选择/拖动语义不变。
- 主世界渲染后 `clearDepth`，再渲染 overlay，使摄影机不被场景遮挡但保留模型内部自遮挡。
- 仅主编辑 viewport 显示；monitor、纯摄影机画面、thumbnail、摄影机捕获和 Seedance 导出隐藏，workspace 捕获保留。
- 静态复用几何/材质，重建和切场不引起资源计数增长。

## 非目标

- 不修改 project v5、FOV、摄影机路径、时间轴、autosave 或 undo 数据语义。
- 不修改 monitor/截图/录屏/Seedance 导出的渲染内容。
- 不引入品牌资产、外部模型、新依赖或新数据版本。
- 本任务不运行 `app:deliver`、不更新固定 App、不公开部署。

## 证据与现状

- 代码：主导演台由 `viewCam` 渲染世界，`shotCam` 保存当前摄影机位置/朝向/FOV；机位路径使用红色 Mesh 节点。
- Git：基线 `2440c03fba51bf00396ec6812dd9a58dd4ed5355`，工作区初始 clean。
- 测试/运行：Node 24.14.0；开工 `app:status` 确认基线包含固定 App 来源 `7ff9aa5`。
- 文档/历史线索：旧 legacy worktree 仅作摄影机锚点只读参考，不整包复制、不修改、不集成其他未完成功能。

## 影响范围

- 模块：camera
- 文件：主 HTML、camera 冒烟回归、功能登记/影响映射、验收与 QA 证据。
- 数据格式：无变化；必须用 `stageToData()` 等价性回归证明。
- 平台：macOS Electron 与桌面 Chrome/Web，程序化行为同时经静态 Web 构建验证。

## 风险

- 数据：选中/拖动代理若错绑可能改变节点对应；用完整往返对比保护。
- UI/交互：固定像素尺寸计算若忽略 FOV/DPR/zoom 会在近远景、偏屏或高 DPI 时失真；命中代理与视觉模型分离。
- 安全：不增加 IPC、外部资源或网络访问。
- 发布：本任务仅交付集成提交，由 00 后续统一回归与固定 App 交付。

## 验收条件

- [x] 程序化专业摄影机包含长镜头/镜片、机身、后电池、底轨、侧屏、旋钮、录制键/灯、顶板/提把和双天线，无品牌标识。
- [x] 摄影机位置/quaternion 精确跟随 `shotCam`；核心在近/中/远、偏屏、zoom=2 和极近情形为 `48 ± 0.2 CSS px`，太阳仍为 24px。
- [x] 当前机位球为透明命中代理，其他路径红点保持；命中约 27px，点选/拖动语义不变。
- [x] 主世界 `render` 后 `clearDepth`、再 overlay `render`；专用 overlay camera 按完整模型包围球动态收紧 near/far，摄影机不被世界遮挡且保留自遮挡。
- [x] 可见性矩阵通过：只在主编辑 viewport 显示；monitor/纯摄影机画面/thumbnail/摄影机捕获/Seedance 导出不显示，workspace 捕获显示。
- [x] 反复重建和切换场景时摄影机可视化几何/材质资源计数稳定。
- [x] `stageToData()` 前后字节等价，project v5/FOV/path/time/autosave/undo 无变化。
- [x] 相关自动测试通过。
- [x] Chrome 1440×900 与实际宿主 Electron 1229×768 人工检查深/浅主题、近/中/远、前/后侧轮廓和 monitor 隐藏；导出隐藏由不落盘的运行时矩阵回归覆盖。
- [x] 本任务不执行 `app:deliver`；固定 App 和公开部署均未改变。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：main-app、app-test、foundation；额外验证静态 Web 清单。
- 主应用模块参数：camera
- 最小命令：`npm run test:module -- camera`、`npm run test:app`、`npm run test:web`、`npm run test:i18n`、`npm run test:foundation`、`npm run test:impact -- --base 2440c03 --module camera`、`npm run web:build`。
- 升级到全量的条件：摄影机数学、渲染顺序、捕获/导出可见性为高风险边界，因此必跑 `npm run test:full`。
- 人工检查尺寸/步骤：实际宿主 Electron 1229×768、Chrome 1440×900；四主题中至少覆盖深/浅，调整视点与摄影机路径检查近/中/远、前/后，进入 monitor 并执行不落盘的捕获/导出可见性检查。
- 固定 App 交付：不适用；本任务明确由 00 后续集成，不改 `~/Applications/PreVision.app`。

## 实施记录

- 假设：摄影机可视化是纯编辑辅助层，不是场景对象、不进入任何项目序列化。
- 关键决定：核心尺寸使用透视投影反算世界尺度；透明命中代理继续存在于主场景交互集合，视觉模型放在独立 overlay 场景。
- 实际修改：程序化构建含 33 个核心/附件命名 Mesh（另有 1 个轮廓 edge）的专业摄影机，将当前红球替换为 27px 透明命中代理；视觉对象放入独立 `cameraVizScene`，核心按真实包围球中心投影迭代保持 48px。
- 渲染安全：独立 `cameraVizCam` 同步交互摄影机位姿与投影参数，但按含天线的完整模型包围球动态收紧 near/far；`renderDirectorViewport()` 用 `try/finally` 恢复 `autoClear`。
- 数据/资源：可视化不进入 `stageToData()`；project root 与 `previz_autosave_v3` 前后字节一致；几何/材质/命名子对象在重复 rebuild 和 duplicate scene → `loadScene()` → 切回中静态复用。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status` | 通过 | <1s | 基线包含固定 App 来源 `7ff9aa5` |
| `npm run test:module -- camera` | 67/67 通过 | 10s | 含真实投影、动态裁剪、异常恢复、命中、序列化及隔离切场资源复用 |
| `npm run test:app` | 601/601 通过 | 30s | 完整应用回归 |
| `npm run test:web` | 10 + 13 通过 | 2s | 静态运行底座与压测工装 |
| `npm run test:i18n` | 21/21 通过 | <1s | 新增运行时无直接中文文案 |
| `npm run test:foundation` | 81 + 20 + 21 通过 | 2s | 仓库、协调、国际化 |
| `npm run test:impact -- --base 2440c03 --module camera` | 通过 | 33s | app + foundation + web |
| `npm run test:full` | 全部通过 | 35s | app 601、web 10+13、desktop 43、local-install 36+13、foundation 81+20+21 |
| `npm run web:build` | 通过 | <1s | provided-home，19 files |
| Chrome / Electron 人工检查 | 通过 | — | 1440×900 深/浅/远景/monitor；Electron 实际 1229×768 双人场景 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：本任务不更新固定 App，不适用。

## 未覆盖与后续

- 静态复用属性由自动资源计数和反复重建验证；无法代替最终 Web 候选版的长时间真机资源压力矩阵。
- 物理宿主实际 Electron 外层为 1229×768，因此未伪造 1316×768 证据；Chrome 按目标 1440×900 完成。

## 交接

- 最终提交：本归档所在的聚焦提交（哈希由交接消息与 00 集成记录固定）
- PR：无（本地仓库无 remote）
- 工作区状态：提交后 clean
- 下一步：完成后由 00 安全集成，统一回归，并在后续固定 App/公网候选版中一次性交付。
