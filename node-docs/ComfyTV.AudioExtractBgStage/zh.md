# 仅伴奏 (Audio · Background Only)

> **路线图 / 待支持** —— 设计为用 Demucs 分离 **伴奏 / 环境音**；与 **Vocals Only** 配对，workflow 目录 `audio-bg/` 预留。

## 这个节点是做什么的（设计意图）

**Audio · Background Only** 从同一源视频分离 **非人声 stem**（伴奏、环境声），输出 `COMFYTV_AUDIO`。MV  remix、保留 BGM 换人声、或 IA2V 只要节奏轨等场景。

> ⚠️ **当前状态**：与 Vocals Only 相同——workflow 槽位在，[`workflows/audio-bg/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio-bg) 尚无内置 JSON，Demucs 后端待接。见 [roadmap.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md)。

## 适用场景（实现后）

- 保留 BGM 重新生成画面（IA2V）
- 伴奏轨进 **Audio Stage** 做风格化
- 与 **Vocals Only** 同时分叉同一源片

## 工作原理（规划）

- **Stage** + **workflow** + **▶ 运行**。
- `kind='audio-bg'`，upstream video，无 prompt。
- Demucs `AudioStemSeparate`（计划）。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_VIDEO` | 输入 |
| `COMFYTV_AUDIO` | 伴奏输出 |

## 界面与参数说明

### workflow
[`workflows/audio-bg/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio-bg)

### video
源 `COMFYTV_VIDEO`。

## 输出说明（实现后）

| 输出 | 类型 |
|---|---|
| **audio** | `COMFYTV_AUDIO` |

## 新手一步一步（当前）

1. **不可用**；用 **Demux · Audio Track** 取完整音轨代替。
2. 关注 roadmap Demucs 条目。

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

**Q：能和 Vocals Only 同时跑吗？**  
A：实现后通常各 Run 一次同一源；或单 workflow 出多 stem（以实现为准）。

**Q：分离质量取决于什么？**  
A：Demucs 模型与源片混音复杂度。

**Q：现在能 remix 吗？**  
A：仅 Demux 整轨；AI 分轨待支持。

## 与 Vocals Only 配对（实现后）

同一源 **COMFYTV_VIDEO** 可分叉：

```
[Video] ──→ [Vocals Only]     ──→ 人声 COMFYTV_AUDIO
       └──→ [Background Only] ──→ 伴奏 COMFYTV_AUDIO
```

两路可分别接 **Audio Stage** 或 **Video Stage IA2V**（伴奏驱动画面）。

## 相关节点

- **Audio · Vocals Only**（待支持）
- **Demux · Audio Track**（✅）
- **Audio Stage**
