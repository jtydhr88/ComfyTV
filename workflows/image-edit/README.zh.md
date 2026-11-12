[English](README.md) | **简体中文**

# `image-edit/` 工作流

这个目录下的工作流出现在 **Image Edit** 下拉框。连接一张源图 + 指令提示词,产出一张重新生成的图:大致构图不变,内容按提示词修改。和 **Inpaint**(基于 mask 的局部编辑)、**Outpaint**(画布扩展)区分开。

## stage 提供的输入

- **源图**(必需) , 来自上游。
- **提示词** , 编辑指令。
- **随机 seed**。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `LoadImage` 接源图。
- 一个 `CLIPTextEncode` 接提示词。
- 模型对应的编辑 conditioning 节点(`InstructPixToPixConditioning` / Flux Canny 的 `Canny` + `InstructPixToPixConditioning` / Qwen-Edit 的 `TextEncodeQwenImageEditPlus` 等)。
- `KSampler` 一个,用 stage 的 seed。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **Flux Canny Edit**(`flux-canny-edit.json` + `_preset.json`) , 把上游图作 Canny 边缘图,按提示词重画。只保轮廓,颜色由提示词决定。测试通过。
- **Qwen Edit 2511**(`qwen-edit-2511.json` + `_preset.json`) , Qwen-Image-Edit 2511 + Lightning 4 步指令编辑。保留主体颜色和材质,指令负责改背景/打光/加元素 —— 描述改动,不用描述整张图。3D 模型节点的**生成产品图**按钮会带默认"渲染图转产品照"指令生成这个工作流。测试通过。
- **Qwen Image 2.1 Edit**(`qwen-image-2.1-edit.json` + `_preset.json`) , 官方 Qwen Image 2.1 编辑图,最多 10 张图:stage 的第一张是编辑目标(输出尺寸跟它),其余是参考图。`LoadImage` ×10 → `TextEncodeQwenImage21`(Qwen3-VL-8B 编码器),它的 `latent` 输出自带目标图尺寸,所以没有 `VAEEncode`;没接的槽位自动剪掉,接 1~10 张都能跑。提示词里用 stage 的 `@image_1`..`@image_10` 提及(打 `@` 选,或把资产拖到媒体条上);preset 设了 `mention_style: qwen_tags`,发给模型时展开成 `<image1>`..`<image10>`("把 `@image_2` 的外套穿到 `@image_1` 的人身上")。25 步,cfg 1,`QwenImage21Cache` 走 auto。测试通过(5090 上 1K 约 20~27 秒)。
- **FLUX.3 Klein Edit**(`flux3-klein-edit.json` + `_preset.json`) , 官方 FLUX.3 Image Klein 蒸馏版编辑图,最多 10 张图:`LoadImage` ×10 → `Set Reference Multi Latent`(每张缩到约 1 MP,同时加到正负条件上);它的 `empty_latent` 输出取第一张图的尺寸,所以结果跟图 1 一样大。没接的槽位自动剪掉。preset 设了 `mention_style: flux3_tags`,`@image_1`..`@image_10` 发给模型时展开成 `<ref_image_0>`..`<ref_image_9>`,也就是 FLUX.3 认的写法。提示词写成结果图的完整描述,把要改的地方写进去。16 步,euler / simple,cfg 1。测试通过(两张图,输出 1360×768,5090 上含参考图编码约 33 秒)。
- **MiniMax H3 Image Edit**(`minimax-h3-image-edit.json` + `_preset.json`) , 官方 MiniMax-H3-Image 编辑模板,扩到 16 张图:第一张是编辑目标,缩到约 4 MP,输出尺寸跟它;另外 15 个 `LoadImage` 作为参考图接到 `MiniMaxH3ImageConditioning`。没接的槽位自动剪掉,接 1~16 张都能跑。preset 设了 `mention_style: minimax_tags`,`@image_1`..`@image_16` 发给模型时展开成 `<Picture 1>`..`<Picture 16>`。提示词扩写(`TextGenerateV2` + Qwen3.5-9B)会看着图把一句简短指令改写成对结果的完整描述;工作流里的 `Enable PE?` 开关关掉后按原文发送。6 步,euler / simple,cfg 1。单图和双图都测试通过(5090 上模型已加载时 2048×2048 约 1 分钟一张)。

## 需要的模型

- `flux1-canny-dev_fp8.safetensors` , 放进 `models/diffusion_models/`
- `clip_l.safetensors` + `t5xxl_fp16.safetensors` , 放进 `models/clip/`
- `ae.safetensors` , 放进 `models/vae/`
- Qwen Edit 2511:`qwen_image_edit_2511_fp8mixed.safetensors`(diffusion_models)、`Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors`(loras)、`qwen_2.5_vl_7b_fp8_scaled.safetensors`(clip)、`qwen_image_vae.safetensors`(vae)
- Qwen Image 2.1 Edit:`qwen_image_2.1_int8_convrot.safetensors`(diffusion_models)、`qwen3vl_8b_int8_convrot.safetensors`(text_encoders)、`qwen_image_2.1_vae_bf16.safetensors`(vae), <https://huggingface.co/Comfy-Org/Qwen-Image-2.1>;需要 ComfyUI v0.37+(`TextEncodeQwenImage21`)
- FLUX.3 Klein Edit:`flux3-image-klein-int8-convrot.safetensors`(diffusion_models)、`qwen3vl_4b_int8_convrot.safetensors`(text_encoders)、`flux2-vae.safetensors`(vae), <https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy>(需先在页面上同意协议)
- MiniMax H3 Image Edit:`minimax_h3_image_pruned_int8_convrot.safetensors`(diffusion_models)、`qwen3vl_32b_minimax_h3_int8_convrot.safetensors` 和 `qwen3.5_9b_w4a8_gptq.safetensors`(text_encoders)、`minimax_h3_image_vae_fp16.safetensors`(vae), DiT 和 VAE 在 <https://huggingface.co/Comfy-Org/MiniMax-H3-Image>,Qwen3-VL-32B 编码器在 <https://huggingface.co/Comfy-Org/MiniMax-H3>,扩写用的 Qwen3.5-9B 在 <https://huggingface.co/Comfy-Org/Qwen3.5>

