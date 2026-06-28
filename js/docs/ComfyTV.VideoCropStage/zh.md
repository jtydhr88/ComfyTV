# 视频画面裁剪 (Video Crop)

> 对每一帧裁切同一矩形区域，**PyAV** 处理，帧率不变，输出 `COMFYTV_VIDEO`。这是 **PyAV 媒体处理** stage，不是 **Video Stage** 的 AI 视频生成。

## 这个节点是做什么的

**Video Crop** 用 **x, y, w, h**（像素）在每一帧上切同样一块画面，去掉周围黑边、水印区或无关区域。和 Image Crop 类似，但是 **整段视频** 逐帧应用同一矩形。不跑文/图生视频 workflow。

后端 **PyAV** 直接在磁盘 mp4 上重编码裁切区域，不占 GPU。

## 适用场景

- 去掉 letterbox 黑边
- 固定 ROI 再 Resize 到标准分辨率
- 裁掉画面底部字幕区（正式去字幕见 Subtitle Erase，目前待支持）

## 工作原理

- **Stage** + **▶ 运行**：只处理本节点；读上游视频快照。
- **PyAV** `crop_video`：保持原 fps 与时间轴。
- 矩形须在源帧范围内；**w/h** 为偶数更稳妥（编码友好）。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_VIDEO` 入/出 | URL 快照，不是 ComfyUI 内存视频 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### video
源 `COMFYTV_VIDEO`。

### x / y
裁剪矩形左上角像素坐标。

### w / h
裁剪宽高（像素），默认 512×512。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Resize、Demux、Extract Frame |

## 新手一步一步

1. Run 上游视频节点，连 **video**。
2. 设 **x, y, w, h**（根据源视频分辨率手动填写像素坐标）。
3. **▶ 运行**，检查裁切结果。
4. 需要标准尺寸时接 **Video Resize**。

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

**Q：裁切超出画面？**  
A：PyAV 会报错或 clamp；请保证 x+w ≤ 宽度、y+h ≤ 高度。

**Q：和 Subtitle Erase (Region) 区别？**  
A：Crop 是简单几何裁切；Region 去字幕（⏳ 待支持）会 inpaint 填充，需框选 UI。

**Q：帧率变了吗？**  
A：不变。

**Q：裁剪后还能 Demux 吗？**  
A：可以。Crop 输出仍是 `COMFYTV_VIDEO`，可接 **Demux · Audio Track** 或工具栏 🔀 **Demux**。

**Q：坐标原点在哪？**  
A：左上角 (0,0)，与 ComfyUI IMAGE 裁剪 convention 一致。

## 相关节点

- **Video Resize** / **Video Clip**
- **Video Subtitle Select Erase**（路线图）
