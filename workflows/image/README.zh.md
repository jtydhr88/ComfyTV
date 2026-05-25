[English](README.md) | **简体中文**

# `image/` 工作流

这个目录下的工作流出现在 **Image Stage** 下拉框。接收提示词 + 0..N 个参考图,产出一张或多张图。

## stage 提供的输入

- **提示词** + 可选**负向提示词**。
- **参考图**(可选) , i2i 工作流用上游接进来的第一张。
- **分辨率**(`1K` / `2K` / `4K`)、**比例**(`1:1`、`16:9` 等)、**批量大小**(1..8)、**随机 seed**。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测;多张输出会合到 `COMFYTV_IMAGES` 批次里)。
- 一个 `CLIPTextEncode` 接提示词;t2i 工作流再加一个接负向提示词。
- 一个 `EmptyLatentImage` / `EmptySD3LatentImage` 接 stage 的宽 / 高 / 批量大小。
- 一个 `KSampler`,用 stage 的 seed。
- i2i 工作流:一个 `LoadImage` 节点接上游图。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **Local SD1.5**(`local-sd15.json` + `_preset.json`) , 原始 SD1.5 文生图,用 `v1-5-pruned-emaonly.safetensors`。测试通过。
- **Local SD1.5 I2I**(`local-sd15-i2i.json` + `_preset.json`) , 同一个模型走 i2i,`VAEEncode + denoise<1.0`。测试通过。
- **Image Ideogram4 T2I**(`image_ideogram4_t2i.json` + `_preset.json`) , Ideogram 4 + Qwen3-VL 文本编码器文生图。测试通过。

## 需要的模型

- `v1-5-pruned-emaonly.safetensors` , SD1.5 base(~4 GB)
- Ideogram4:`ideogram4_fp8_scaled.safetensors`、`ideogram4_unconditional_fp8_scaled.safetensors`、`qwen3vl_8b_fp8_scaled.safetensors`、`flux2-vae.safetensors`(详见 [docs/models.zh.md](../../docs/models.zh.md))

