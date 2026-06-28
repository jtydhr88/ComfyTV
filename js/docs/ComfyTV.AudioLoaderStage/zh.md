# 加载音频

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

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_AUDIO` | 音频文件 URL 快照 | 不是 ComfyUI 内存音频 |
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

### 项目 id（project_id） / 父输出来源 id（内部）

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

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：加载 vs 生成（Speech/Music Stage）？**  
A：**加载音频** = 已有文件，无 GPU 推理。**Speech/Music** = AI 创作，需 workflow + Run。Loader **导入**；生成器 **创造**。

**Q：加载音频 vs 从资产加载音频？**  
A：本节点 = **`input/` 磁盘**。资产节点 = 生成/导入后的**项目库**。

**Q：类型不匹配？**  
A：下游须期望 `COMFYTV_AUDIO`；原生 `AUDIO` 需 **→ ComfyTV Audio** Bridge。

**Q：没有 Run 按钮？**  
A：正常——与加载图片/视频相同。

## 相关节点

- **从资产加载音频** —— 资产库选取。
- **Speech Stage** / **Music Stage** —— AI 生成音频。
- **AudioVideoDemuxAudioStage** —— 从视频分离音轨。
- **Director Timeline** —— 编排音轨。
- **→ ComfyTV Audio**（Bridge）。
