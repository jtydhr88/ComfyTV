# Video Curves

> 面向片段的 Photoshop 式影调曲线 —— 主曲线与逐通道曲线，外加现成的电影风格预设。

## 节点用途

**Video Curves（视频曲线）** 用可编辑曲线重塑影调，就像图像编辑器里的曲线工具。你可以弯折主（明度）曲线来增加对比或抬高暗部，也可以分别调整红、绿、蓝通道来做色彩校正。

它输入输出均为 `COMFYTV_VIDEO`，通过 ffmpeg 的 `curves` 滤镜渲染。由于需要重新编码，它带有 **▶ Run**，卡片上有实时预览。控制点以 JSON 形式存储，为 `[x, y]` 对的列表（均为 0…1）；渲染前会对点做钳制、去重和排序，且一个通道至少需要两个有效点才会生效。

要与原生 ComfyUI 节点互通，请加一个 **Bridge**（见 [Bridge 指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)）。

## 何时使用

- 用平缓的 S 曲线增加电影感对比
- 抬高压死的黑场或压回过曝的高光
- 分别塑造 R/G/B 曲线以中和偏色
- 直接套用某个预设"风格"（vintage、cross-process、negative）作为快速起点

## 参数

### preset
内置曲线风格下拉菜单，默认 `none`。选项：`none`、`color_negative`、`cross_process`、`darker`、`increase_contrast`、`lighter`、`linear_contrast`、`medium_contrast`、`negative`、`strong_contrast`、`vintage`。它们映射到 ffmpeg 内置曲线预设，并可与自定义点叠加使用。

### master_pts
主/明度曲线的 JSON 控制点列表 `[x, y]`（0…1），例如 `[[0,0],[0.5,0.55],[1,1]]`。塑造所有通道的整体亮度与对比。

### red_pts / green_pts / blue_pts
分别为红、绿、蓝通道的 JSON `[x, y]` 点列表。用它们把偏色推入或推出特定影调范围 —— 例如暖色暗部 / 冷色高光的分离。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 曲线调色后的片段快照 |

## 提示

- 有效点少于两个的通道会被忽略 —— 单个点不产生任何效果。
- 点会被钳制到 0…1，同一 x 上的重复点会合并，因此重叠点不会叠加。
- 若同时设置了 `preset` 和自定义点，`curves` 滤镜会同时应用两者。

## 相关节点

- **Video Color** —— 不需要完整曲线时，用滑块调曝光、色温和色阶
- **CDL Grade** —— 按 ASC-CDL 约定的 slope/offset/power 调色
- **Video LUT** —— 把成品风格烘焙为 `.cube` 查找表
