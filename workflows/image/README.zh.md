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
- **Flux2 Klein Relight**(`flux2klein-relight.json` + `_preset.json`) , Flux-2 Klein 9B + Sun-direction LoRA(4 步)重打光。images[0] = 主体图,images[1] = 灯光参考(如 Relight 节点的 3d light 渲染,或经 Load Image from Asset 接任意图)。输出尺寸跟随主体图。image stage 的**打光**按钮会自动生成并连好这个工作流。
- **Qwen Product Shot (Canny)**(`qwen-product-shot.json` + `_preset.json`) , 结构锁定的**全重绘**:images[0] → Canny → Qwen-Image-2512 Fun ControlNet-Union + Lightning 4 步 LoRA。只保轮廓,颜色/材质由提示词决定,要显式描述。想保留参考图自身的颜色材质(比如绑好材质的 3D 截图),用图像编辑 stage 的 **Qwen Edit 2511** —— 3D 模型节点的**生成产品图**按钮就是接它。输出尺寸跟随参考图(约 1.6MP)。测试通过。
- **Qwen Image 2.1 T2I**(`qwen-image-2.1-t2i.json` + `_preset.json`) , 官方 Qwen Image 2.1 文生图(int8 DiT + Qwen3-VL-8B int8 编码器,25 步,cfg 1)。原生 2K:分辨率选 **2K** 直出 2048px。提示词接 `TextEncodeQwenImage21`,它一个节点同时出 positive/negative;stage 的负向提示词只有把 cfg 调高才起作用。测试通过(5090 上 1K 约 25 秒一张)。
- **Qwen Image 2.1 Transparent (RGBA)**(`qwen-image-2.1-rgba.json` + `_preset.json`) , 同一张图;preset 用官方模板的 RGBA 句式包住你的提示词,2.1 的 VAE 直接解出 alpha 通道,`SaveImage` 存的就是主体在透明背景上的 RGBA PNG,不经过任何抠图模型。只描述主体即可。测试通过(1024² 怀表,56% 像素全透明)。
- **Qwen Image 2.1 Multi-Ref Edit**(`qwen-image-2.1-multi-ref-edit.json` + `_preset.json`) , 最多 4 张图的指令编辑:images[0] 是编辑目标(输出尺寸跟它),images[1..3] 是参考图。提示词里直接用 stage 的 `@image_1`..`@image_4` 提及(打 `@` 选);preset 设了 `mention_style: qwen_tags`,发给模型时会展开成 `<image1>`..`<image4>`("把 `@image_2` 里的杯子放到 `@image_1` 人物手里")。没接的槽位会自动剪掉,接 1~4 张都能跑。分辨率 / 比例 / 批量不生效。单图编辑用图像编辑 stage 的 **Qwen Image 2.1 Edit**。测试通过。
- **FLUX.3 Klein T2I**(`flux3-klein-t2i.json` + `_preset.json`) , 官方 FLUX.3 Image Klein 蒸馏版文生图:int8 DiT + Qwen3-VL-4B int8 编码器(`CLIPLoader` 类型 `flux3`)+ Flux2 VAE,`KSampler` 16 步,euler / simple,cfg 1,所以没有负面提示词。要带参考图编辑用图像编辑 stage 的 **FLUX.3 Klein Edit**。测试通过(5090 上模型已加载时 1024×1808 约 4 秒)。
- **MOSS-Image T2I**(`moss-image-t2i.json` + `_preset.json`) , 官方 MOSS-Image 文生图:SFT int8 DiT + Qwen3.5-9B w4a8 编码器(`CLIPLoader` 类型 `moss_image`)+ 小号 Flux2 VAE,`KSampler` 25 步,er_sde / simple,cfg 2.5,负面提示词沿用模板里的固定值。它是用整段画面描述训练的,提示词写成完整描述,别只写几个关键词。测试通过(5090 上 1808×1024 约 27 秒)。
- **MiniMax H3 Image T2I**(`minimax-h3-image-t2i.json` + `_preset.json`) , 官方 MiniMax-H3-Image 文生图模板,子图原样保留:int8 DiT + Qwen3-VL-32B int8 编码器(`CLIPLoader` 类型 `minimax`)+ H3 Image VAE,`MiniMaxH3ImageConditioning` → `KSampler` 6 步,euler / simple,cfg 1。模型按 2048×2048 的面积调校,分辨率选 **2K**。提示词按原文发送。打开子图节点上的 `switch`,提示词扩写(`TextGenerateV2` + Qwen3.5-9B)会先把它改写成详细画面描述;5090 上这样约 4 分钟一张,大部分时间花在三个模型的换入换出上。每次运行出一张。测试通过(5090 上 模型已加载时 3616×2048 约 26 秒一张,2048×2048 约 9 秒一张)。

