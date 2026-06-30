# 图像阶段 (Image Stage)

> 用本地或内置模型根据文字描述生成一张或多张图片，是 ComfyTV 里最常用的「从零创作」入口，也支持图生图 (i2i)。

## 这个节点是做什么的

**Image Stage** 负责**文生图 (t2i)** 和**图生图 (i2i)**。你写 **main_prompt**（画面描述），选 **workflow**（例如 Local SD1.5 或 Ideogram4），设置分辨率、比例和批量大小，点 **▶ 运行**，节点上会显示缩略图预览。

它有两个输出口：

- **images**（`COMFYTV_IMAGES`）：本次 Run 的**整批**图片 JSON。
- **image**（`COMFYTV_IMAGE`）：你在节点上**点选**的那一张（由 **selected_index** 决定，从 1 起计）。

**第一次成功运行**后，ComfyTV 通常会在下游**自动插入 Image Picker** 节点，方便从多张图里挑一张继续裁剪、放大或 Inpaint。

## 适用场景

- 从零用提示词生成概念图、产品图、角色设定图。
- 图生图：选 i2i workflow，把参考图接到 **images**，用提示词描述要改成什么样。
- 一次生成多张（batch_size 2–8），对比构图后选一张进编辑链。
- 把 Text Stage 的输出接到 **texts**，让 LLM 扩写后再生成画面。
- 为 Video Stage 的 I2V / FLF2V 准备关键帧（输出 `COMFYTV_IMAGE`）。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** 点 **▶ 运行**只跑 Image Stage 绑定的子 workflow，不 Queue 整张 ComfyUI 图。
- **快照**：生成图的 URL 写入当前项目；下游 Upscale、Crop 等再 Run 时读快照，不会自动重跑 Image Stage。
- **workflow 下拉框** 对应 [`workflows/image/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image) 里的 JSON；ComfyTV 把你的提示词、分辨率、宽高比、一次生成张数、随机种子等参数，传给子工作流里的采样、文本编码等节点。

i2i workflow 额外把 **images** 上游的第一张图绑到子图里的 `LoadImage`。

## 类型说明（COMFYTV_IMAGE vs ComfyUI IMAGE）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
| --- | --- | --- |
| `COMFYTV_IMAGE` | 单张图的项目快照（`/view?` URL） | **不是** ComfyUI 内存图像 |
| `COMFYTV_IMAGES` | 多图批量的 JSON `{images:[...]}` | **不是** ComfyUI 的 IMAGE batch |
| 原生 `IMAGE` | ComfyUI 内存图像（仅运行时在 GPU 里，不保存进项目） | SaveImage 预览用；不能直接接 ComfyTV stage |

**如何转换：**

- 原生 → ComfyTV：**ComfyTV/Bridge** → **→ ComfyTV Image**（Run 后存快照）
- ComfyTV → 原生：**← ComfyTV Image**（读快照变回 ComfyUI 内存图像，可接 ControlNet、IPAdapter 等）

详见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

**常见连线误区**：把 ComfyUI 的 `Load Image`（原生 IMAGE）直接接到 Image Stage 的 **images**——类型不匹配。应先用 **→ ComfyTV Image** Bridge，或改用 **Load Image from Asset**（输出 `COMFYTV_IMAGE`）。

## 界面与参数说明

### workflow

[`workflows/image/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image) 中的图像 backend。内置：

| 选项 | 模式 | 说明 |
| --- | --- | --- |
| **Local SD1.5** | t2i | 经典 SD1.5 文生图 |
| **Local SD1.5 I2I** | i2i | 同一 checkpoint，VAEEncode + denoise &lt; 1 |
| **Image Ideogram4 T2I** | t2i | Ideogram 4 + Qwen3-VL 文本编码器 |

模型文件见 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)。workflow 详情：[README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image/README.zh.md)。

### main_prompt（主提示词）

描述你想生成的画面。上游 **texts** 会追加到提示词后面（空格或换行拼接，视 stage 逻辑而定）。

