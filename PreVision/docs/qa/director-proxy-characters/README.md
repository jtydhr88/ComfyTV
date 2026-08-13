# 02.11 导演台高识别人物代理 QA

- 日期：2026-07-29
- 基线：`f0cfdf9191a495c83510116ee483137ef7ce1557`
- 分支：`feat/02.11-director-proxy-characters`
- 阶段：快速 `NOT INTEGRATED` 预览
- 窗口标题：`PreVision 02.11 Preview — NOT INTEGRATED`
- 环境：Node v24.18.0；Electron 43.1.0；独立临时 user-data

## 产品合同检查

- 快速预览模型库直接提供 `+ 男人`、`+ 女人`、`+ 小朋友`，三项均通过真实 Electron UI 点击创建；运行时不再提供 wizard 入口或装饰。
- 人物主色固定为男人 `#2F6BFF`、女人 `#F0445E`、小朋友 `#FFD43B`。头、躯干和四肢复用整类主色；白色/深色只用于五官、正面方向和主要关节标记。
- 工厂按真实 Three `Box3` 几何 bounds 归一化到约 1.78m、1.66m、1.2m；自动回归还验证女人略窄、儿童比例明显不同。
- shoulder/elbow/wrist/hip/knee/ankle 标记以及 eye/pupil/brow/nose/mouth/ear/forward marker 均有稳定名称、父级和高反差材质。
- legacy `kind:'char', characterStyle:'wizard'` 归一化为 `adult_male`，保留路径、时序、ease、pose、joints、mount、asset、尺寸、位置/旋转/高度/scale，保存后不再输出 `characterStyle`。普通无 `semanticType` 的旧 char 只在运行时使用成人男性视觉默认，保存仍保持字段缺失。

## 自动门禁

- `npm run test:module -- actor`：177 通过，0 失败。
- `npm run test:module -- project`：121 通过，0 失败。
- `npm run test:module -- history`：29 通过，0 失败。
- `npm run test:module -- layout`：160 通过，0 失败。
- `npm run test:i18n`：217 通过，0 失败。
- `node 测试/回归/C1_previz_roundtrip.mjs`：52 通过，0 失败。
- `node 测试/回归/U4_normalize_malformed.mjs`：本任务新增 legacy wizard case 通过；全文件 112 通过、2 失败。两项都属于既有“镜头时长纯计划/原子应用”case 26，并在精确基线的独立 Git archive 上以完全相同结果复现，因此没有跨出本任务 scope 修改时间轴合同。
- `npm run build`：通过。
- `git diff --check`：通过。
- 按任务约束未运行 `test:impact`、`test:full`、`app:deliver`。

## 真实 Electron 检查

### 1440×900

- renderer 核对外框 `1440×900`、内容区 `1440×868`、DPR 2。
- 通过真实 UI 依次点击男人、女人、小朋友按钮；为保持截图确定性，在同一隔离 renderer 中把三者排成正面 / 侧面 / 3⁄4，姿态分别为站立 / 蹲下 / 坐下并抬臂。
- director viewport 与 monitor 同时显示三者，蓝、红、黄无需标签也可一眼区分；正面眼睛/瞳孔/眉鼻嘴耳、侧面轮廓和弯曲的肘膝踝均可读。
- Computer Use 截图传输把 1440×900 外框等比限制到 1229×768；仓库 PNG 保留实际传输像素，没有插值放大。外框尺寸以 renderer 实测为准。

### 1316×768

- renderer 核对外框 `1316×768`、内容区 `1316×736`、DPR 2。
- 三个按钮均可见；男人/女人/小朋友按钮实测分别为 `139×34`、`139×34`、`139×34` CSS px。
- 属性右栏 `clientWidth=302`、`scrollWidth=302`、`scrollLeft=0`，没有横向溢出；滚动后按钮保持两列排列，不互相覆盖。
- monitor 与导演台继续同时显示蓝、红、黄三类代理。

## 截图

- `electron-1440x900.png`：真实 1440×900 外框的 Computer Use 传输截图，文件像素 1229×768。
- `electron-1316x768.png`：真实 1316×768 窗口截图，文件像素 1316×768。
- 原始 SHA-256 和结构化指标见 `evidence.json`。

## 边界

- 本轮没有更新固定 App、`PreVision 最新预览` 指针、GitHub 或 Pages。
- 截图证明本地 stage、monitor 和 UI 布局；不把它扩张为 Seedance 外部生成效果或高精角色资产验收。
- 当前成果仍需实现者之外的独立 R2 与中央集成；claim 保持到 `00` 完成后续流程。
