# 语音转字幕 (Subtitles · Speech-to-Text)

> 自动把视频或音频里的语音转写成字幕文本，可直接喂给 Subtitles 节点。

## 这个节点是做什么的

**Subtitles · Speech-to-Text（语音转字幕）** 对上游的 **video** 或 **audio** 运行语音转文字工作流，把转写结果作为 `COMFYTV_TEXT`（字幕）返回。选一个 **workflow**、接入片段、点 **▶ 运行**；转写走后端工作流（服务器上真实的模型推理），因此需要安装对应模型。

必须提供 **audio** 或 **video** 之一。若接入 **audio** 则直接转写它；否则使用 **video**。两者都没有时运行会报错。

## 适用场景

- 为口播片段生成字幕，再用 **Subtitles** 烧录。
- 为旁白或采访得到粗略转写供编辑。
- 不用手打 SRT 即可启动字幕流程。

## 参数说明

### workflow（工作流）
要运行哪个语音转文字工作流。下拉框列出已安装的 `speech-to-text` 工作流（`labels_for('speech-to-text')`），并有合理默认值。每个选项对应一个后端工作流 JSON 及其所需模型。

## 输入与输出

| 接口 | 类型 | 含义 |
|---|---|---|
| **audio**（输入） | `COMFYTV_AUDIO` | 可选，要转写的音频（存在时优先使用） |
| **video**（输入） | `COMFYTV_VIDEO` | 可选，要转写的视频（无音频时使用） |
| **subtitles**（输出） | `COMFYTV_TEXT` | 转写 / 字幕文本 |

## 使用提示

- 把 **subtitles** → **Subtitles** 节点的 **subs_text** 连起来，从语音直达硬字幕。
- 有干净音轨时接入 **audio**——可跳过视频自带声道。
- 可用工作流及其模型取决于你的安装；若下拉框为空或运行失败，检查语音转文字工作流/模型是否已就位。

## 类型与 Bridge

`COMFYTV_TEXT`、`COMFYTV_VIDEO`、`COMFYTV_AUDIO` 是 ComfyTV 项目快照，不是 ComfyUI 原生类型。要与原生 ComfyUI 节点互通，请插入 **Bridge**（`ComfyTV/Bridge`）。详见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 相关节点

- **Subtitles（字幕）**——把生成的字幕烧录到视频上。
- **Title（标题）**——单条带样式标题卡。
