# 视频高清 (Video Upscale)

> **路线图 / 待支持** —— 设计意图是用 AI 逐帧放大视频（2x / 4x）；当前 Run 会抛出 `StageNotImplemented`，尚无真实 upscale 后端。

## 这个节点是做什么的（设计意图）

**Video Upscale** 计划对 `COMFYTV_VIDEO` **逐帧**做超分辨率（类似图片 **Upscale** stage，但是整段视频）。**scale** 参数预留 **2x** / **4x**。完成后输出仍是 `COMFYTV_VIDEO`，可继续 Clip / Demux。

> ⚠️ **当前状态**：节点已在面板中占位，但 [`video_audio.py`](https://github.com/jtydhr88/ComfyTV/blob/main/nodes/stages/video_audio.py) 里 `execute` 直接 `raise StageNotImplemented`。点 **▶ 运行** 会报错，**不会**产生假 URL。见 [roadmap.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md)。

## 适用场景（实现后）

- 低分辨率 I2V / T2V 结果放大到 1080p+
- mesh2motion 等插件视频进 ComfyTV 后统一放大
- 放大后再字幕擦除（Subtitle Erase 亦待支持）

## 工作原理（规划）

- **Stage** + **▶ 运行** + **快照** 体系与其它视频 stage 一致。
- 预期走 `workflows/` 下视频 upscale 子工作流或 PyAV + 模型管线（具体以实现为准）。
- 实现前 **临时方案**：**Extract Frame** → 图片 **Upscale** → 多帧再 **Create Video**（ComfyUI 原生）→ **→ ComfyTV Video**。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_VIDEO` 入/出 | URL 快照 |

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### video
源 `COMFYTV_VIDEO`（实现后必填）。

### scale
**2x** 或 **4x**（实现后生效）。

## 输出说明（实现后）

| 输出 | 类型 | 含义 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 放大后的片段 |

## 新手一步一步（当前）

1. 了解本节点 **尚不可用**。
2. 需要放大时：用 **Extract Frame** + 图片 **Upscale** 做单帧；或关注 [roadmap.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md) 更新。
3. 勿依赖 Run 输出——会报错。

## 链接

| 资源 | 链接 |
|---|---|
| 路线图 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md |
| 视频与音频指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md |
| ComfyTV 仓库 | https://github.com/jtydhr88/ComfyTV |

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |
| [路线图](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md) | 已支持 vs 计划中的后端（Upscale 视频、Demucs 等） |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/upscale |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/upscale/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题 FAQ

**Q：为什么 Run 报错 StageNotImplemented？**  
A：故意占位，避免以前「假 URL」误导。等后端接入后再用。

**Q：现在怎么放大视频？**  
A：逐帧 **Extract Frame** + **Upscale**；或 ComfyUI 原生视频 upscale 插件 + **→ ComfyTV Video**。

**Q：scale 选 4x 会更慢吗？**  
A：实现后通常是的；当前参数无效果。

**Q：4x 和 2x 显存？**  
A：实现后取决于选用的逐帧 upscale 模型；当前参数无效。

**Q：能否先 Resize 再 Upscale？**  
A：实现后建议先生成 → Clip → Resize 到合理尺寸 → Upscale，以控制耗时。

## 相关节点

- **Upscale**（图片，✅ 可用）
- **Extract Frame** / **→ ComfyTV Video**
- **Video Resize**（几何缩放，✅ 可用）
