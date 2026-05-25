[English](README.md) | **简体中文**

# `panorama/` 工作流

这个目录下的工作流出现在 **Panorama** 下拉框。从文本描述(以及可选的参考图)产出一张 360° equirectangular 全景图。

## stage 提供的输入

- **提示词** , stage 会自动在前面拼上 LoRA 触发词 `"equirectangular 360 degree panorama, "`,工作流直接接到文本 encoder 即可,**不要**再拼一次。
- **参考图**(可选) , 接进来的话,image-to-pano 变种当作正前方视图,向外推完整 360°。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `EmptySD3LatentImage`(或等价节点)按全景 LoRA 训练分辨率出 latent,常规是 2048×1024 / 2:1。
- 生成器:Flux / SDXL / SD1.5 base + 全景 LoRA,或者专用 360 模型(比如走 custom node 的 Diffusion360)。
- 一个 `CLIPTextEncode` 接提示词。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **Qwen-Image 2512 + 360 LoRA**(`qwen-image-2512-360.json` + `_preset.json`) , 文生全景,Qwen-Image 2512 fp8 + 4 步 Lightning LoRA + 360 LoRA。输出约 2048×1024 equirectangular。不需要参考图。
- **Qwen-Image-Edit 2511 Image-to-Panorama**(`qwen-edit-2511-img2pano.json` + `_preset.json`) , 图生全景。和 Image Edit / Multiangle / Relight 共用 Qwen-Image-Edit 2511 权重。

## 需要的模型

模型清单见 [docs/models.zh.md](../../docs/models.zh.md)。
