# 视频合成 (Video Composite)

> 用混合模式、不透明度、2D 变换、可选蒙版和可动画关键帧，把一个视频叠加到另一个视频之上。

## 这个节点做什么

视频合成 (Video Composite) 接收 **background**（背景）和 **foreground**（前景）两段视频，并将它们合并成一段片段。前景可以用任意专业合并算子进行混合（`over`、`screen`、`multiply`、Porter-Duff 算子、HSL 模式等），用不透明度淡化，并在落到背景之前进行 2D 平移/缩放/旋转。可选的 **mask** 限制前景显示的区域，可选的关键帧轨道让变换随时间产生动画。

它在 **▶ Run** 时运行（GPU/torch 合成）。`background` 与 `foreground` 均为 `COMFYTV_VIDEO` 且必须连接——缺任一个都会报错。输出为单个 `COMFYTV_VIDEO`。

ComfyTV 的媒体以工程快照流转，而非原生 ComfyUI 张量。要把结果交给原生 ComfyUI 节点，请插入 **Bridge**（`ComfyTV/Bridge`）。参见 <https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md>。

## 何时使用

- 把（已抠好的）绿幕主体或 logo 叠到背景板上。
- 在素材上叠加 screen/plus 辉光层、multiply 阴影层或纹理层。
- 放置画中画插入画面，并用关键帧让它飞入。

## 参数

### operator
将前景叠到背景的混合/合并模式。选项（来自 `MERGE_OPERATORS`）：`atop`、`average`、`color`、`color-burn`、`color-dodge`、`conjoint-over`、`copy`、`difference`、`disjoint-over`、`divide`、`exclusion`、`freeze`、`from`、`geometric`、`grain-extract`、`grain-merge`、`hard-light`、`hue`、`hypot`、`in`、`luminosity`、`mask`、`matte`、`max`、`min`、`minus`、`multiply`、`out`、`over`、`overlay`、`pinlight`、`plus`、`reflect`、`saturation`、`screen`、`soft-light`、`stencil`、`under`、`xor`。默认 `over`（标准 alpha 合成）。

### opacity
前景不透明度，`0.0`–`1.0`，默认 `1.0`。将整个前景层向透明淡化。

### pos_x / pos_y
前景的平移，单位像素。范围 `-8192`–`8192`，步长 `1`，默认 `0`。正 `pos_x` 向右移；正 `pos_y` 向下移。

### scale
前景的等比缩放，`0.01`–`10.0`，默认 `1.0`（100%）。

### rotation
前景旋转，单位度，`-360`–`360`，步长 `0.5`，默认 `0`。

### keyframes
高级项：JSON 数组 `[{t, x, y, scale, rotation, opacity, interp}]`，让变换随时间产生动画。通常由节点画布上的关键帧 UI 驱动，而非手动输入。

### background / foreground（输入）
两个 `COMFYTV_VIDEO` 层。`background` 在后，`foreground` 混合在上。两者均必填。

### mask（输入，可选）
一个 `COMFYTV_VIDEO` 蒙版，限制前景可见的区域。

### track（输入，可选）
一个 `COMFYTV_TEXT` 运动/变换轨道（例如来自跟踪器）。连接后，其关键帧驱动前景变换，覆盖手动的 `keyframes`。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 合成后的片段：前景合并到背景上。 |

## 提示

- 这里不会对前景做色键——请在上游抠像或裁切（或送入 `mask`），使只有需要的像素参与合并。
- HSL 算子（`hue`、`saturation`、`color`、`luminosity`）和 Porter-Duff 算子（`in`、`out`、`atop`、`xor`、`stencil` 等）与常用的 `over`/`screen`/`multiply` 表现不同——请有意识地选择。

## 相关节点

- **Video Transform** — 对单段片段做相同的 2D 变换，无需第二层。
- **Video Transition** / **Luma Wipe** — 让两段片段随时间过渡，而非堆叠。
