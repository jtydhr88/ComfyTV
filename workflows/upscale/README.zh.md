[English](README.md) | **简体中文**

# `upscale/` 工作流

这个目录下的工作流出现在 **Upscale** 下拉框。连接一张上游图,产出高分辨率版本。

## stage 提供的输入

- **源图**(必需) , 来自上游。
- **倍数**(`2x` / `4x`) , 内置 GAN 工作流忽略这个值(模型倍数固定);diffusion-refine 变种可以接它。
- **提示词**(可选) , 纯 GAN 上采样器通常不用;只有 diffusion-refine 变种才会消费。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `LoadImage` 接源图。
- GAN 上采样:`UpscaleModelLoader` + `ImageUpscaleWithModel`。
- (可选)diffusion refine 链:`VAEEncode + KSampler + VAEDecode`,通常用很低的 denoise(~0.2)做锐化不破坏内容。
- (可选)缩到目标尺寸:GAN 之后接 `ImageScaleBy`,按系数打包多个变种(4x 模型后接 `scale_by=0.5` = 2x)。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **Ultrasharp 4x**(`ultrasharp-4x.json` + `_preset.json`) , 纯 GAN 4x 上采样,用 `4x-UltraSharp.pth`。没 diffusion、没提示词。输出严格 4 倍输入尺寸。测试通过。

## 需要的模型

- `4x-UltraSharp.pth` , 放进 `models/upscale_models/`,约 67 MB。同目录的其他模型也能用:`RealESRGAN_x4plus.safetensors`,或者任意 ESRGAN 风格的上采样器,在侧边栏改对应 loader 的模型名即可。

