> 从 ComfyUI 的 `input/` 文件夹选取或上传本地音频，作为 ComfyTV 音频流程的**起点**——配音、混音、接视频 IA2V 等都从这里接。

## 这个节点是做什么的

**加载音频**（Load Audio）是 **Input** 分类下的即时 stage。它读取 ComfyUI **`input/`** 目录（或上传写入该目录）里的音频文件，登记为项目快照，输出 `COMFYTV_AUDIO`。

适用于 BGM、旁白 wav、从视频分离出的音轨等**已有文件**。节点选取后即有输出，不调用 Speech Stage 或 Music Stage 的生成 workflow。

与 **从资产加载音频** 相对：本节点面向磁盘原始文件；资产节点用于挑选项目内生成或导入的音频条目。

## 适用场景

- 导入外部录制的旁白、配乐 FLAC/WAV/MP3。
- 将 `input/` 里的参考音频接到 **Speech Stage** 的声音克隆输入（reference_audio）。
- 作为 **Video Stage** 的 **audio** 输入（Image+Audio to Video 流程）。
- 接到 **Director Timeline** 的时间线音轨（可选 audio 口）。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage 与运行按钮**：**无 ▶ 运行**；选文件或上传即输出。
- **快照**：下游 stage Run 时读取当前选定文件的 URL 快照，不会自动重读本节点。
- **无 workflow**：不涉及 `workflows/audio/` 或 `workflows/speech/` 的生成后端。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_AUDIO` | 音频文件 URL 快照 | 不是内存 `AUDIO` tensor |
| `COMFYTV_VIDEO` | 视频快照 | Demux 后可分离音轨再用本节点或资产加载 |
| `COMFYTV_TEXT` | 文本快照 | Speech Stage 的台词输出，与本节点不同 |

**如何转换：**

- 原生 → ComfyTV：`→ ComfyTV Audio`
- ComfyTV → 原生：`← ComfyTV Audio`

详见：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### audio（音频文件）

- **是什么**：`input/` 内音频类型文件的下拉 + **上传**。
- **填什么**：列表选取或上传新文件。
- **对结果的影响**：决定下游听到的源音频；格式需 ComfyUI 识别（WAV、MP3、FLAC 等）。
- **常见误区**：把 **Music Stage / Speech Stage 跑出来的结果** 在这里找——应使用 **从资产加载音频** 或直接从生成节点连线。

### project_id / parent_output_id（内部）

- 隐藏；Project 与画布自动维护。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **audio** | `COMFYTV_AUDIO` | 所选音频快照 | Video Stage（audio）、Director Timeline（audio）、Speech Stage（reference_audio）、Audio Extract 等 |

## 新手一步一步

1. **Add Node → ComfyTV → Input → Load Audio**。
2. （推荐）连接 **Project** 节点。
3. 音频放入 **`input/`** 或本节点上传。
4. 下拉选中，确认波形/播放器预览（若有）——**无需 Run**。
5. 将 **audio** 连到目标，例如 **Video Stage** 的 audio 口。
6. 在下游生成节点点 **▶ 运行**。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**。完整操作流程、多节点串联、类型转换与原理，请阅读上游官方仓库 [**jtydhr88/ComfyTV**](https://github.com/jtydhr88/ComfyTV) 的用户指南（文档链接均指向上游 `main`，而非本地 fork）：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |

## 上游仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **官方仓库（上游）** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：节点帮助和完整教程有什么区别？**  
A：本页只介绍**这一个节点**的参数与连线。端到端流程、多节点串联和原理说明见上方 **「完整教程（推荐阅读）」** 中的 upstream 用户指南。

**Q：链接为什么指向 jtydhr88/ComfyTV，而不是我的 fork？**  
A：官方文档与用户指南维护在[上游仓库](https://github.com/jtydhr88/ComfyTV)的 `main` 分支；本地 clone/fork 用于开发与贡献，节点帮助内的链接统一指向上游，避免 fork 与官方文档不一致。

**Q：`COMFYTV_*` 类型和 ComfyUI 原生类型连不上怎么办？**  
A：ComfyTV stage 传递的是项目内 **URL 快照**（如 `COMFYTV_IMAGE`），不是 GPU 里的 `IMAGE` tensor。请使用 **ComfyTV/Bridge** 下的入桥（→）或出桥（←）转换。完整说明见 [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) 教程。

## 相关节点

- **从资产加载音频** —— 资产库选取。
- **Speech Stage** / **Music Stage** —— AI 生成音频。
- **AudioVideoDemuxAudioStage** —— 从视频分离音轨。
- **Director Timeline** —— 编排音轨。
- **→ ComfyTV Audio**（Bridge）。