## 需要的模型

- `v1-5-pruned-emaonly.safetensors` , SD1.5 base(~4 GB)
- Ideogram4:`ideogram4_fp8_scaled.safetensors`、`ideogram4_unconditional_fp8_scaled.safetensors`、`qwen3vl_8b_fp8_scaled.safetensors`、`flux2-vae.safetensors`(详见 [docs/models.zh.md](../../docs/models.zh.md))
- Flux2 Klein Relight:`flux-2-klein-9b-nvfp4.safetensors`(diffusion_models)、`Sun_direction_LoRA_Flux_2_Klein_9b_v1.safetensors`(loras)、`qwen_3_8b_fp8mixed.safetensors`(clip)、`flux2-vae.safetensors`(vae)
- Qwen Product Shot:`qwen_image_2512_fp8_e4m3fn.safetensors`(diffusion_models)、`Qwen-Image-2512-Fun-Controlnet-Union-2602.safetensors`(controlnet)、`Qwen-Image-Lightning-4steps-V1.0.safetensors`(loras)、`qwen_2.5_vl_7b_fp8_scaled.safetensors`(clip)、`qwen_image_vae.safetensors`(vae)
- Qwen Image 2.1(T2I / Transparent / Multi-Ref Edit 共用,约 17 GB):`qwen_image_2.1_int8_convrot.safetensors`(diffusion_models)、`qwen3vl_8b_int8_convrot.safetensors`(text_encoders)、`qwen_image_2.1_vae_bf16.safetensors`(vae),都在 <https://huggingface.co/Comfy-Org/Qwen-Image-2.1>。需要带 `TextEncodeQwenImage21` 节点的 ComfyUI(v0.37+)。
- FLUX.3 Klein T2I:`flux3-image-klein-int8-convrot.safetensors`(diffusion_models)、`qwen3vl_4b_int8_convrot.safetensors`(text_encoders)、`flux2-vae.safetensors`(vae), <https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy>(需先在页面上同意协议)
- MOSS-Image T2I:`moss_image_sft_int8_convrot.safetensors`(diffusion_models)、`qwen3.5_9b_w4a8_gptq.safetensors`(text_encoders)、`flux2-vae_small.safetensors`(vae), <https://huggingface.co/Comfy-Org/MOSS-Image>
- MiniMax H3 Image T2I:`minimax_h3_image_pruned_int8_convrot.safetensors`(diffusion_models)、`qwen3vl_32b_minimax_h3_int8_convrot.safetensors` 和 `qwen3.5_9b_w4a8_gptq.safetensors`(text_encoders)、`minimax_h3_image_vae_fp16.safetensors`(vae), DiT 和 VAE 在 <https://huggingface.co/Comfy-Org/MiniMax-H3-Image>,Qwen3-VL-32B 编码器在 <https://huggingface.co/Comfy-Org/MiniMax-H3>,扩写用的 Qwen3.5-9B 在 <https://huggingface.co/Comfy-Org/Qwen3.5>

