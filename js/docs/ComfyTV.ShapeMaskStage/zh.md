# Shape Mask

> 用程序化渐变形状（径向、线性、时钟擦除、棋盘等）或一张亮度图生成遮罩。

## 这个节点是做什么的

**Shape Mask（形状蒙版）** 从选定的渐变/几何图案（`map_kind`）生成蒙版，再用阈值和柔化把它整形成遮罩。不用画：选一个形状类型，调阈值和柔化即可。点 ▶ 运行后把蒙版渲染到整段片子。

它有两条路径。若可选的 **shape_image** 输入留空，形状就按 `map_kind` 程序化生成，走 torch FX 处理。若接入 **shape_image**（一个 `COMFYTV_IMAGE`），节点改用那张图的亮度作为蒙版来源，走专门的 shape-mask 视频处理。

视频输入/输出都是 `COMFYTV_VIDEO`。要桥接到 ComfyUI 原生节点，用 `ComfyTV/Bridge`——详见 https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md。

## 适用场景

- 暗角、聚光、径向衰减，用来聚焦注意力
- 擦除转场（时钟、百叶窗、幕布、放射）作为动画遮罩
- 快速几何遮罩，把调色或特效限制在某处而不用手绘

## 参数

### map_kind
渐变/形状图案。可选：`linear_x`、`linear_y`、`bilinear_x`、`bilinear_y`、`radial`、`square`、`diamond`、`clock`、`symmetric_clock`、`spiral`、`burst`、`curtain`、`blinds_h`、`blinds_v`、`checker`、`cloud`。默认 `radial`。这是原始灰度场，阈值/柔化再把它整形成遮罩。

### threshold
对图案施加的切割电平，`0`–`1`，默认 `0.5`。高于此值变不透明，低于则透明。调低会扩大蒙版区域，调高则缩小。

### softness
阈值的边缘羽化，`0`–`1`，默认 `0.1`。`0` 为硬边；越大边界过渡越柔。

### invert
交换蒙版与非蒙版区域。布尔，默认关。

### animate
蒙版随片段如何运动。可选：`static`、`sweep_in`、`sweep_out`。默认 `static`。`sweep_in`/`sweep_out` 会随时间推移阈值来揭示或遮盖，形成擦除转场。

### output
`stencil`（默认）或 `matte`。选择结果以蒙版模板还是遮罩形式输出。

### seed
用噪声的图案（如 `cloud`）的随机种子。整数 `0`–`99999`，默认 `7`。

### shape_image（可选）
一个 `COMFYTV_IMAGE`。提供时，蒙版从这张图的亮度推导，而非程序化的 `map_kind`；threshold/softness/invert/animate/output 仍然生效。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 渲染出的蒙版片段（stencil 或 matte） |

## 小贴士

- `map_kind`、`seed` 和程序化路径只在 **shape_image** 为空时生效；接入图片会把节点切到亮度蒙版模式。
- 做转场时把 `animate` 设为 `sweep_in`/`sweep_out`，并选一个有方向的 `map_kind`（linear、clock、blinds、curtain）。

## 相关节点

- **Roto Mask** — 手绘样条遮罩
- **Mask Propagate** — 让蒙版跟随运动
- **Cutout / Erase** — 用蒙版抠出或移除内容
