# Pseudocolor

> 把画面亮度映射到调色板 —— 假彩色 / 热力图观感，或 viridis、turbo 等科学色图。

## 这个节点做什么

**Pseudocolor（伪彩色）** 把亮度经由选定调色板（colormap）映射来替换图像颜色。由暗到亮变成该调色板颜色的平滑渐变。可用于热成像 / 热力图风格、数据可视化美学，或醒目的风格化重着色。

这是一个需要渲染的节点 —— 必须 **▶ Run**，使用 ffmpeg 的 `pseudocolor` 滤镜。输入 `COMFYTV_VIDEO`，输出 `COMFYTV_VIDEO`。

要把结果交给原生 ComfyUI 节点，请插入 **Bridge**。参见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 何时使用

- 伪造热成像相机 / 热力图观感。
- 应用科学色图（viridis、magma、turbo……）营造数据可视化感。
- 对镜头做醒目的风格化重着色。

## 参数

### pseudo_preset
要映射的调色板。默认 `viridis`。取值之一：

`magma`、`inferno`、`plasma`、`viridis`、`turbo`、`cividis`、`range1`、`range2`、`shadows`、`highlights`、`solar`、`nominal`、`preferred`、`total`、`spectral`、`cool`、`heat`、`fiery`、`blues`、`green`、`helix`。

这些是 ffmpeg 内置的伪彩色预设 —— `magma`/`inferno`/`plasma`/`viridis`/`cividis`/`turbo` 是常见的感知均匀色图；`heat`/`fiery`/`solar` 读作热成像；`shadows`/`highlights` 强调对应色调范围。

### pseudo_opacity
`0.0`–`1.0`，默认 `1.0`。重着色相对原图的应用强度。`1.0` 为完全假彩色；调低可让调色板与原图混合。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 重着色后的片段 |

## 提示

- 调低 `pseudo_opacity` 得到仍保留部分原图的着色观感。
- `heat`、`fiery`、`solar` 最有"热成像相机"感；`viridis`/`turbo` 最像科学图表。

## 相关节点

- **Chroma Shift（色偏移）** —— RGB 分离 / 色散，而非调色板映射。
- **Posterize（色调分离）** —— 缩减为少量平涂色。
