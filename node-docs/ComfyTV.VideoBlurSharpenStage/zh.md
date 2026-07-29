# 模糊 / 锐化 (Blur / Sharpen)

> 用多种模糊核或反锐化蒙版柔化或锐化整段素材，一次 ▶ 运行完成。

## 这个节点是做什么的

**Blur / Sharpen** 对整段 `COMFYTV_VIDEO` 应用四种空间滤镜之一：高斯模糊、快速盒式模糊、保边的双边模糊，或反锐化蒙版锐化。点 **▶ 运行** 时经 ffmpeg 处理并写出新的视频快照；原始素材不变。

输入输出都是 `COMFYTV_VIDEO`。要接原生 ComfyUI 节点，请插入 **Bridge** — 见[桥接说明](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 适用场景

- 用柔和的高斯或盒式模糊压噪或虚化背景。
- 用双边模式在保持边缘锐利（皮肤、产品轮廓）的同时模糊。
- 导出前用锐化模式给略显发虚的素材补回细节。

## 参数说明

### mode（模式）
运行哪种滤镜。选项：`gaussian`（平滑模糊）、`box`（快速均值模糊）、`bilateral`（保边模糊）、`sharpen`（反锐化蒙版）。默认 `gaussian`。

### amount（强度）
主强度旋钮，`0.0`–`20.0`，默认 `2.0`。含义随 **mode** 变化：分别是高斯 sigma、盒式核尺寸、双边空间 sigma，或（sharpen 时内部限制在 0–5）反锐化量。`gaussian` 和 `sharpen` 模式下必须大于 0。建议从 `2.0` 起步再微调。

### size（核尺寸）
奇数核尺寸，`3`–`13`，默认 `5`。仅 **sharpen** 模式使用（反锐化 luma 矩阵）；值越大锐化越粗的细节。偶数会被推到下一个奇数。

### edge_preserve（保边）
双边色彩 sigma（`sigmaR`），`0.01`–`1.0`，默认 `0.1`。仅 **bilateral** 模式使用。值越低边缘越硬（跨对比度的颜色渗透越少）；值越高模糊越自由。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 滤镜处理后的新项目快照 |

## 使用提示

- **size** 和 **edge_preserve** 只在各自模式（`sharpen`、`bilateral`）下有效；其它模式下改动无作用。
- `box` 把 **amount** 当作像素核尺寸，因此强度增长曲线与 `gaussian` 不同。

## 相关节点

- **Video Denoise**——去颗粒/噪点，而非柔化细节。
- **Video Stabilize / Stabilize Pro**——滤镜前后稳定画面。
