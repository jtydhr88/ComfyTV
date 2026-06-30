# 加载视频

> 从 ComfyUI 的 `input/` 文件夹选取或上传本地视频，作为 ComfyTV 视频流程的**起点**——剪辑、抽帧、Demux 等都从这里接。

## 这个节点是做什么的

**加载视频**（Load Video）属于 ComfyTV **Input** 分类。它不跑 AI 模型，只把 `input/` 目录（或上传写入该目录）里的视频文件登记为项目**快照**，输出类型为 `COMFYTV_VIDEO`。

节点主体会显示所选片段的预览。下游如 **Video Clip**（裁剪时间段）、**Extract Frame**（抽帧）、**Demux**（分离音轨）等 stage 都读取这份快照继续处理。

与 **从资产加载视频** 的区别：本节点面向**磁盘上的原始文件**；资产节点浏览的是当前项目里 stage 运行或侧栏导入产生的媒体库条目。

## 适用场景

- 已有 MP4/WebM/MOV 等素材，要在 ComfyUI 里做 ComfyTV 式分步编辑。
- 外部剪辑软件导出的成片，放入 `input/` 后在此选取。
- 将已有视频作为 ComfyTV **编辑工具链**（Clip、Crop、Demux 等）或 **IA2V**（图+音生视频）的源素材——不是用来给图生视频（I2V）流程提供起始图的（那类流程通常从图片出发）。
- 需要把ComfyUI 原生内存视频 转入 ComfyTV 时，可配合 Bridge（见类型说明）。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage 与运行按钮**：**无 ▶ 运行**。下拉选取或上传后输出立刻更新，不触发整张工作流 Queue。
- **快照**：选定后 URL 写入当前项目。下游 Run 用快照；换源文件需在本节点重新选择。
- **无 workflow**：纯文件登记，不涉及 `workflows/video/` 里的生成后端。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_VIDEO` | 视频文件的 URL 快照 | 不是内存里的 `VIDEO` 对象 |
| `COMFYTV_AUDIO` | 音频快照 | 需 Bridge 与原生 `AUDIO` 互通 |
| `COMFYTV_IMAGE` | 单图快照 | 抽帧后可经 Bridge 或编辑 stage 使用 |

**如何转换：**

- 原生 → ComfyTV：`→ ComfyTV Video`（Run 后存快照）
- ComfyTV → 原生：`← ComfyTV Video`

详见：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### video（视频文件）

- **是什么**：`input/` 中视频文件的下拉列表 + **上传**控件。
- **填什么**：选择已有文件或上传新视频（写入 `input/`）。
- **对结果的影响**：决定整条下游链的源片段；格式需为 ComfyUI 可识别的常见容器（MP4 等）。
- **常见误区**：在资产侧栏里找刚跑 **Video Stage** 生成的结果——应使用 **从资产加载视频**。

### 项目 id（project_id） / 父输出来源 id（内部）

- 隐藏字段，由 Project 与连线自动维护。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | 所选视频快照 | Video Clip、Video Crop、Extract Frame、Demux、Video Upscale、Compare（需先抽帧为图）等 |

## 新手一步一步

1. **Add Node → ComfyTV → Input → Load Video**。
2. 添加 **Project** 节点并命名（推荐）。
3. 将视频文件放入 ComfyUI 的 **`input/`** 文件夹，或在本节点上传。
4. 在下拉框选中文件，确认节点内预览正常——**无需 Run**。
5. 将 **video** 连到例如 **Video Clip**，设定起止时间。
6. 在下游点 **▶ 运行** 完成剪辑或其它处理。

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

**Q：加载视频 vs 从资产加载视频？**  
A：本节点 = 原始 **`input/`** 文件。资产节点 = 生成/导入后的**项目库**。

**Q：下游类型不匹配？**  
A：接口须期望 `COMFYTV_VIDEO`。原生 `VIDEO` 需 **→ ComfyTV Video** Bridge。

**Q：和 Video Stage（AI 生成）比？**  
A：本节点只**加载已有文件**——不做文/图生视频。要生成片段请用 **Generate → Video Stage**。

**Q：上传后下拉列表没有？**  
A：刷新页面；确认扩展名被识别为视频格式。

## 相关节点

- **从资产加载视频** —— 项目资产库选取。
- **加载音频** —— 纯音频 Input。
- **Video Clip** / **Extract Frame** —— 常见下游第一步。
- **→ ComfyTV Video**（Bridge）—— ComfyUI 内存视频 入 ComfyTV。
