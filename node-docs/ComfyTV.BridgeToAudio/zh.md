# → ComfyTV 音频 (Bridge To Audio)

> **入桥**：ComfyUI **AUDIO** dict → **COMFYTV_AUDIO** wav URL；**▶ 运行** 写入 `output/ComfyTV/bridge/*.wav`。

## 这个节点是做什么的

ComfyUI 音频节点输出 **`AUDIO`** `{waveform, sample_rate}` 内存音频对象。ComfyTV **Video Stage (IA2V)**、**Audio Stage** 下游要 **`COMFYTV_AUDIO`** URL。**→ ComfyTV Audio** Run 时用 torchaudio 写 **WAV**（通用、无 codec 依赖）到 bridge 目录。

适用于 Stable Audio、ACE-Step 原生输出、或任意插件 AUDIO 进 ComfyTV 流水线。

## 适用场景

- 原生音乐生成 → ComfyTV **Video Stage** IA2V
- 外部 TTS / 音效 → ComfyTV 时间线（未来）
- Demux 后又在 ComfyUI 里处理完 AUDIO → 回 ComfyTV

## 工作原理

- **Stage** + **▶ 运行**；`_save_audio_to_disk` → WAV。
- 3D waveform `[1, channels, samples]` 标准化后保存。
- 快照供 IA2V 等读取 `/view?` 指向的 wav。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 原生 `AUDIO` | ComfyTV `COMFYTV_AUDIO` |
|---|---|
| 内存音频 + 采样率 | wav `/view?` URL |

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### audio
上游 **AUDIO**。必填。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | Video Stage **audio**、Audio Stage |

## 新手一步一步

1. 原生节点输出 AUDIO。
2. **→ ComfyTV Audio**，连线，**▶ 运行**。
3. 接到 **Video Stage** 的 **audio**（IA2V workflow）。

## 链接

| 资源 | 链接 |
|---|---|
| Bridge 指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md |
| 视频与音频指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md |

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) | COMFYTV_* 与原生类型、入桥/出桥、IPAdapter 等示例 |
| [自定义工作流](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) | 导入自己的 ComfyUI JSON，不改 Python |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **Bridge 实现源码** | https://github.com/jtydhr88/ComfyTV/blob/main/nodes/bridges.py |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题 FAQ

**Q：Queue 和 Run 混淆？**  
A：**Run** = ComfyTV stage / 入桥写入快照（本节点必须 Run）；**Queue** = 跑整条 ComfyUI 图。入桥不能用 Queue 代替 Run。

**Q：Demux 已是 COMFYTV_AUDIO，还要桥吗？**  
A：不需要。Demux 已在 ComfyTV 体系内。桥只用于 **原生 AUDIO**。

**Q：wav 在哪？**  
A：`output/ComfyTV/bridge/*.wav`。

**Q：采样率会变吗？**  
A：保留源 **sample_rate**。

## 写入位置（与图像/视频入桥相同）

Run 后文件在 ComfyUI **`output/ComfyTV/bridge/`**：

| 类型 | 格式 |
|---|---|
| Audio | `.wav`（torchaudio，通用） |

URL 形如 `/view?filename=ComfyTV_bridge_00001_.wav&subfolder=ComfyTV/bridge&type=output`，下游 COMFYTV stage 与 **Demux** 输出用法相同。

## 相关节点

- **Video Stage**（IA2V）
- **Demux · Audio Track**
- **← ComfyTV Audio**
