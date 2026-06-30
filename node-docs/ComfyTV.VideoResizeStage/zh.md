# 视频缩放 (Video Resize)

> 改变输出宽高（可设 -1 保持比例），帧率不变，**PyAV** 重采样，输出 `COMFYTV_VIDEO`。这是 **PyAV 媒体处理** stage，不是 **Video Stage** 的 AI 视频生成。

## 这个节点是做什么的

**Video Resize** 把整段视频缩放到目标 **width × height**。宽或高设为 **-1** 时，按另一维与源片宽高比自动推算——和常见 ffmpeg scale 行为一致。适合统一分辨率再上传、或减小文件体积。不跑文/图生视频 workflow。

**PyAV** 后端，不占 GPU。

## 适用场景

- 生成结果缩到 720p / 1080p 再分享
- Crop 后统一到平台要求尺寸
- 缩小体积再 Demux / 分离（Demucs 待支持）

## 工作原理

- **Stage** + **▶ 运行**；读上游快照。
- **PyAV** `resize_video`；fps 不变。
- width/height 至少一维为正；双 -1 无效。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_VIDEO` | URL 快照 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### video
源 `COMFYTV_VIDEO`。

### width / height
目标像素。默认 1280×720。任一可为 **-1**（按源比例推导另一维）。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 任意视频 stage |

## 新手一步一步

1. 连上游 **video**，Run 上游。
2. 设目标 **width/height**（如 1280, 720）。
3. **▶ 运行**。
4. 预览确认无意外拉伸（两维都设正数时可能改变比例；要保比例请一维设 -1）。

## 链接

| 资源 | 链接 |
|---|---|
| 视频与音频指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md |
| ComfyTV 仓库 | https://github.com/jtydhr88/ComfyTV |

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：画面被拉扁了？**  
A：两维都写死且比例与源不同会拉伸；用 **width=1280, height=-1** 保比例。

**Q：和 Video Upscale 区别？**  
A：Resize 是几何缩放；Upscale（⏳ 待支持）是 AI 逐帧放大。

**Q：mesh2motion 输出要先 Resize 吗？**  
A：先 **→ ComfyTV Video**，再 Resize。

**Q：Demux 后再 Resize 顺序？**  
A：常见：Demux 得 Silent Video → Resize 无声画面；音轨单独处理。顺序可换，视是否要原音轨而定。

**Q：-1 推导怎么算？**  
A：例如源 1920×1080，设 width=1280 height=-1 → 高度约 720，保持 16:9。

**Q：Resize 会改变文件编码吗？**  
A：PyAV 通常重编码视频流；fps 不变，画质由码率设置决定（当前为默认）。

## 相关节点

- **Video Crop** / **Video Clip**
- **Video Upscale**（路线图）
