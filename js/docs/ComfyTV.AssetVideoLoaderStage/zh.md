# 从资产库加载视频

> 从 ComfyTV **项目资产库**选取视频片段，作为剪辑、Demux、再生成等下游步骤的输入——专用于复用本项目内的媒体成果。

## 这个节点是做什么的

**从资产加载视频**（Load Video from Asset）在节点主体内提供与图片资产节点相同的**浏览体验**：分类、搜索、缩略图/预览。选中后立即输出 `COMFYTV_VIDEO` 快照。

库内视频来自 **Video Stage** 运行、时间线渲染、侧栏导入等。每条资产绑定当前 **Project**，与 ComfyUI 全局 `input/` 目录无关。

若你手上有磁盘上的 MP4 且从未进入 ComfyTV 项目，请用 **加载视频**（`input/`）而非本节点。

## 适用场景

- **Timeline Render** 或 **Video Stage** 产出后，另开分支继续 Upscale / Clip。
- 从资产库挑选历史版本对比（可配合 **Compare**，需先 Extract Frame）。
- 悬停菜单 **加载为资产节点** 快速插入预填节点。
- 多镜头项目：Director Timeline 编排前，从库中拖素材到时间线（也可直接连 **images** 口，视频类资产需先 Demux 或 Extract Frame 视 workflow 而定）。

## 工作原理（为什么 ComfyTV 这样设计）

- **无 ▶ 运行**：点击资产即输出，instant Input stage。
- **快照**：下游读 URL；不自动重跑产生该视频的上游 stage。
- **资产库 vs input/**：见 **从资产加载图片** 说明；视频同理，按项目隔离。
- **无 workflow**：不调用 `workflows/video/` 生成后端。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_VIDEO` | 视频 URL 快照 | 不是 ComfyUI 内存视频 |
| `COMFYTV_IMAGE` | 单帧图 | Extract Frame 后可 Compare |
| 原生 `VIDEO` | ComfyUI 内存视频 | **→ ComfyTV Video** Bridge |

转换说明：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### 资产选取器

- 分类标签、搜索、可点击的条目列表/缩略图。
- 空库 → 先 Run **Video Stage** 或侧栏导入。

### asset_url / asset_id / category（隐藏）

- 由 UI 维护；`asset_url` 即输出的数据地址。
- `category` 记住上次筛选。

### 项目 id（project_id） / 父输出来源 id

- 隐藏；与 Project 绑定。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | 所选视频快照 | Video Clip、Crop、Upscale、Demux、Extract Frame 等 |

## 新手一步一步

1. 配置 **Project** 节点。
2. 运行 **Video Stage** 或导入视频到资产库。
3. 添加 **从资产加载视频** 节点。
4. 浏览并**点击**目标视频。
5. 连接 **Video Clip** 或其它 Video 分类 stage。
6. 在下游 **▶ 运行**。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：和加载视频（input/）比？**  
A：**input/** = 外部原始文件。**资产库** = 项目内生成/导入。用 Video Stage 生成；用本节点复用。

**Q：刚 Run 的视频找不到？**  
A：是否同一 **Project**？Run 完成后刷新节点。

**Q：类型报错？**  
A：下游需要 `COMFYTV_VIDEO`；ComfyUI 内存里的数据 需 Bridge。

**Q：能替代 Video Stage 吗？**  
A：不能——本节点只**选取**，不**生成**视频。

## 相关节点

- **加载视频** —— `input/` 文件。
- **Video Stage** —— 写入新视频到库。
- **Timeline Render** —— 时间线导出视频进库。
- **从资产加载图片** / **从资产加载音频** —— 姊妹 Input 节点。
