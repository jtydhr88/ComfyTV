[English](README.md) | **简体中文**

# `relight/` 工作流

这个目录下的工作流出现在 **Relight** 下拉框。连接一张上游图,按新的光照(亮度、色温、轮廓光方向)重新渲染,同时保留主体身份、几何结构、细节。

## stage 提供的输入

- **源图**(必需) , 来自上游。
- **提示词** , 由 RelightStage 从 brightness / color / rim_light widget 自动组装(例:`"relight the image, with bright, natural lighting, tinted with light color #ffaa00, with a subtle rim light separating the subject from the background. Preserve the subject's identity, geometry, and details; only change lighting and shadows."`)。工作流只需把它接到文本 encoder 即可。
- **随机 seed**。
- 第二张上游图(可选,仅 with-reference 变种用) , 作为参考图迁移光照。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `LoadImage` 接源图。
- 模型对应的编辑 encoder(Qwen-Edit 用 `TextEncodeQwenImageEditPlus`、Flux-Kontext 风格用 `InstructPixToPixConditioning`)接提示词。
- `KSampler` 一个,用 stage 的 seed。
- (可选)4 步 Lightning LoRA 加速 Qwen-Edit 类流程。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **Qwen Edit 2509 Relight**(`qwen-edit-2509-relight.json` + `_preset.json`) , Qwen-Image-Edit 2509 fp8 + Relight LoRA + 4 步 Lightning LoRA。
- **Qwen Edit 2509 Relight (with reference)**(`qwen-edit-2509-relight-with-ref.json` + `_preset.json`) , 变种工作流,接第 2 张上游图作参考。

## 需要的模型

- `qwen_image_edit_2509_fp8_e4m3fn.safetensors` → `models/diffusion_models/`
- `Qwen-Image-Edit-2509-Relight.safetensors` → `models/loras/`
- `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` → `models/loras/`
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` → `models/clip/`
- `qwen_image_vae.safetensors` → `models/vae/`

下载地址见 [docs/models.zh.md](../../docs/models.zh.md)。

