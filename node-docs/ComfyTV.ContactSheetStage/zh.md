# 审片宫格 (Contact Sheet)

> 把视频中均匀采样的帧排成一张网格图——用来一眼扫完整段片子的审片宫格 / contact sheet。

## 这个节点是做什么的

**Contact Sheet（审片宫格）** 在 `COMFYTV_VIDEO` 上均匀采样帧，拼成一张网格 `COMFYTV_IMAGE`。你选网格尺寸、输出宽度以及是否打时间码，然后点 **▶ 运行**（服务器端一次 ffmpeg 处理）。结果是一张可供审阅、保存或导出的图。

格子数量为 `cols × rows`，沿片段时长均匀采样。

## 适用场景

- 用一张图总览整段片子，供审阅或过审。
- 从素材快速做故事板式的一览表。
- 一眼对比一场戏里的构图/布光。

## 参数说明

### cols（列数）
网格列数，1–12，默认 4。

### rows（行数）
网格行数，1–12，默认 4。默认即均匀采样 16 帧。

### sheet_width（图宽）
输出图宽度（像素），320–8192，默认 1920。格子尺寸由此和列数决定。

### timecode（时间码）
布尔，默认开。开启时每个格子会打上其源时间码。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | 拼好的审片宫格网格 |

## 使用提示

- 格子越多（cols × rows 越大）覆盖越细但缩略图越小——调高 `sheet_width` 保持可读。
- 审片宫格建议保持 `timecode` 开，便于跳回源片段的精确时刻。
- 这是沿整段时长均匀采样；若要每个**镜头**一帧，请用 **Scene Detect** 再做宫格。

## 类型与 Bridge

`COMFYTV_VIDEO` / `COMFYTV_IMAGE` 是 ComfyTV 项目快照，不是 ComfyUI 原生类型。用 **Bridge**（`ComfyTV/Bridge`）与原生节点互通。详见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 相关节点

- **Scene Detect（场景检测）**——每个检测到的镜头一张缩略图，而非均匀采样。
- **Video Scopes（视频示波器）**——单帧的测量示波器。
