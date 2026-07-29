# Audio Echo（音频回声）

> 给音轨加入回声、拍击延迟（slapback）或反馈式重复——从紧凑的人声加倍到峡谷般的巨大反射都行。

## 这个节点是做什么的

**音频回声 (Audio Echo)** 对音轨施加 FFmpeg 的 `aecho` 延迟/回声滤镜（或一个原生反馈延迟）。你可以选一个**预设 (preset)**，或自己调节延迟时间、反馈量和增益。像 `mountains` 这样的预设产生长而衰减的反射；`robot` 和 `doubled` 则是短促的拍击式重复。

输入为 `COMFYTV_AUDIO` 快照（也可接 `COMFYTV_VIDEO`，会取其音轨），输出处理后的 `COMFYTV_AUDIO`。它带有 ▶ **运行**（由 FFmpeg 完成）。必须接入源音频。

要与 ComfyUI 原生 `AUDIO` 互通，请插入 **Bridge**——见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 适用场景

- 用短促的加倍拍击让干瘪的人声更厚实。
- 加入宽阔、衰减的回声，营造氛围感或电影感。
- 制作随时间逐渐消散的节奏性反馈重复。

## 参数说明

### preset
选择回声的性格。可选：`custom`、`feedback`，外加四个内置的 `aecho` 配方——`doubled`、`robot`、`mountains`（默认）、`mountains2`（双抽头）。选 `custom` 使用下面四个手动滑杆；选 `feedback` 使用一个仅由 **delay_ms** 和 **decay** 驱动的原生反馈延迟。

### in_gain
送入回声的输入信号电平，**0.0–1.0**（默认 **0.6**）。仅当 `preset = custom` 时生效。

### out_gain
输出中回声（湿）信号的电平，**0.0–1.0**（默认 **0.3**）。仅当 `preset = custom` 时生效。

### delay_ms
首次重复前的延迟时间（毫秒），**1–90000**（默认 **1000**）。`custom` 与 `feedback` 使用。极短值（几毫秒）产生拍击/机器人音色；长值（数百毫秒）产生清晰可辨的回声。

### decay
每次重复相对上一次的衰减量，**0.01–1.0**（默认 **0.5**）。越高，尾音越长越持续。`custom` 与 `feedback` 使用。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | 加了回声的音频快照 |

## 小贴士

- 内置预设会忽略手动滑杆——设 **preset = custom** 才能听到你的增益/延迟/衰减值。
- `feedback` 模式只读取 **delay_ms** 和 **decay**；增益在此无效。
- 极短延迟（约 10 ms 以下）会更像梳状滤波/机器人音染，而非清晰回声。

## 相关节点

- **Muse Reverb (FDN)** —— 用于致密、弥散的混响，而非离散重复。
- **Audio Convolve (IR)** —— 用脉冲响应产生真实空间的混响。
- **Audio Modulation** —— 合唱/镶边，另一种「加厚」方式。
