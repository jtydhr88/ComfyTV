# 任务：PreVision 透明通道高清母版

- 状态：completed
- 日期：2026-07-15
- 对话：03.1｜PreVision 透明通道高清母版
- 分支：chore/transparent-icon-master
- 基线：f49edd3ab09aa419a36254f14864f09b03e37e57
- 固定 App 来源：de0c6acfff21ecae683b9ffa33d79780cedad351；当前基线包含该提交
- 负责人：Codex

## 并行任务声明

- 任务 ID：03.1-transparent-icon-master
- 模式：write
- 模块：repository
- UI 表面：app-shell
- 数据区域：无；本任务不修改 `qa/` 机器元数据或应用持久数据
- 预计修改文件：
  - `assets/PreVisionIcon-master-transparent.png`
  - `docs/plans/active/2026-07-15-transparent-icon-master.md`
  - `docs/plans/completed/2026-07-15-transparent-icon-master.md`
  - `docs/qa/transparent-icon-master/validation-contact-sheet.png`
- `task:check` 结果：首次按建议声明 `qa-metadata` 时与已扩围的 `01.legacy-capture-save-location` 硬冲突；核对真实 diff 后移除不准确的数据区域标签，以 `repository`、`app-shell` 和明确文件复查后无硬冲突、无软冲突
- `task:claim`：已登记
- `task:release`：已释放

## 用户问题

把现有最高分辨率母版 `assets/PreVisionIcon-master.png`（1254×1254、RGB、无 Alpha）制作成便于 Canva 设计使用的透明通道 PNG；品牌标志不得由 AI 重绘，只允许图标圆角外部区域透明。

## 目标

- 新建 1254×1254 RGBA PNG，不覆盖原母版。
- 原图 RGB 像素作为唯一品牌事实，只计算圆角图标外部区域的 Alpha；保留黑色图标本体、外缘、红色 P、青色眼睛及全部渐变和纹理。
- 在仓库保存成品，在桌面额外保存一份 Canva 拖放副本。
- 保存透明棋盘、浅色和深色背景的视觉验收证据，并记录可重复的像素指标。

## 非目标

- 不重绘、补画、锐化、调色或重新采样品牌图形。
- 不替换应用当前运行时或 Forge 图标，不改变产品行为。
- 不运行 `app:deliver`，不更新 `~/Applications/PreVision.app`；最终集成与固定 App 交付由 `00` 总协调完成。

## 证据与现状

- 代码：原母版为 `assets/PreVisionIcon-master.png`，文件类型为 1254×1254、8-bit RGB PNG；SHA-256 为 `896bd703d8f01ce4bdd1036b66a7900379f98af8de90a36abe2e127d31476c9e`。
- Git：当前 HEAD 为 `f49edd3`，且 `de0c6ac` 是其祖先；工作树开工前干净。
- 测试/运行：Node 24.14.0 下 `npm ci` 成功；命名分支上的 `npm run app:status` 显示 `Contains installed source: yes`。
- 文档/历史线索：`assets/` 命中 `qa/test-impact-map.yaml` 的 build-config；该 master 文件未被运行时或 Forge 直接引用。

## 影响范围

- 模块：repository（保守声明 app-shell 品牌表面）
- 文件：透明母版、视觉验收图、本验收单
- 数据格式：无；新增标准 PNG RGBA 设计资产
- 平台：跨平台设计素材；额外提供 macOS 桌面副本供 Canva 使用

## 风险

- 数据：错误阈值可能侵蚀深色图标外缘，或保留外部黑底。
- UI/交互：无运行时 UI 变化；视觉风险仅限设计素材边缘。
- 安全：不调用真实付费 AI 服务；不写入凭据或私人项目数据。
- 发布：`assets/` 会触发构建配置影响测试，但新文件未接入打包；本任务不交付固定 App。

## 验收条件

- [x] 成品保持 1254×1254、PNG RGBA，并存在真实 Alpha；四角 alpha 均为 0。
- [x] 只让圆角图标外部透明；主体可见，无明显黑边或彩边。
- [x] 非透明主体 RGB/几何与原图尽可能像素级一致，且无 AI 重绘或重新采样。
- [x] 原母版未覆盖，仓库成品与桌面副本内容一致。
- [x] 透明棋盘、浅色和深色背景人工检查完成并保存证据。
- [x] `npm run test:impact -- --base f49edd3` 与 `npm run test:i18n` 通过。
- [x] 需要的人工验证完成。
- [x] 固定 App 交付不适用：本任务只新增未接入运行时的 Canva 设计素材，由 `00` 总协调后续集成。
- [x] 文档和功能登记已评估；无产品功能状态变化，无需修改 `FEATURE_REGISTRY`。

## 测试计划

