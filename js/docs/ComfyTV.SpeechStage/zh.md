# 语音阶段 (Speech Stage)

> 把台词脚本合成为可朗读的配音（TTS），用于旁白和对白；与 Music Stage 的歌曲/器乐生成完全不同。

## 这个节点是做什么的

**Speech Stage** 是 ComfyTV 的**文本转语音 (TTS)** 节点。在 **main_prompt** 里写要念出来的全文（旁白、对白、播报稿），选择 TTS **workflow**，点 **▶ 运行**，得到 **`COMFYTV_AUDIO`** 语音快照。

本 stage 是**模型无关**设计：界面只暴露大多数 TTS 引擎都通用的参数（文本、音色、语言、语速、可选参考音频）。各引擎特有选项放在侧栏 **Custom Params** 里，通过 preset JSON 绑定。

**不要**把 Speech Stage 当 Music Stage 用：这里没有「流派 / BPM tags」，main_prompt 就是**朗读稿**。

## 适用场景

- 短视频旁白、广告配音、角色对白。
- Storyboard 里写了 **dialogue** 字段，复制到 Speech Stage 批量出音。
- 为 Video Stage **IA2V** 提供口型驱动音轨（Speech **audio** → Video **audio**）。
- 声音克隆：接 **reference_audio** + **reference_text**（F5-TTS、GPT-SoVITS 等 workflow）。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** 只跑 [`workflows/speech/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/speech) 子图。
- **快照**：MP3/FLAC URL 写入项目；Video IA2V、Timeline 直接读快照。
- ComfyUI **原生没有 TTS**（ACE-Step 只做音乐），Speech 依赖自定义节点（如 Kokoro）。

与 Music Stage 的分工：Music = 旋律 + 编曲 + 可选演唱歌词；Speech = **准确朗读给定文本**。

## 类型说明（COMFYTV_AUDIO vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
| --- | --- | --- |
| `COMFYTV_AUDIO` | 语音片段的项目快照 | 不是 ComfyUI 内存音频 |
| 原生 AUDIO | 内存里的音频数据 | 需 Bridge 才能接 ComfyTV |

**如何转换：**

- 原生 → ComfyTV：**→ ComfyTV Audio**
- ComfyTV → 原生：**← ComfyTV Audio**

详见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## Speech Stage vs Music Stage（必读）

| 对比项 | **Speech Stage**（本节点） | **Music Stage** |
| --- | --- | --- |
| 用途 | 念台词、旁白、配音 | 歌曲、器乐、音效 |
| main_prompt | 完整朗读稿 | 音乐风格 tags |
| voice / language | TTS 音色与语言 | 无（用 lyrics 控制演唱） |
| 典型 workflow | Kokoro TTS | ACE-Step v1 Song |
| 听感 | 人声朗读，无伴奏编曲 | 有音乐结构，可能带唱 |

## 界面与参数说明

### workflow

[`workflows/speech/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/speech) 中的 TTS backend。

**内置：Kokoro TTS**（`kokoro-tts.json`）

- Kokoro-82M，ONNX + CPU，轻量快速，适合跑通整条链。
- 需安装自定义节点：

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/stavsap/comfyui-kokoro.git
pip install kokoro-onnx onnxruntime
```

模型 (~300MB) 首次运行自动下载。详见 [workflows/speech/README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/speech/README.zh.md)。

### main_prompt（朗读稿）

要念出来的**完整文本**。可以多句、多段；不是音乐 tags。

**示例**：`各位观众，欢迎收看今天的节目。接下来，我们将带您走进赛博朋克风格的未来都市。`

### voice（预设音色）

命名说话人 id，供 Kokoro、Bark、ElevenLabs 等**预设音色**模型使用。Kokoro 通过 预设默认 `af_sarah` 等。

从 **reference_audio** 克隆时可留空（取决于 workflow 是否支持克隆）。

### language（语言）

多语言 TTS 的语言名。**Auto** = 交给 workflow/模型默认（Kokoro 会回退 English）。

Kokoro 必须使用其支持的名称之一，例如 `English`、`Mandarin Chinese`、`Japanese`、`French` 等——与下拉列表一致。

**误区**：选 `Auto` 时期望中文朗读，但 Kokoro 可能仍用 English——中文请显式选 `Mandarin Chinese`。

### speed（语速）

`1.0` 为自然语速，范围 **0.5–2.0**。

### reference_text（参考稿）

参考音频的文字稿；F5-TTS / GPT-SoVITS 克隆时通常必填。支持自动转写的引擎可留空。

### reference_audio（参考音频）

可选 `COMFYTV_AUDIO`，用于**声音克隆**。接 Music/Speech 上游或 Load Audio from Asset。预设方案里用 `upstream_audio:value` 绑定到克隆节点。

Kokoro **不支持**克隆，这两项对 Kokoro workflow 无效。

### 自定义参数（custom_params）

侧栏绑定引擎特有参数（如 Kokoro 以外的 seed、speaker embedding 等）。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
| --- | --- | --- | --- |
| **audio** | `COMFYTV_AUDIO` | 合成的语音快照 | Video IA2V **audio**；Timeline；Bridge |

## 新手一步一步

1. 安装 Kokoro 节点（见上），放 **Project** + **Speech Stage**。
2. **workflow** → **Kokoro TTS**。
3. **main_prompt** 输入一段中文旁白（2–3 句即可）。
4. **language** → `Mandarin Chinese`（中文朗读时勿用 Auto）。
5. **voice** 可留空（用 预设默认），**speed** `1.0`。
6. 点 **▶ 运行**，节点上播放语音预览。
7. 需要对口型视频：接 **Video Stage**，选 **IA2V**，Speech **audio** → Video **audio**，人物图 → **images**。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |
| [自定义工作流](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) | 导入自己的 ComfyUI JSON，不改 Python |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/speech |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/speech/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题

**Q：念出来是英文，但我写的是中文？**  
A：Kokoro 下 **language** 选 `Mandarin Chinese`，不要依赖 Auto。

**Q：和 Music Stage 选哪个？**  
A：念稿 → Speech；做 BGM 或歌曲 → Music Stage。

**Q：Run 报错找不到 Kokoro？**  
A：安装 `comfyui-kokoro` 和 `kokoro-onnx`，重启 ComfyUI。

**Q：reference_audio 没效果？**  
A：Kokoro 不支持克隆；换 F5-TTS 等 workflow 并正确 预设方案绑定。

## 相关节点

- **Music Stage (Audio Stage)**——歌曲/器乐，不是 TTS。
- **Video Stage (IA2V)**——用 Speech 的 **audio** 驱动画面。
- **Storyboard Stage**——分镜里的 dialogue 可抄到 Speech main_prompt。
- **Load Audio from Asset**——挑选已有配音。
- **Bridge → / ← ComfyTV Audio**——原生互通。
- **Project**——项目上下文。
