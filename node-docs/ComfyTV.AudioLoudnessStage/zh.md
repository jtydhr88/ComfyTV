# Audio Loudness（音频响度）

> 把音轨调到一致、符合播出规范的响度——EBU R128 归一、自适应平衡，或简单的峰值/RMS/LUFS 匹配。

## 这个节点是做什么的

**音频响度 (Audio Loudness)** 将音轨的整体电平归一到目标，提供三种 **mode**：

- **ebu_r128** —— 两趟式 EBU R128 响度归一（FFmpeg `loudnorm`）：先测量音轨，再按你的综合响度、真峰值、响度范围目标渲染。这是交付固定 LUFS 规格的标准做法。
- **dynamic** —— 自适应响度平衡（FFmpeg `dynaudnorm`），在整条音轨上连续调整电平，把偏轻或偏响的段落拉平。
- **normalize** —— 测量峰值/RMS/响度，施加单一增益，让所选的最响指标达到其目标（直白的「整条抬高/压低」处理）。

输入为 `COMFYTV_AUDIO` 快照（也可接 `COMFYTV_VIDEO`，会取其音轨），输出处理后的 `COMFYTV_AUDIO`。它带有 ▶ **运行**——测量与渲染均由 FFmpeg 完成。与其它 Audio FX 节点不同，本节点**必须接源音频**（无法 spec-only 运行），且**不**输出 `fx_spec`。

要与 ComfyUI 原生 `AUDIO` 互通，请插入 **Bridge**——见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 适用场景

- 用 **ebu_r128** 按平台响度规范交付（如 -16 LUFS、-1.5 dBTP）。
- 用 **dynamic** 平滑响度飘忽的录音（访谈、讲座）。
- 用 **normalize** 在导出前把整段峰值顶到 -1 dB。

## 参数说明

### mode
选择归一方式：`ebu_r128`（默认）、`dynamic`、`normalize`。下方参数仅在特定 mode 生效，见各条说明。

### target_i
综合响度目标（**LUFS**）。范围 **-30 到 -10**，默认 **-16**。`ebu_r128` 使用（作为 `I` 目标），`normalize` 在 **use_lufs** 开启时也使用。

### target_tp
最大真峰值（**dBTP**）。范围 **-3 到 0**，默认 **-1.5**。`ebu_r128` 使用。

### target_lra
目标响度范围。范围 **1 到 20**，默认 **11**。`ebu_r128` 使用。

### dyn_frame_ms
自适应平衡的分析帧长（毫秒）。范围 **10 到 8000**，默认 **500**。仅 `dynamic` 模式使用。

### dyn_gauss
高斯平滑窗口（以帧计，须为奇数）。范围 **3 到 301**，默认 **31**。越大 = 电平变化越平滑、越不激进。仅 `dynamic` 模式使用。

### peak_target_db
**normalize** 模式的目标峰值电平（dB）。范围 **-30 到 0**，默认 **-1**。施加的单一增益让所选峰值指标对准此值。

### peak_mode
**normalize** 模式的 `true_peak`（默认）或 `sample`。`true_peak` 走 loudnorm 的真峰值分析；`sample` 用 stats 得到的原始采样峰值。

### use_rms / rms_target_db
在 **normalize** 模式下，当 **use_rms** 开启（默认关闭）时，还会一并考虑 **rms_target_db** dB 的 RMS 目标（范围 **-30 到 0**，默认 **-9**）。

### use_lufs
在 **normalize** 模式下，开启（默认关闭）时还会一并考虑 **target_i** 的综合响度（LUFS）目标。

> **normalize** 模式下，节点为每个启用的指标（峰值，以及可选的 RMS 和 LUFS）算出所需增益，并施加其中**最小**的一个，从而不越过任何目标。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | 响度归一后的音频快照 |

## 小贴士

- **ebu_r128 是两趟处理**（先测量、再归一），因此比单趟滤镜慢——进度条会先显示「measure 1/2」再「normalize 2/2」。
- 若测量失败，`normalize` 模式会明确报错而不是瞎猜。
- 对电平飘忽的对白，`dynamic` 往往比生硬的 `ebu_r128` 更自然；需要命中精确交付规格时再用 R128。

## 相关节点

- **Audio Dynamics** —— 压缩器/限制器做逐刻电平控制，与响度归一互补。
- **Audio EQ** —— 响度处理前的音色塑形。
