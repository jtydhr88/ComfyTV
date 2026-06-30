# 提取帧 (Extract Frame)

> 从视频里抽出一张静态图（首帧、末帧、中间帧或指定秒数），输出 `COMFYTV_IMAGE`，后端使用 **PyAV** 在磁盘原片上处理，不占 GPU。

## 这个节点是做什么的

**Extract Frame** 是 ComfyTV 视频工具链的「定格」步骤：给定一段 `COMFYTV_VIDEO`，按 **position** 或 **at_seconds** 取一帧，保存为图片快照。常用于从生成视频里拿末帧做 **↪ Extend** 续接、做缩略图、或送进 Image Edit / Upscale。

处理在本地用 **PyAV**（FFmpeg 库）读写文件，不经过 ComfyUI 的 GPU 图像/视频处理管线，速度快、VRAM 零占用。

## 适用场景

- 从 AI 生成片段取最后一帧做 I2V 续接
- 抽中间帧检查运动或构图
- 视频 → 静态图 → 编辑 / 放大后再回视频

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** + **▶ 运行**：只对本节点上游视频快照抽帧，不 Queue 整图。
- **快照**：读上游 **video** 的 URL；上游变更后须重跑上游再 Run 本节点。
- **PyAV 后端**：直接解析 `/view?` 指向的 mp4 等文件，解码单帧写 PNG。详见 [video-and-audio.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md)。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_VIDEO` | 视频 URL 快照 | 不是 ComfyUI `VIDEO` 对象 |
| `COMFYTV_IMAGE` | 抽出的单帧 URL | 不是 ComfyUI 内存图像 |

**如何转换：** 原生插件视频 → **→ ComfyTV Video**；帧变成 ComfyUI 内存图像 → **← ComfyTV Image**。见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## 界面与参数说明

### video（输入）
上游 `COMFYTV_VIDEO`。来自 **Video Stage**、**Load Video**、**Video Clip** 等。未连接时 Run 报错。

### position
- **last** — 末帧（续接常用）
- **first** — 首帧
- **middle** — 时长中点
- **custom** — 用 **at_seconds**

### at_seconds
自定义时间戳（秒），仅 **position=custom** 时生效。范围 0–3600。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | 抽取的单帧 | Upscale、Image Edit、Video Stage（I2V） |

## 新手一步一步

1. 画布上有带 **COMFYTV_VIDEO** 输出的节点（如 **Video Stage**），先 Run 出视频。
2. 拖 **Extract Frame**，连 **video**。
3. **position** 选 **last**（或 **custom** + 秒数）。
4. **▶ 运行**，在缩略图查看抽帧结果。
5. 接到 **Upscale** 或 **Video Stage**（I2V）继续。

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

**Q：提示 needs upstream video？**  
A：Run 上游视频 stage；确认 **video** 已连线。

**Q：和 Load Video + Save Image 比？**  
A：Extract Frame 留在 ComfyTV 快照体系（下游 `COMFYTV_IMAGE`），且只跑本节点。

**Q：自定义时间超出时长？**  
A：PyAV 会 clamp 到有效范围；可能落在末帧附近。

## 相关节点

- **Video Stage** / **Load Video** —— 视频来源
- **Video Clip** —— 先剪再抽帧
- **↪ Extend**（工具栏）—— 自动抽末帧并新建 Video Stage
