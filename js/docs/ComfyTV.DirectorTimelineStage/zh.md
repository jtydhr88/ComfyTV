# 导演时间线

> 在可视化时间线上排列图片片段与可选音轨，输出结构化 `COMFYTV_TIMELINE`——多镜短视频的「剪辑表」编辑器。

## 这个节点是做什么的

**导演时间线**（Director Timeline）是 **Compose** 分类中的**浏览器端**编排 stage。节点主体是一个 Vue 时间线面板：你可以设定帧率、拖拽片段长度、把上游图片放到各时间段，并可铺一条 **audio** 音轨。

它不生成最终 MP4，而是输出 **`COMFYTV_TIMELINE` JSON**（含 `frameRate`、`durationFrames`、`segments[]`、`audioSegments[]` 等），供下游 **Timeline Render**（时间线渲染）编码成视频。

适合把 **Shot Images** 分镜图、**Image Picker** 选定帧、或 **Load Image** 素材排成连续序列。

## 适用场景

- 分镜图集出图后，按镜号与时长排成预览片时间线。
- 给静态概念图加 BGM（**audio** 口接 Speech/Music Stage 或 Load Audio）。
- 在 Render 前微调每段 in/out 帧，而不重跑图像生成。
- 多镜叙事：每 segment 可绑不同 upstream 图片槽（**images** autogrow 最多 24）。

## 工作原理（为什么 ComfyTV 这样设计）

- **无 ▶ 运行**：面板内编辑**实时**写入隐藏字段 `timeline_data`；属于 instant Compose stage，类似 Crop 的即时预览哲学。
- **快照**：虽然无 Run，时间线 JSON 仍随项目保存；**Timeline Render** Run 时读取当前 timeline 快照。
- **images 口**：autogrow 提供最多 24 个 `COMFYTV_IMAGE` 槽，拖到时间线段上引用；不是自动铺满，需你在 UI 里放置。
- **COMFYTV_TIMELINE**：专用类型，普通 ComfyUI 节点无法直接消费；只有 **Timeline Render** 等 ComfyTV stage 读取。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_TIMELINE` | 时间线 JSON 快照 | 无原生对应；仅 ComfyTV 编排链 |
| `COMFYTV_IMAGE` | 单图 | 接到 **images** 槽，拖入 segment |
| `COMFYTV_AUDIO` | 音频 | 可选 **audio** 口 |
| `COMFYTV_VIDEO` | 视频 | Render 后产出，非本节点输出 |

Bridge 用于 image/audio 进入 ComfyTV：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### 时间线面板（节点主体）

- **是什么**：轨道式 UI，设置 **frame_rate**（默认 24 fps）、片段起止帧、总时长。
- **怎么用**：从 **images** 提供的素材池拖到 segment；调整长度与顺序。
- **影响**：决定 Render 时的剪辑结构；无文本 prompt，纯时序+素材。

### timeline_data / frame_rate（隐藏）

- 由 Vue 面板序列化；一般不在 socket 上手动改。

### images（autogrow，最多 24 槽）

- **是什么**：上游 `COMFYTV_IMAGE` 连线集合。
- **填什么**：Shot Images **images**、多个 Picker 输出、Loader 等。
- **影响**：仅提供「可拖素材池」；未拖到时间线上的槽不参与输出 timeline。

### audio（可选）

- **是什么**：单条 `COMFYTV_AUDIO`。
- **填什么**：Music Stage、Load Audio、Asset Audio Loader 等。
- **影响**：写入 `audioSegments`，Render 时混音（视 workflow 能力）。

### workflow / 自定义参数（custom_params）

- 本节点**无** workflow 下拉；生成视频在 **Timeline Render**。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **timeline** | `COMFYTV_TIMELINE` | 完整时间线 JSON 快照 | **Timeline Render → timeline** |

## 新手一步一步

1. 准备素材：Run **Shot Images** 或 **Image Stage** + Picker，得到多张 `COMFYTV_IMAGE`。
2. 添加 **Director Timeline**，将素材连到 **images**（可多线 autogrow）。
3. （可选）BGM 连到 **audio**。
4. 在节点面板设置 **fps**，拖拽图片到各时间段，调整 segment 长度。
5. 添加 **Timeline Render**，**timeline** 口接上一步。
6. 在 Timeline Render 选 workflow，**▶ 运行** 导出 `COMFYTV_VIDEO`。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：接了 images 但时间线空白？**  
A：在面板里**拖到 segment 上**——连线只填充素材池。

**Q：与 Timeline Render 有何区别？**  
A：Director Timeline **编辑** JSON；Timeline Render **编码**视频。编排 vs 导出。

**Q：没有 ▶ 运行？**  
A：正常——timeline_data 在浏览器内即时保存。

**Q：能否直接把 Video Loader 接到时间线？**  
A：segment 期望**图片序列**——先用 Extract Frame 或视频工具链。

**Q：Load 与 generate 的区别？**  
A：Loader 提供素材；Timeline Render **生成**最终视频文件。本节点仅**编排**。

## 相关节点

- **Timeline Render** —— 消费 timeline，输出 video。
- **Shot Images** —— 常见 images 来源。
- **Image Picker** —— 单帧挑选后入 timeline。
- **Load Audio** / **Music Stage** —— audio 来源。
- **Compare** —— 单帧 A/B，非时间线工具。
