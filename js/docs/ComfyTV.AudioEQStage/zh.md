# Audio EQ（音频均衡）

> 由图形化 EQ 曲线驱动的参量均衡器——通过增益、衰减和滤波各频段来塑造音轨的音色。

## 这个节点是做什么的

**音频均衡 (Audio EQ)** 对音轨施加一叠频段滤波器。频段通过节点的 **EQ 曲线图 UI** 定义，UI 会把它们以 JSON 写入一个隐藏的 **bands** 字段。每个频段是五种类型之一——**peak**（钟形增益/衰减）、**highpass**（高通）、**lowpass**（低通）、**lowshelf**（低架）、**highshelf**（高架）——节点将每一条转换成对应的 FFmpeg 滤镜（`equalizer`、`highpass`、`lowpass`、`bass`、`treble`）。

输入为 `COMFYTV_AUDIO` 快照（也可接 `COMFYTV_VIDEO`，会取其音轨），输出处理后的 `COMFYTV_AUDIO` 以及一个 `fx_spec`。它带有 ▶ **运行**（滤波由 FFmpeg 完成）。若未接源音频，只发出 `fx_spec` 以便串联。若没有任何生效频段，会报错提示你添加频段或设置增益。

要与 ComfyUI 原生 `AUDIO` 互通，请插入 **Bridge**——见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 适用场景

- 用高架增益给人声加「空气感」/临场感。
- 用高通滤波滚掉低频隆隆声与低端噪声。
- 用 peak 衰减挖掉某个听着发闷或刺耳的共振频率。
- 用低架增益给单薄的录音增添厚度。

## 参数说明

### bands
隐藏的 JSON 字段，由 EQ 曲线图 UI 驱动——通常无需手动编辑。它保存一组频段对象，每个包含：

- **type** —— `peak`、`highpass`、`lowpass`、`lowshelf`、`highshelf`。
- **f** —— 中心/转折频率（Hz）。钳制到 **20–20000**。
- **g** —— 增益（dB）。钳制到 **-24 到 +24**。（对于 peak/lowshelf/highshelf，**g = 0** 的频段会被跳过，因为它什么都不做。）
- **q** —— 带宽 / 谐振。钳制到 **0.1–20**。Q 越宽影响的频率范围越广。

highpass 与 lowpass 为 2 阶滤波器，忽略 `g`。lowshelf 与 highshelf 需要 FFmpeg 的 `bass` / `treble` 滤镜存在。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | 均衡处理后的音频快照 |
| **fx_spec** | `COMFYTV_FXSPEC` | EQ 频段叠层的 spec，可串入 FX Chain |

## 小贴士

- **没有生效频段 = 报错。** 增益为 0 的 peak/架式频段视为无效，因此至少要有一个频段真正改变内容。
- 在压缩之前用高通清掉低频隆隆声，比事后补救更省事。
- lowshelf/highshelf 依赖 FFmpeg 编译时带上 `bass`/`treble`；若缺失，这些频段类型会被静默丢弃。

## 相关节点

- **Audio Dynamics** —— 压缩/门限；常与 EQ 搭配使用。
- **Audio Repair** —— 其 **hum** 模式能陷波掉市电频率的哼声，比 EQ 衰减更精准。
- **FX Chain** —— 把多个 `fx_spec` 步骤（含本节点）一趟渲染完成。
