# Video Color

> 面向视频片段的一站式一级校色器 —— 曝光、白平衡、色相/饱和度、色阶和三向色轮全在一个节点里。

## 节点用途

**Video Color（视频调色）** 是日常调色面板。它把最常用的一级校正 —— 亮度/曝光、色温、色相与饱和度、黑/白色阶，以及暗部/中间调/高光色轮 —— 集中到一张滑块卡片上。

它输入输出均为 `COMFYTV_VIDEO`，通过 ffmpeg 的色彩滤镜（`exposure`、`colortemperature`、`huesaturation`、`vibrance`、`colorlevels`、`colorbalance`）渲染。由于需要重新编码帧，它带有 **▶ Run**；卡片提供实时片段预览，便于在正式渲染前调好数值。只有你实际改动过的控件才会写入渲染 —— 全部保持中性时，片段原样通过。

要把结果接入原生 ComfyUI 节点，请插入 **Bridge**（见 [Bridge 指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)）。

## 何时使用

- 一次性修正偏灰、偏暗或白平衡错误的生成结果
- 让镜头偏暖或偏冷，以匹配整段序列
- 提升（或收敛）饱和度与自然饱和度
- 用三向色轮做分离调色 —— 青色暗部、暖色高光等

## 参数

### exposure / black
`exposure`（默认 0.0，范围 −3.0…3.0）以档位为单位整体提亮或压暗。`black`（默认 0.0，范围 −0.1…0.1）平移黑场。二者共同映射到 ffmpeg 的 `exposure` 滤镜。先调 exposure，仅在需要抬高或压低暗部时再微调 black。

### temperature / temp_mix
`temperature`（默认 6500 K，范围 1000…40000）设定目标白平衡色温，越低越暖、越高越冷。`temp_mix`（默认 1.0，范围 0.0…1.0）控制该偏移的强度。仅当 `temperature` 不等于中性的 6500 K 时才会加入该滤镜。

### hue / saturation
`hue`（默认 0.0，范围 −180…180 度）整体旋转色相。`saturation`（默认 0.0，范围 −1.0…1.0）让色彩更浓或更淡。二者驱动 `huesaturation` 滤镜。

### vibrance
`vibrance`（默认 0.0，范围 −2.0…2.0）对较弱的颜色提升更多、对已高饱和的颜色提升更少，比一刀切的饱和度更能保护肤色。

### blackpoint / whitepoint
`blackpoint`（默认 0.0，范围 −0.5…0.5）与 `whitepoint`（默认 1.0，范围 0.5…2.0）逐 RGB 通道设定输入色阶，类似色阶工具里的黑/白场。抬高 blackpoint 加深暗部；降低 whitepoint（或推到 1.0 以上）拉伸高光。通过 `colorlevels` 实现。

### shadows_r / shadows_g / shadows_b、midtones_r/g/b、highlights_r/g/b
九个值（各默认 0.0，范围 −1.0…1.0），构成经典三向色轮调色。R/G/B 为正把该色调区推向红/绿/蓝，为负则推向青/品红/黄。它们送入 `colorbalance` 滤镜。

### preserve_lightness
布尔（默认开）。开启时（`pl=1`），色轮平衡会保持整体明度稳定，使得给暗部/高光染色时不至于同时改变曝光。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 调色后的片段快照，供下游阶段使用 |

## 提示

- 若 Run 后毫无变化，请检查是否至少有一个控件偏离了中性值 —— 全中性节点会原样放行片段。
- 在大幅拉高 `saturation` 前先用 `vibrance`，人脸上更自然。
- `whitepoint` 高于 1.0 会拉伸高光（增加输出余量）；等于或低于 1.0 时只是重映射输入色阶。

## 相关节点

- **Video Curves** —— 滑块不够用时做精确的逐通道影调塑形
- **CDL Grade** —— 按 ASC-CDL 约定的 slope/offset/power 调色
- **Video LUT** —— 在一级调色之上套用成品 `.cube` 风格
- **Auto White Balance** —— 一键中性，省去手动色温
