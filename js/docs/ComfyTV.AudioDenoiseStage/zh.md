# Audio Denoise（音频降噪）

> 去除音轨里的稳态背景噪声——风扇哼声、磁带嘶声、空调低鸣——或裁掉静音间隙。

## 这个节点是做什么的

**音频降噪 (Audio Denoise)** 削减音轨的宽带背景噪声，由 **method** 决定：

- **afftdn** —— 基于 FFT 的降噪（FFmpeg `afftdn`），适合稳态嘶声与哼声。降噪量随 **strength** 缩放。
- **anlmdn** —— 非局部均值降噪（FFmpeg `anlmdn`），更柔和、保留细节；同样由 **strength** 缩放。
- **silenceremove** —— 不是降噪而是静音裁剪（FFmpeg `silenceremove`）：裁掉低于阈值的段落，适合去除空白段。

输入为 `COMFYTV_AUDIO` 快照（也可接 `COMFYTV_VIDEO`，会取其音轨），输出处理后的 `COMFYTV_AUDIO` 以及一个 `fx_spec`。它带有 ▶ **运行**（处理由 FFmpeg 完成）。若未接源音频，只发出 `fx_spec` 以便串联。

要与 ComfyUI 原生 `AUDIO` 互通，请插入 **Bridge**——见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 适用场景

- 清掉人声录音下持续的风扇或空调低鸣（**afftdn**）。
- 削减磁带/话筒嘶声，同时保持录音自然（**anlmdn**）。
- 剪辑前自动裁掉原始素材里的长静音（**silenceremove**）。

## 参数说明

### method
选择处理器：`afftdn`（默认）、`anlmdn`、`silenceremove`。

### strength
降噪量，范围 **0 到 1**，默认 **0.3**。`afftdn` 下映射为降噪档位（约 0–40）；`anlmdn` 下映射为滤镜的平滑强度。越高去噪越多，但可能出现「水声」或空洞感。`silenceremove` 不使用此项。

### silence_db
判定为静音的阈值（dB）。范围 **-80 到 -20**，默认 **-50**。越低 = 只裁很安静的段落。仅 `silenceremove` 使用。

### min_silence_s
一段安静必须持续多久（秒）才会被裁掉。范围 **0.1 到 5**，默认 **0.5**。仅 `silenceremove` 使用。

### keep_silence_s
在保留音频周围留出多少静音（秒），避免剪切听起来突兀。范围 **0 到 5**，默认 **0.5**。仅 `silenceremove` 使用。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | 降噪（或静音裁剪）后的音频快照 |
| **fx_spec** | `COMFYTV_FXSPEC` | 本步骤的 spec，可串入 FX Chain |

## 小贴士

- **strength** 从低值起步（0.2–0.3）再逐步加大；过度降噪会留下明显伪影。
- `silenceremove` 会改变音轨的**时长**——下游若假设原始时长（如口型对齐或定长视频）需相应处理。
- 对窄带、音调化的嗡声（如 50/60 Hz 市电哼声），**Audio Repair** 的 **hum** 模式比宽带降噪更精准。

## 相关节点

- **Audio Repair** —— 针对具体瑕疵的去咔哒、去削波、小波降噪与市电哼声消除。
- **Audio EQ** —— 一个高通频段就能去掉低频隆隆声，无需整套降噪。
- **FX Chain** —— 把多个 `fx_spec` 步骤（含本节点）一趟渲染完成。
