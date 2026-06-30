# 字幕擦除 · 智能 (Subtitle Erase · Smart)

> **路线图 / 待支持** —— 设计为自动检测并去除内嵌硬字幕；当前 Run 抛出 `StageNotImplemented`。

## 这个节点是做什么的（设计意图）

**Subtitle Erase (Smart)** 应对 **硬字幕**（烧录在画面里的文字）：AI 逐帧检测字幕区域并 inpaint 填背景，输出无字幕的 `COMFYTV_VIDEO`。无需手动画框，适合字幕位置固定的番剧切片、采访素材。

> ⚠️ **当前状态**：占位节点，无真实检测/修复后端。Run → `StageNotImplemented`。Region 版需框选 UI，亦未实现。见 [roadmap.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md)。

## 适用场景（实现后）

- 去硬字幕再二次剪辑或 I2V
- 自动化批处理带字幕的 stock  footage
- Smart 搞不定时 fallback 到 **Subtitle Erase (Region)**

## 工作原理（规划）

- **Stage** + 快照；输入 `COMFYTV_VIDEO`。
- 预期接 OCR/检测 + 视频 inpaint 模型或专用 workflow。
- **临时方案**：**Video Crop** 裁掉底栏（若字幕仅在底部）；或外部工具处理后 **→ ComfyTV Video**。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_VIDEO` | 入/出均为 URL 快照 |

## 界面与参数说明

### video
源视频（实现后必填）。当前仅连线占位。

## 输出说明（实现后）

| 输出 | 类型 | 含义 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | 去字幕后的片段 |

## 新手一步一步（当前）

1. 知悉 **不可用**。
2. 字幕仅在底部时可试 **Video Crop**。
3. 关注 roadmap 更新。

## 链接

| 资源 | 链接 |
|---|---|
| 路线图 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md |
| 视频与音频指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md |

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
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题 FAQ

**Q：和 Region 版区别？**  
A：Smart 自动检测；Region 手动画矩形（也需按帧 UI，待支持）。

**Q：软字幕（mkv 轨道）能删吗？**  
A：那是容器轨道，用 **Demux** 或 ffmpeg 删轨，不是本节点范畴。

**Q：Run 报错正常吗？**  
A：是，尚未实现。

## 路线图状态（必读）

本节点在 [roadmap.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md) ⏳ **待支持** 清单中，与 **Video Upscale**、**Demucs 人声/伴奏分离** 同级。UI 已占位是为让工作流设计者可预先拖线；**请勿在生产流程依赖 Run 结果**。

预期能力（实现后）：OCR/检测字幕带 → 逐帧 inpaint → 无字幕 `COMFYTV_VIDEO`；Region 版补充手动框。

**Q：自动检测支持多语言字幕吗？**  
A：实现后取决于所选 OCR/检测模型；中文硬字幕通常需专用模型或 Region 手框。

**Q：占位节点为何还在面板里？**  
A：方便预先规划工作流；Run 失败是预期行为，见路线图 ⏳ 标记。

## 相关节点

- **Subtitle Erase (Region)** —— 手动区域版（待支持）
- **Video Crop** —— 几何裁切（✅）
- **→ ComfyTV Video**
- **Video Upscale**（待支持）
