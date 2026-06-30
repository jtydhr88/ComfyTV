# 字幕擦除 · 区域 (Subtitle Erase · Region)

> **路线图 / 待支持** —— 在你框选的矩形区域内逐帧去字幕；需区域框选 UI，当前 Run 抛出 `StageNotImplemented`。

## 这个节点是做什么的（设计意图）

**Subtitle Erase (Region)** 让你 **指定一块固定矩形**（**region_x/y/w/h**），在该区域内 inpaint 去掉字幕或水印。比 Smart 版更可控，适合字幕位置不规则、或只想去画面某一角的 logo。

参数 **region_*** 由节点内 Vue 画框 UI 写入（节点 socket 上隐藏）。路线图还要求 **按帧** 微调区域的能力。

> ⚠️ **当前状态**：无后端、无完整框选 UI。Run → `StageNotImplemented`。见 [roadmap.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md)。

## 适用场景（实现后）

- 字幕位置不固定但仍在窄条区域内
- 去 corner logo 而保留画面主体
- Smart 误检时的手动 fallback

## 工作原理（规划）

- **Stage** + 快照；`COMFYTV_VIDEO` 入/出。
- region 坐标像素级，相对每帧左上角（与 **Video Crop** 坐标系类似）。
- **临时方案**：**Video Crop** 直接切掉含字幕条带的区域。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_VIDEO` | URL 快照 |

## 界面与参数说明

### video
源视频（实现后）。

### region_x / region_y / region_w / region_h（隐藏）
框选矩形，由面板 UI 驱动。默认 0。

## 输出说明（实现后）

| 输出 | 类型 |
|---|---|
| **video** | `COMFYTV_VIDEO` |

## 新手一步一步（当前）

1. 节点 **不可用**；勿期待 Run 成功。
2. 可先用 **Video Crop** 裁掉字幕带。
3. 关注 roadmap 中「框选式区域选择 UI」条目。

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

**Q：和 Smart 怎么选？**  
A：固定底栏 + 要自动化 → Smart（待支持）；只去一块已知区域 → Region。

**Q：region 和 Video Crop 一样吗？**  
A：Crop 真裁掉像素；Region 计划 inpaint 保留构图。

**Q：框选 UI 在哪？**  
A：尚未完成；参数隐藏占位。

**Q：Region 框会随分辨率变吗？**  
A：实现后计划支持按帧 UI；当前 region 参数仅为占位。

**Q：和 Smart 版能否串联？**  
A：实现后通常二选一；Smart 失败再 Region 手修。

**Q：烧录 ASS 彩色字幕？**  
A：仍属硬字幕像素；Smart 版实现后视模型能力；复杂样式可能需 Region。

## 相关节点

- **Subtitle Erase (Smart)**（待支持）
- **Video Crop**（✅）
