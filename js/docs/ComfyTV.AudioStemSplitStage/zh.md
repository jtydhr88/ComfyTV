# Audio Stem Split

> 把成品混音分离为各个部分 — 人声、鼓、贝斯及其余一切 — 供重混或清理。

## 本节点的作用

**Audio Stem Split(音频分轨)** 对混音轨做源分离并返回各个 stem。它使用 HDemucs 模型把混音拆成人声、鼓、贝斯与"其余",外加一个伴奏 stem(去除人声后的完整混音)。之后可单独处理或重混每一部分。

它接受 `COMFYTV_AUDIO` 快照或 `COMFYTV_VIDEO`(使用其音轨;audio 优先)。输出五个 `COMFYTV_AUDIO` stem,并带有 ▶ **Run** — 分离是神经网络模型,首次运行会下载权重,每次运行都需要实际算力。

若要与原生 ComfyUI 的 `AUDIO` 互通,请插入 **Bridge** — 见 [bridges.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)。

## 何时使用

- 从歌曲中抽出独立人声,用于重混或清唱。
- 去除人声制作卡拉OK/伴奏版(**accompaniment**)。
- 独立于混音其余部分重新平衡鼓或贝斯。

## 参数

本节点没有可调参数 — 接入源并运行即可,分离模型完成其余工作。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **vocals** | `COMFYTV_AUDIO` | 独立人声 stem |
| **accompaniment** | `COMFYTV_AUDIO` | 去除人声后的混音(鼓 + 贝斯 + 其余) |
| **drums** | `COMFYTV_AUDIO` | 独立鼓 stem |
| **bass** | `COMFYTV_AUDIO` | 独立贝斯 stem |
| **other** | `COMFYTV_AUDIO` | 未归为人声、鼓或贝斯的一切 |

## 提示

- 分离从不完美 — 各 stem 之间会有些串音,在密集或重度处理的混音上尤为明显。
- 首次运行会下载模型;之后更快但仍耗算力。越长的音轨耗时越长。
- 把 stems 送回 **Audio Mix** 以带着你的修改重建混音。

## 相关节点

- **Audio Mix** — 以新的电平/声像把 stems 重组为新混音。
- **Noise Reduction (Spectral)** — 分离后清理某个 stem。
- **Audio Beats & Notes** — 分析独立鼓 stem 以获得更准的节拍检测。