**示例**：`a red apple on a wooden table, soft window light, photorealistic`

### resolution（分辨率档位）

短边像素档位：`480P`、`720P`、`1K`、`1080P`、`1440P`、`2K`、`2160P`、`4K` 等。与 **aspect_ratio** 一起算出实际宽高 `(w, h)` 传给 latent 节点。

### aspect_ratio（宽高比）

如 `1:1`、`16:9`、`9:16`、`4:3`。竖版海报选 `9:16`，横版视频封面选 `16:9`。

### batch_size（一次生成张数）

每次 Run 生成几张图（1–8）。采样器跑一轮出多张，便于对比构图。**image** 输出口由 **selected_index** 指定其中一张。

### texts（上游文本）

可接 Text Stage 的 **text** 或其它 `COMFYTV_TEXT`，作为额外 prompt 上下文。

### images（上游参考图）

**图生图必用**：选 **Local SD1.5 I2I**（或其它 i2i workflow），把参考图接到 **images.image0**（第一张生效）。t2i workflow 会忽略上游图。

可接：Image Stage 的 **image**、Image Picker、Asset Loader、Bridge → ComfyTV Image。

### selected_index（选中序号）

决定 **image** 单路输出对应 batch 中第几张（**从 1 开始**）。也可直接点击节点缩略图切换；点击后会出现编辑工具栏（✏️ Edit、🌐 Panorama 等）。

### 自定义参数（custom_params）（自定义参数）

侧栏可绑 seed、negative prompt、steps、CFG 等到子 workflow 节点。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
| --- | --- | --- | --- |
| **images** | `COMFYTV_IMAGES` | 本次全部生成图 | Image Picker、Compare Stage |
| **image** | `COMFYTV_IMAGE` | 当前选中的一张 | Video I2V、Upscale、Inpaint、Bridge ← ComfyTV Image |

## 新手一步一步

1. 放 **Project**，再 **Add Node → ComfyTV → Generate → Image Stage**。
2. **workflow** 选 **Local SD1.5**（首次建议用最轻量的 t2i）。
3. **main_prompt** 输入：`a red apple on a wooden table`。
4. **resolution** 保持 `1K`，**aspect_ratio** `1:1`，**batch_size** `1`。
5. 确认已下载 `v1-5-pruned-emaonly.safetensors`（见 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)）。
6. 点 **▶ 运行**，等待缩略图出现；首次运行可能自动出现 **Image Picker**。
7. 点击喜欢的缩略图 → 工具栏里选 **Upscale** 或 **Crop** 继续编辑。

**图生图额外步骤**：workflow 改 **Local SD1.5 I2I** → 上游 **Load Image from Asset** 或另一 Image Stage 的 **image** 接到 **images** → main_prompt 写「改成水彩风格」→ Run。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |
| [自定义工作流](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) | 导入自己的 ComfyUI JSON，不改 Python |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题

**Q：Run 没反应或 workflow 灰色？**  
A：检查模型是否下载完整；重启 ComfyUI 刷新 workflow 列表；看 ComfyUI 终端报错。

**Q：images 槽连不上原生 Load Image？**  
A：类型不对。用 Bridge **→ ComfyTV Image** 或 **Load Image from Asset**。

**Q：batch 有 4 张但下游只有一张？**  
A：用 **image** 口（单张）或 **Image Picker**；**images** 口是整批 JSON。

**Q：改了 prompt 但下游还用旧图？**  
A：快照机制——先 Re-run Image Stage，再 Run 下游。

## 相关节点

- **Image Picker**——从批量或多轮结果中选一张（首次 Run 常自动创建）。
- **Text Stage**——上游扩写提示词。
- **Video Stage (I2V / FLF2V)**——消费 **image** 作为视频条件。
- **Upscale / Inpaint / Outpaint Stage**——单图编辑链。
- **Bridge → / ← ComfyTV Image**——与原生 ComfyUI 互通。
- **Project**——项目上下文。
