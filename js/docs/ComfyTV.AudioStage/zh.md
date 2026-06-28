# 音乐阶段 (Music Stage)

> 根据风格标签和可选歌词生成音乐或歌曲（器乐 / 人声），与 Speech Stage 的「念台词」完全不同。

## 这个节点是做什么的

画布上显示为 **Music Stage**（节点 id：`ComfyTV.AudioStage`）。你在 **main_prompt** 里写流派、情绪、乐器、BPM 等 **tags**，可选填 **lyrics** 歌词，设置时长，点 **▶ 运行**，得到一段 **`COMFYTV_AUDIO`** 音乐快照。

内置 workflow **ACE-Step v1 Song** 走 ACE-Step 3.5B：**lyrics 留空 = 纯器乐**；填写歌词 = 带人声演唱。

这不是 TTS（文字转语音）。要念旁白、对白请用 **Speech Stage**。

## 适用场景

- 生成背景音乐、Lo-fi、电子、爵士等器乐（lyrics 留空）。
- 写歌词 + tags，生成带人声的 demo 歌曲。
- 为 Video Stage **IA2V** 准备驱动音轨（接 **audio** 输入）。
- 为 Timeline 或 Audio Extract 链提供原始音轨。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** 只跑 [`workflows/audio/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio) 子 workflow，不 Queue 整图。
- **快照**：音频 URL（如 FLAC）写入项目；下游 Demux、Extract 读快照。
- ComfyTV 把 tags → ACE-Step `TextEncodeAceStepAudio.tags`，lyrics → `.lyrics`，duration → `EmptyAceStepLatentAudio.seconds`。

ComfyUI **原生没有「念稿」TTS**；Stable Audio / ACE-Step 类节点做的是**音乐生成**，因此 ComfyTV 把「音乐」和「语音」拆成两个 stage。

## 类型说明（COMFYTV_AUDIO vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
| --- | --- | --- |
| `COMFYTV_AUDIO` | 音频片段的项目快照 URL | 不是 ComfyUI 内存音频 |
| 原生 AUDIO | 内存里的音频数据 | 需 Bridge 才能接 ComfyTV stage |

**如何转换：**

- 原生 → ComfyTV：**→ ComfyTV Audio**
- ComfyTV → 原生：**← ComfyTV Audio**

详见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## Music Stage vs Speech Stage（必读）

| 对比项 | **Music Stage**（本节点） | **Speech Stage** |
| --- | --- | --- |
| 用途 | 歌曲 / 器乐 / 音效 | 旁白、对白、配音（TTS） |
| main_prompt | 风格 tags（流派、BPM、乐器） | 要**朗读的完整台词** |
| lyrics | 可选演唱歌词 | 无（用 reference_text 给克隆引擎） |
| 典型 workflow | ACE-Step v1 Song | Kokoro TTS 等 |
| 输出听感 | 有旋律、伴奏 | 人声朗读，无编曲 |

## 界面与参数说明

### workflow

[`workflows/audio/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio) 中的 backend。内置：

- **ACE-Step v1 Song**（`ace-step-v1-song.json`）— tags + 可选 lyrics + 时长。

说明：[workflows/audio/README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/audio/README.zh.md)。  
模型：`ace_step_v1_3.5b.safetensors` → `models/checkpoints/`（见 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)）。

### main_prompt（风格 tags）

自由关键词，描述流派、情绪、乐器、速度。

**示例**：`lo-fi, jazz piano, rainy night, 90bpm, soft female vocals`

**误区**：把整段旁白写在这里——那是 Speech Stage 的用法；Music Stage 的 prompt 是**音乐描述**，不是朗读稿。

### duration_s（时长）

生成音频秒数，滑块 **1–240**，默认 **30**。

### lyrics（歌词）

- **留空**：纯器乐 / 无人声。
- **有内容**：song 模式，ACE-Step 按歌词生成演唱（语言与 tags 一致为佳）。

多行歌词直接粘贴即可。

### 自定义参数（custom_params）

侧栏可绑 seed 等 workflow 参数。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
| --- | --- | --- | --- |
| **audio** | `COMFYTV_AUDIO` | 生成的音乐快照（FLAC 等） | Video Stage **audio**（IA2V）；Timeline；Audio Extract；Bridge |

## 新手一步一步

1. 放 **Project**，**Add Node → ComfyTV → Generate → Music Stage**。
2. **workflow** → **ACE-Step v1 Song**。
3. **main_prompt**：`cinematic orchestral, epic, 120bpm, no vocals`（纯器乐示例）。
4. **lyrics** 留空，**duration_s** 设 `30`。
5. 确认 `ace_step_v1_3.5b.safetensors` 已放入 checkpoints（见 models 文档）。
6. 点 **▶ 运行**，节点上播放预览。
7. 若要驱动视频：拖 **Video Stage**，workflow **IA2V**，Music **audio** → Video **audio**，再接一张人物图到 **images**。

**带人声歌曲**：在 **lyrics** 写歌词，main_prompt 写 `pop, upbeat, female vocal` 等风格 tags → Run。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/audio/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题

**Q：生成的像有人在说话而不是唱歌？**  
A：检查是否误用 Speech Stage；Music Stage 的 main_prompt 应是音乐 tags，人声靠 **lyrics** + song workflow。

**Q：Run 报错找不到模型？**  
A：下载 ACE-Step checkpoint 到 `models/checkpoints/`，重启 ComfyUI。

**Q：audio 连不上 Video Stage？**  
A：确认两边都是 `COMFYTV_AUDIO`；原生 AUDIO 需先 **→ ComfyTV Audio** Bridge。

**Q：想要念稿配音？**  
A：用 **Speech Stage**（Kokoro TTS 等），不是本节点。

## 相关节点

- **Speech Stage**——TTS 配音（不要与 Music Stage 混淆）。
- **Video Stage (IA2V)**——消费 **audio** 驱动画面。
- **Audio Extract Vocal / Bg Stage**——从混合音频分离人声或伴奏。
- **Director Timeline Stage**——多轨时间线。
- **Bridge → / ← ComfyTV Audio**——原生互通。
- **Project**——项目上下文。
