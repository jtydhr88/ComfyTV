# Audio Time / Pitch（音频变速/变调）

> 改变速度、移调，或时间拉伸音轨——并提供高质量相位声码器选项，让音高与速度相互独立。

## 这个节点是做什么的

**音频变速/变调 (Audio Time / Pitch)** 对音频重新计时或重新定调。在快速的 FFmpeg 模式里使用 `atempo`、`asetrate`/`aresample` 与 `areverse`。在两个 **HQ** 模式里使用 StaffPad 风格的相位声码器，在拉伸时间或移调时不产生朴素重采样带来的「花栗鼠」副作用。

输入为 `COMFYTV_AUDIO` 快照（也可接 `COMFYTV_VIDEO`，会取其音轨），输出处理后的 `COMFYTV_AUDIO` 以及一个 `fx_spec`。它带有 ▶ **运行**。HQ 模式需要音频输入，且当改变量等于「无操作」时会拒绝运行。

要与 ComfyUI 原生 `AUDIO` 互通，请插入 **Bridge**——见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 适用场景

- 加速或减速片段同时保持音高自然（无需 `pitch_hq`——用 `stretch_hq`）。
- 将人声或乐器按乐理音程移调而不改变时长（`pitch`/`pitch_hq`）。
- 倒放音轨制作 whoosh/上升音效。

## 参数说明

### mode
运行哪种操作。可选：
- **speed**（默认）—— 速度*与*音高一起改变（经 `atempo`），如同以更快转速播放唱片。
- **pitch** —— 按半音移调并保持时长（重采样 + `atempo`）。
- **pitch_hq** —— 同上，但经相位声码器以获得更高质量。需要音频；**semitones = 0** 时报错。
- **stretch_hq** —— 仅改变速度、保持音高，经相位声码器。需要音频；**tempo = 1.0** 时报错。
- **reverse** —— 倒放音轨。

### tempo
播放速度倍数，**0.25–4.0**（默认 **1.0**）。`speed` 与 `stretch_hq` 使用。2.0 = 快一倍，0.5 = 半速。在这两个模式里若保持 1.0 会报错（无事可做）。

### semitones
移调半音数，**-24 到 +24**，步进 0.5（默认 **0.0**）。`pitch` 与 `pitch_hq` 使用。+12 = 升高一个八度。在这两个模式里若保持 0 会报错。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | 重新计时/定调后的音频 |
| **fx_spec** | `COMFYTV_FXSPEC` | 该效果的 spec（仅 FFmpeg 模式）；HQ 模式发出空的附加输出 |

## 小贴士

- `speed` 是快速的「唱片机」行为；需要保持音高有乐感时用 `stretch_hq`。
- `pitch`（FFmpeg）快但可能糊掉瞬态；`pitch_hq` 更干净，代价是处理时间。
- 只有 FFmpeg 模式产出可串联的 `fx_spec`——HQ 模式直接渲染。

## 相关节点

- **Audio Modulation** —— 颤音提供连续的音高抖动，而非固定移调。
- **FX Chain** —— 把多个 `fx_spec` 步骤（FFmpeg 模式）一趟渲染完成。