- 影响映射模块：build-config、foundation
- 主应用模块参数：无
- 最小命令：`npm run test:impact -- --base f49edd3`、`npm run test:i18n`
- 升级到全量的条件：如果实际修改运行时、Forge、现有图标或未知文件，则升级 `npm run test:full`。
- 人工检查尺寸/步骤：原始 1254×1254 尺寸下检查 Alpha 边界，并在透明棋盘、浅色、深色三种背景上检查圆角、外缘和颜色。
- 固定 App 交付：不适用；不修改安装包，且用户明确由 `00` 总协调集成。

## 实施记录

- 假设：圆角图标外部是唯一应透明区域；图标内部所有深色像素均属于品牌本体。
- 关键决定：遵循 imagegen 技能的本地背景提取与 Alpha 验证思路，但因品牌像素不可重绘，不调用生成模型；不透明主体 RGB 直接复制原母版，只在部分透明抗锯齿带做必要的黑底反预乘。
- 实际修改：
  - 新增 `assets/PreVisionIcon-master-transparent.png`，保持 1254×1254，并以原母版为唯一 RGB/几何来源。
  - 只从四边 flood-fill 与黑底相连的像素；`maxRGB <= 2` 定义确定背景，`maxRGB <= 20` 定义 1–2px 抗锯齿带，未对全图做删黑。
  - 1,161,553 个 `alpha=255` 主体像素逐字节保留原 RGB；仅对 2,106 个部分透明边缘像素做局部黑底反预乘，以消除浅色背景黑边。红色 P 的 246,424 个像素与青色眼睛的 5,444 个像素均保持 `alpha=255`。
  - 严格连通性检查发现并清除了 `(81,319)`、`(81,320)` 两个独立低 Alpha 外部像素；最终非零 Alpha 仅有一个连续轮廓，内部无透明孔洞。
  - 新增 `docs/qa/transparent-icon-master/validation-contact-sheet.png`，保存透明棋盘、浅色、深色、4× 边缘和 Alpha 蒙版证据。
  - 复制相同成品到 `~/Desktop/PreVisionIcon-master-transparent.png`；桌面副本不进入 Git。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24.14.0 `npm ci` | 通过 | 7.0s | 安装 504 个锁定依赖；未改 lockfile。npm 报告的既有依赖审计提示未在本任务扩围处理。 |
| `npm run app:status` | 通过 | <1s | installed source `de0c6ac`；当前基线 `f49edd3` 包含该提交。 |
| `task:check` / `task:claim` | 通过 | <1s | 初始建议标签 `qa-metadata` 与已扩围的录屏任务硬冲突；按真实范围移除该不准确标签后无硬/软冲突，并以完全相同参数 claim。 |
| Pillow/NumPy 严格图像验证 | 通过 | 0.52s | 1254×1254 RGBA；Alpha 0–255 共 119 级；透明 408,857、部分透明 2,106、不透明 1,161,553；四角 0；主体单连通、无孔洞；不透明 RGB mismatch 0。 |
| 原黑底复合回归 | 通过 | 同上 | 主体像素 MAE 0.000178747/通道，最大误差 2 灰阶；输出 SHA-256 `ff088b305c1ac448aa01ce28ea78813a3a9b6ea75079e007dd76a4118446c0f6`，桌面副本一致。 |
| 棋盘、浅色、深色与 4× 边缘人工检查 | 通过 | 人工 | 无可见外部黑底、黑边、彩边、亮边或异常锯齿；黑色图标本体、外缘、红色 P、青色眼睛、渐变和纹理均可见。证据见 `docs/qa/transparent-icon-master/validation-contact-sheet.png`。 |
| `npm run test:impact -- --base f49edd3` | 通过 | 1.55s | 命中 build-config/foundation；desktop 23、foundation 66、coordination 20、i18n 21 全通过。 |
| `npm run test:i18n` | 通过 | 0.25s | 21 通过、0 失败；按每任务硬要求单独执行。 |
| `npm run task:release -- --task 03.1-transparent-icon-master` | 通过 | <1s | 返回 `RELEASED`；共享登记中只剩 `01.legacy-capture-save-location`。 |

固定 App installed source：`de0c6acfff21ecae683b9ffa33d79780cedad351`

固定 App 人工启动结果：不适用；新母版未接入运行时或 Forge，且用户明确要求由 `00` 总协调完成正式集成，因此未运行 `app:deliver`、未更新或启动固定 App。

## 未覆盖与后续

- Canva 的服务端再编码不在本机自动测试范围；交付 PNG 已以标准 RGBA 和同哈希桌面副本供直接导入。
- `test:impact` 提示 `assets/` 在对外发布前需要构建与真机检查；本文件未接入应用或 Forge，本任务不是发布/固定 App 交付，因此未运行 package、make 或 `app:deliver`。

## 交接

- 最终提交：本验收单随聚焦提交归档；精确 SHA 见交接输出
- PR：无（仓库无 remote，GitHub 未登录）
- 工作区状态：提交后应干净
- 下一步：由 `00` 总协调审查并按集成顺序纳入后续基线。
