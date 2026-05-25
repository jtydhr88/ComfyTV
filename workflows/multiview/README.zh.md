[English](README.md) | **简体中文**

# `multiview/` 工作流

这个目录下的工作流出现在 **Image Variations** 下拉框(当 stage 的 `workflow_kind` 是 `multiview` 时)。每个工作流把源图扇出到 **N 条并行 KSampler 分支,在一次 ComfyUI 提交里跑完**:模型 / CLIP / VAE / LoRA 共享,每条分支的 conditioning 不一样。输出是一组图,一张对应一个角度。

## stage 提供的输入

- **源图**(必需) , 来自上游。
- **提示词** , 主体描述(如 *"young Asian businesswoman, 30s"*)。每条分支自动在前面拼上各自的角度关键词。
- 没有其它可调参数 , 角度列表是工作流自己定的。

## 工作流需要包含

- 一个或多个 `SaveImage` 输出节点(全部都会被收集成同一组图)。
- 一个 `LoadImage` 接源图。
- 共享的模型链(UNet → 多角度 LoRA → Lightning LoRA → ModelSamplingAuraFlow → CFGNorm)、CLIP、VAE。
- 共享的基础 latent:缩放后源图过一次 `VAEEncode`;每个采样器的 `latent_image` 都连这里。
- 每条分支:`TextEncodeQwenImageEditPlus`(在提示词前拼角度关键词)+ `FluxKontextMultiReferenceLatentMethod` + `KSampler` + `VAEDecode` + `ImageScale`(回缩到源尺寸)+ `SaveImage`。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

四个都用 Qwen-Image-Edit 2511 + fal Multiple-Angles LoRA + Lightning 4 步 LoRA：

| 标签 | 文件 | 分支数 | 主体默认 |
|---|---|---|---|
| **Face 3-View** | `qwen-3view-face.json` | 3（脸部前/侧/后特写） | "a face" |
| **Product 3-View** | `qwen-3view-product.json` | 3（产品前/3/4/后） | "a product" |
| **Character 3-View** | `qwen-3view-character.json` | 3（角色全身前/侧/后） | "a character" |
| **Multi-cam 9** | `qwen-9cam.json` | 9（每 45° 一个方位角 + 居中） | "a person" |

## 需要的模型

和 [Multiangle 工作流](../multiangle/README.zh.md) 同一套：
- `qwen_image_edit_2511_fp8mixed.safetensors` → `models/diffusion_models/`
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` → `models/clip/`
- `qwen_image_vae.safetensors` → `models/vae/`
- `qwen-image-edit-2511-multiple-angles-lora.safetensors` → `models/loras/`
- `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` → `models/loras/`

