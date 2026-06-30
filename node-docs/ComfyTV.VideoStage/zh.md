# 视频阶段 (Video Stage)

> 根据文字、图片、音视频条件生成短视频片段，内置 LTX 2.3 的四种模式（T2V / I2V / FLF2V / IA2V）。

## 这个节点是做什么的

**Video Stage** 把提示词和可选的参考素材变成一段 MP4 预览。选好 **workflow**、分辨率、比例和时长，点 **▶ 运行**，节点上播放生成的片段。

输出是 **`COMFYTV_VIDEO`**——项目里的视频快照 URL，不是 ComfyUI 内存视频。可接到 Video Crop、Video Upscale、Timeline 等下游 stage，或通过 Bridge 转给原生节点。

根据 workflow 不同，你可能只需要文字（T2V），或需要接图片、首尾帧、音轨（I2V / FLF2V / IA2V）。

## 适用场景

- 纯文字描述生成动态场景（**Local LTX 2.3 T2V**）。
- 用一张概念图让它「动起来」（**I2V**）。
- 指定起始帧和结束帧，生成中间过渡（**FLF2V**）。
- 用配音或 BGM 驱动口型/节奏（**IA2V**，需 **audio** 输入）。
- Image Stage 出图 → Video Stage I2V，快速验证动态效果。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** 只跑 [`workflows/video/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/video) 里绑定的子图，不 Queue 整图。
- **快照**：视频 URL 写入项目；下游 Clip / Resize 读快照，不重跑 Video Stage。
- ComfyTV 根据 **resolution + aspect_ratio + duration_s** 推算帧数（LTX 用 divisor=8 等规则），映射到 latent 和 `SaveVideo` / `VHS_VideoCombine`。

**generate_audio** 开关控制子 workflow 是否同时合成音轨（与 IA2V「用外部 audio 驱动画面」是不同概念）。

## 类型说明（COMFYTV_VIDEO vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
| --- | --- | --- |
| `COMFYTV_VIDEO` | 视频片段的项目快照 URL | 不是内存 VIDEO / LATENT 链 |
| 原生视频节点输出 | 内存数据或临时文件 | 需 Bridge 才能接 ComfyTV stage |

**如何转换：**

- 原生 → ComfyTV：**→ ComfyTV Video**（Run 存快照）
- ComfyTV → 原生：**← ComfyTV Video**

详见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## 界面与参数说明

### workflow — 四种 LTX 2.3 变体（何时用哪个）

选项来自 [`workflows/video/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/video)。当前四套共用 LTX-Video 2.3 22B（fp8 + Gemma 3 文本编码器 + Lightning LoRA + 2× 空间上采样）：

| Workflow | 模式 | 何时使用 | 必填上游 |
| --- | --- | --- | --- |
| **Local LTX 2.3 T2V** | 文生视频 | 只有文字描述，没有参考图 | 无（仅 prompt） |
| **Local LTX 2.3 I2V** | 图生视频 | 用**一张**静态图作为第一帧/外观参考 | **images** 接 1 张 `COMFYTV_IMAGE` |
| **Local LTX 2.3 FLF2V** | 首末帧生视频 | 控制**起点和终点**画面，生成中间运动 | **images** 接 **2 张**（起始 + 结束关键帧） |
| **Local LTX 2.3 IA2V** | 图 + 音频生视频 | 口型、节奏跟随**已有音轨** | **images** 1 张 + **audio** 必填 |

**选型建议：**

- 头脑风暴动态镜头 → **T2V**。
- 已有分镜静帧 → **I2V**。
- 知道开场和收场画面 → **FLF2V**（接 Image Stage 两次或 Compare 两帧）。
- 已有 Speech / Music Stage 的配音 → **IA2V**，audio 接 **Music Stage** 或 **Speech Stage** 输出。

模型清单：[models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)。  
Workflow 说明：[workflows/video/README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/video/README.zh.md)。

### main_prompt（主提示词）

描述场景、镜头运动、氛围。上游 **texts** 会追加。I2V 仍可写运动描述（如 `camera slowly pans left, hair blowing in wind`）。

### resolution / aspect_ratio

视频短边档位（默认 **720P**）与比例（默认 **16:9**）。竖屏短视频选 `9:16`。

### duration_s（时长）

目标片段秒数，范围 **4–15** 秒（默认 5）。workflow 据此推算 fps 与帧数。

### generate_audio（生成音轨）

是否在**视频 workflow 内部**合成配套音频。T2V/I2V/FLF2V 可选；**IA2V 用外部 audio 驱动**，通常关闭此项，改接 **audio** 输入。

### texts / images / videos

- **texts**：上游 Text 或 Storyboard 文本上下文。
- **images**：I2V 1 张；FLF2V 2 张（顺序：起始 → 结束）。
- **videos**：部分 workflow 可作风格/运动参考（当前 LTX 内置以图为主）。

### audio（上游音频）

**IA2V 必填**。接 Speech Stage、Music Stage 或 Load Audio from Asset 的 `COMFYTV_AUDIO`。其它 LTX workflow 不需要。

### 自定义参数（custom_params）

侧栏可绑 seed、negative prompt 等。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
| --- | --- | --- | --- |
| **video** | `COMFYTV_VIDEO` | 生成的视频片段快照 | Video Crop / Upscale / Clip / Timeline；Bridge ← ComfyTV Video |

## 新手一步一步

1. 放 **Project** + **Image Stage**，生成一张 `16:9` 概念图（或跳过此步做纯 T2V）。
2. **Add Node → ComfyTV → Generate → Video Stage**。
3. 有参考图：**workflow** → **Local LTX 2.3 I2V**，Image **image** → Video **images**；纯文字则选 **T2V**。
4. **main_prompt**：`slow cinematic zoom on the subject, soft fog`。
5. **duration_s** 设 `5`，确认 LTX 2.3 模型已下载（见 models 文档）。
6. 点 **▶ 运行**，在节点预览播放结果。
7. 需要剪辑：接 **Video Crop Stage** 或 **Director Timeline Stage**。

**FLF2V 示例**：两张 Image Stage 输出分别接到 **images.image0** 和 **images.image1** → workflow **FLF2V** → Run。

**IA2V 示例**：Speech Stage **audio** → Video **audio**，一张人物图 → **images** → workflow **IA2V** → Run。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/video |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/video/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题

**Q：I2V Run 了但画面和参考图无关？**  
A：确认 **images** 已连接且 workflow 是 **I2V** 不是 T2V；检查 preset 里 LoadImage 绑定。

**Q：FLF2V 只接了一张图？**  
A：必须 **两张**——起始帧和结束帧，顺序不要反。

**Q：IA2V 报错或无声画不同步？**  
A：**audio** 必填；音频时长与 **duration_s** 尽量接近；用 Speech/Music Stage 输出而非原生 AUDIO。

**Q：视频类型连不上原生节点？**  
A：用 **← ComfyTV Video** Bridge 转成 ComfyUI 内存格式。

## 相关节点

- **Image Stage**——为 I2V / FLF2V 提供关键帧。
- **Speech Stage / Music Stage (Audio Stage)**——IA2V 的 **audio** 来源。
- **Video Crop / Upscale / Clip Stage**——后期处理。
- **Director Timeline Stage**——多段拼接。
- **Bridge → / ← ComfyTV Video**——原生互通。
- **Project**——项目上下文。
