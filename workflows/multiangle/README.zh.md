[English](README.md) | **简体中文**

# `multiangle/` 工作流

这个目录下的工作流出现在 **Multiangle** 下拉框。用户在 3D 相机 widget 上挑视角(方位角 / 俯仰 / 缩放),MultiangleStage 把这些数值自动拼成 LoRA 要求的 `<sks> [az_kw] [el_kw] [dist_kw]` 提示词。工作流按这个视角重新渲染源图,保留主体。

## stage 提供的输入

- **源图**(必需) , 来自上游。
- **提示词** , stage 在服务端按 3D 相机视角已经拼好(`<sks> ...` 格式),工作流直接接到正向文本 encoder 即可,**不要**再拼一次。
- **随机 seed**。

## 工作流需要包含(Qwen-Image-Edit + fal LoRA 模式)

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `LoadImage` 接源图。
- 一个 `FluxKontextImageScale` 缩到模型友好的分辨率。
- 一个 `GetImageSize`(接 LoadImage)捕获源图尺寸,后面回缩用。
- 一个 `TextEncodeQwenImageEditPlus` 编码图 + 文(`image1` + `clip` + `vae` + `prompt`)。
- 一个 `FluxKontextMultiReferenceLatentMethod` 包在 pos 和 neg conditioning 上。
- 模型链:UNETLoader → 多角度 LoRA → Lightning LoRA → `ModelSamplingAuraFlow`(shift=3.1)→ `CFGNorm`。
- `KSampler` 一个,4 步、cfg=1、euler、simple、denoise=1.0。
- `VAEDecode` 之后接 `ImageScale`,用 `GetImageSize` 出来的 width/height,让输出回到源图尺寸。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 提示词格式(stage 自动拼)

```
<sks> [方位角] [俯仰] [距离], [可选额外说明]
```

- **8 个方位角**(每 45°):front view、front-right quarter view、right side view、back-right quarter view、back view、back-left quarter view、left side view、front-left quarter view
- **4 个俯仰**:low-angle shot(≤ -15°)、eye-level shot(-15..15°)、elevated shot(15..45°)、high-angle shot(> 45°)
- **3 个距离**:wide shot(zoom < 3)、medium shot(3..7)、close-up(≥ 7)

## 当前内置

- **Qwen Edit 2511 Multiangle**(`qwen-edit-2511-multiangle.json` + `_preset.json`) , Qwen-Image-Edit 2511 fp8mixed + fal Multiple-Angles LoRA + Lightning 4 步 LoRA。测试通过。

## 需要的模型

需要的文件：
- `qwen_image_edit_2511_fp8mixed.safetensors` → `models/diffusion_models/`
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` → `models/clip/`（或 `text_encoders/`）
- `qwen_image_vae.safetensors` → `models/vae/`
- `qwen-image-edit-2511-multiple-angles-lora.safetensors` → `models/loras/`（来自 [fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA](https://huggingface.co/fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA)）
- `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` → `models/loras/`

