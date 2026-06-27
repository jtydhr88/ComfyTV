[English](README.md) | **简体中文**

# `speech/` 工作流

这个目录下的工作流出现在 **Speech Stage** 下拉框 —— 文本转语音 / 配音。这个 stage 是**模型无关**的:只暴露(几乎)所有 TTS 后端都通用的参数(text、voice、language、speed、可选的参考音频/文本),各模型特有的参数交给每个 stage 的 **Custom Params**(自定义参数)面板。

> 音乐 / 歌曲生成请看 [`../music/`](../music/) 和 **Music Stage**。

ComfyUI **原生没有 TTS**(自带的音频只有 ACE-Step / Stable Audio,只做音乐),所以 Speech 要靠自定义节点。

## 内置工作流:Kokoro TTS

`kokoro-tts.json` 在下拉框里显示为 **"Kokoro TTS"**。Kokoro-82M 是个很小、很快的多语言 TTS,通过 ONNX 跑在 CPU 上 —— 选它是为了用最轻的方式把 Speech Stage 整条链跑通。

图:`Kokoro Speaker → Kokoro Generator → SaveAudioMP3`。

### 安装

```
cd ComfyUI/custom_nodes
git clone https://github.com/stavsap/comfyui-kokoro.git
pip install kokoro-onnx onnxruntime
```

不需要 torch、不需要 GPU。模型(~300MB)首次运行时自动下载到节点目录。

### stage → 节点 绑定(`kokoro-tts_preset.json`)

| Stage 输入(`from`)    | 目标节点 · 输入                     |
|------------------------|------------------------------------|
| `main_prompt`          | `KokoroGenerator` · `text`         |
| `option:voice`         | `KokoroSpeaker` · `speaker_name`(默认 `af_sarah`) |
| `option:speed`         | `KokoroGenerator` · `speed`        |
| `option:language`      | `KokoroGenerator` · `lang`(默认 `English`) |

Kokoro 没有声音克隆、也没有 seed,所以 stage 的**参考音频**、**参考文本**、**seed** 在这里故意不绑。它的 `language` 必须是 Kokoro 的名称之一(`English`、`English (British)`、`Mandarin Chinese`、`Japanese`、`French`、`Spanish`、`Brazilian Portuguese`、`Italian`、`Hindi`);stage 选 `Auto` 会回退到 `English`。

## 用别的 / 更重的引擎

这个 stage 是模型无关的 —— 自己用 ComfyUI 的普通 **Save**(不是 "Save (API Format)")导出一个工作流,结尾接原生 `SaveAudio` / `SaveAudioMP3` / `SaveAudioOpus` 节点,再在左侧 **ComfyTV** 侧边栏或 `_preset.json` 里映射同样的 stage 输入即可。更重的选择:[TTS-Audio-Suite](https://github.com/diodiogod/TTS-Audio-Suite)(16 个引擎一个节点)、[VibeVoice](https://github.com/Enemyx-net/VibeVoice-ComfyUI)(长文本、多说话人、克隆)、[F5-TTS](https://github.com/niknah/ComfyUI-F5-TTS)(轻量克隆)。要做克隆,把参考音频接到 stage 的 `reference_audio` 输入 → `upstream_audio:value`。
