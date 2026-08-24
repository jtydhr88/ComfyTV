[English](models.md) | **简体中文**

# 自带工作流所需的模型文件

ComfyTV 在 `workflows/<kind>/` 下面预置了一套精选的 ComfyUI 工作流。每个工作流都引用了若干模型文件,**这些文件 ComfyUI 自己必须能在`ComfyUI/models/` 树下找到**。本页按工作流列出每个所需的文件和它们应该放在哪个子目录。

> 如果你想用**自己的** ComfyUI 工作流(换模型、换 sampler、换 LoRA),上面这些都不需要下 , 见 [custom-workflows.zh.md](custom-workflows.zh.md),里面说明了怎么把自定义工作流 JSON + `_preset.json` 绑定接进来。

ComfyUI 通常会在首次启动时自动建好所有子目录;缺哪个手动建一下即可。下面所有目录都是相对于 `ComfyUI/models/` 的相对路径。

---

## Generate · 文本(Text)

| 工作流 | 文件 | 目录 |
|---|---|---|
| **Local Qwen3 4B** | `qwen_3_4b.safetensors` | `text_encoders/` |

下载:<https://huggingface.co/Comfy-Org/flux2-klein/tree/main/split_files/text_encoders>

---

## Generate · 图像(Image)

| 工作流 | 文件 | 目录 |
|---|---|---|
| **Local SD1.5** / **Local SD1.5 I2I** | `v1-5-pruned-emaonly-fp16.safetensors` | `checkpoints/` |
| **Image Ideogram4 T2I** | `ideogram4_fp8_scaled.safetensors`、`ideogram4_unconditional_fp8_scaled.safetensors`、`qwen3vl_8b_fp8_scaled.safetensors`、`flux2-vae.safetensors` | `diffusion_models/`、`diffusion_models/`、`text_encoders/`、`vae/` |

---

## Generate · 视频(LTX 2.3)

4 个变体共用同一套 base 模型 + 文本编码器 + LoRA。

| 工作流 | 文件 | 目录 |
|---|---|---|
| **Local LTX 2.3 T2V** | `ltx-2.3-22b-dev-fp8.safetensors`、`ltx-2.3-spatial-upscaler-x2-1.1.safetensors`、`ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors`、`gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors`、`gemma_3_12B_it_fp4_mixed.safetensors` | `checkpoints/`、`latent_upscale_models/`、`loras/`、`loras/`、`text_encoders/` |
| **Local LTX 2.3 I2V** | 同 T2V | 同 |
| **Local LTX 2.3 FLF2V** | `ltx-2.3-22b-distilled-fp8.safetensors`、`gemma_3_12B_it_fp4_mixed.safetensors` | `checkpoints/`、`text_encoders/` |
| **Local LTX 2.3 IA2V** | 同 T2V/I2V | 同 |

下载:
- <https://huggingface.co/Lightricks/LTX-2.3-fp8>
- <https://huggingface.co/Lightricks/LTX-2.3>
- <https://huggingface.co/Comfy-Org/ltx-2.3>
- <https://huggingface.co/Comfy-Org/ltx-2>

---

## Generate · 视频(MiniMax H3)

三个变体共用文本编码器和两个 VAE;FL2VA 双工作流与 Ref2VA 的扩散模型和 Turbo LoRA 不同。

| 工作流 | 文件 | 目录 |
|---|---|---|
| **Local MiniMax H3 T2V** / **FLF2V** | `minimax_h3_fl2va_pruned_int8_convrot.safetensors`、`qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`、`minimax_h3_video_vae_fp16.safetensors`、`minimax_h3_audio_vae_fp32.safetensors`、`minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` *(Lightning,可选)* | `diffusion_models/`、`text_encoders/`、`vae/`、`vae/`、`loras/` |
| **Local MiniMax H3 R2V**(多参考) | `minimax_h3_ref2va_pruned_int8_convrot.safetensors`、文本编码器 + 双 VAE 同上、`minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` *(Lightning,可选)* | `diffusion_models/`、…、`loras/` |

**Lightning** LoRA 把生成压到 8 步(FL2VA)/ 4 步(Ref2VA),耗时约减半,自带工作流已接好;不下这个文件也能按全步数正常跑。

下载:
- Base + 文本编码器 + VAE:<https://huggingface.co/Comfy-Org/MiniMax-H3>
- FL2VA Turbo LoRA:<https://huggingface.co/lightx2v/Minimax-h3-Turbo>

---

## Generate · 音频(Audio)

| 工作流 | 文件 | 目录 |
|---|---|---|
| **ACE-Step v1 Song** | `ace_step_v1_3.5b.safetensors` | `checkpoints/` |
| **MiniMax Music 3** | `minimax_music3_dit_fp16.safetensors`、`minimax_music3_text_encoder_pruned_int8_convrot.safetensors`、`minimax_music3_dav.safetensors` | `diffusion_models/`、`text_encoders/`、`vae/` |

ACE-Step v1 和 MiniMax Music 3 都是 ComfyUI 核心原生支持,不需要装额外的 custom node。

下载:<https://huggingface.co/Comfy-Org/MiniMax-Music-3>

---

## Generate · 3D 模型(3D Model)

| 工作流 | 文件 | 目录 |
|---|---|---|
| **Hunyuan3D 2.1**(图生网格) | `hunyuan_3d_v2.1.safetensors` | `checkpoints/` |
| **MoGe-2 Mesh**(图生几何) | `moge_2_vitl_normal_fp16.safetensors` | `geometry_estimation/` |
| **TripoSplat Gaussian**(图生高斯泼溅) | `triposplat_fp16.safetensors`、`dino_v3_vit_h.safetensors`、`flux2-vae.safetensors`、`triposplat_vae_decoder_fp16.safetensors`、`birefnet.safetensors` | `diffusion_models/`、`clip_vision/`、`vae/`、`vae/`、`background_removal/` |

下载:
- Hunyuan3D 2.1:<https://huggingface.co/Comfy-Org/hunyuan3D_2.1_repackaged>
- MoGe-2:<https://huggingface.co/Comfy-Org/MoGe_safetensors>
- TripoSplat:<https://huggingface.co/VAST-AI/TripoSplat>
- BiRefNet(背景去除):<https://huggingface.co/Comfy-Org/BiRefNet>

---

## 图像编辑(Edits)

| 工作流 | 文件 | 目录 |
|---|---|---|
| **Flux Canny Edit**(image-edit) | `flux1-canny-dev.safetensors`、`t5xxl_fp16.safetensors` *(或 `t5xxl_fp8_e4m3fn_scaled.safetensors`)*、`clip_l.safetensors`、`ae.safetensors` | `diffusion_models/`、`text_encoders/`、`text_encoders/`、`vae/` |
| **Flux Fill Inpaint**(inpaint) | `flux1-fill-dev.safetensors`、t5 + clip\_l + ae(同上) | `diffusion_models/`、`text_encoders/`、`text_encoders/`、`vae/` |
| **Fooocus SDXL Inpaint**(inpaint) | `juggernautXL_version6Rundiffusion.safetensors`、`fooocus_inpaint_head.pth` | `checkpoints/`、`inpaint/` |
| **Flux Fill Outpaint**(outpaint) | 同 Flux Fill Inpaint | 同 |
| **Fooocus SDXL Outpaint**(outpaint) | 同 Fooocus SDXL Inpaint | 同 |
| **LaMa Erase**(erase) | `big-lama.pt` | `inpaint/` |
| **BiRefNet Cutout**(cutout) | `birefnet.safetensors` | `background_removal/` |
| **Ultrasharp 4x**(upscale) | `4x-UltraSharp.pth` | `upscale_models/` |

下载:
- Flux dev:<https://huggingface.co/Comfy-Org/flux1-dev>
- t5xxl / clip_l:<https://huggingface.co/comfyanonymous/flux_text_encoders>
- VAE(ae.safetensors):<https://huggingface.co/Comfy-Org/Lumina_Image_2.0_Repackaged>
- LaMa Erase:需要安装 [`Acly/comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes) 来提供 `INPAINT_LoadInpaintModel` 节点 + 仓库里的 `big-lama.pt`。
- Fooocus inpaint head:Fooocus inpaint patch 自带(`fooocus_inpaint_head.pth`)。
- BiRefNet:ComfyUI 核心原生支持(`LoadBackgroundRemovalModel` + `RemoveBackground`);<https://huggingface.co/Comfy-Org/BiRefNet>

---

## 图像变体(单工作流 N 输出)

"多视角"(Face / Product / Character / Multi-cam 9)和"序列" (Story 4 / Storyboard 25)两类 preset 共用同一套 Qwen base,**只是 LoRA 不同**。

| 组 | 文件 | 目录 |
|---|---|---|
| **Multi-cam / 3-view 套** | `qwen_image_edit_2511_fp8mixed.safetensors`、`Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors`、`qwen-image-edit-2511-multiple-angles-lora.safetensors`、`qwen_2.5_vl_7b_fp8_scaled.safetensors`、`qwen_image_vae.safetensors` | `diffusion_models/`、`loras/`、`loras/`、`text_encoders/`、`vae/` |
| **Story 4 / Storyboard 25** | `qwen_image_edit_2509_bf16.safetensors`、`Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors`、`next-scene-qwen-image-lora-2509.safetensors`、`qwen_2.5_vl_7b_fp8_scaled.safetensors`、`qwen_image_vae.safetensors` | `diffusion_models/`、`loras/`、`loras/`、`text_encoders/`、`vae/` |
| **Multiangle**(3D 相机驱动) | 同上面 multi-view 套 | 同 |

下载:
- Qwen Image Edit base:<https://huggingface.co/Comfy-Org/Qwen-Image-Edit_ComfyUI>
- Qwen Image base:<https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI>
- Lightning 4-step LoRA:<https://huggingface.co/lightx2v/Qwen-Image-Edit-2511-Lightning>
- Multiple-Angles LoRA:一般在 <https://huggingface.co/PVC-Inc/Qwen-Image-Edit-2511-Multiple-Angles-LoRA>
- Next-Scene LoRA:<https://huggingface.co/lovis93/next-scene-qwen-image-lora-2509>

---

## Relight

| 工作流 | 文件 | 目录 |
|---|---|---|
| **Flux2 Klein Relight** | `flux-2-klein-9b-nvfp4.safetensors`、`Sun_direction_LoRA_Flux_2_Klein_9b_v1.safetensors`、`qwen_3_8b_fp8mixed.safetensors`、`flux2-vae.safetensors` | `diffusion_models/`、`loras/`、`text_encoders/`、`vae/` |

---

## 全景(Panorama)

| 工作流 | 文件 | 目录 |
|---|---|---|
| **Qwen-Image-Edit 2511 Image-to-Panorama**(图生全景) | `qwen_image_edit_2511_bf16.safetensors` *(或 fp8mixed)*、`Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors`、`qwen_2.5_vl_7b_fp8_scaled.safetensors`、`qwen_image_vae.safetensors` | `diffusion_models/`、`loras/`、`text_encoders/`、`vae/` |
| **Qwen-Image 2512 + 360 LoRA**(文生全景) | `qwen_image_2512_fp8_e4m3fn.safetensors`、`Qwen-Image-2512-Lightning-4steps-V1.0-fp32.safetensors`、`qwen-360-diffusion-2512-int8-bf16-v2.safetensors`、`qwen_2.5_vl_7b_fp8_scaled.safetensors`、`qwen_image_vae.safetensors` | `diffusion_models/`、`loras/`、`loras/`、`text_encoders/`、`vae/` |

360 LoRA 下载:<https://huggingface.co/ProGamerGov/qwen-360-diffusion>

---

## 第三方 custom node 依赖

少数工作流依赖第三方 ComfyUI custom node:

- **LaMa Erase** → [`Acly/comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes)
- **Fooocus SDXL Inpaint / Outpaint** → 用的 `INPAINT_*` 节点也由`comfyui-inpaint-nodes` 提供。
- **Audio Stem Split** 分轨(人声/鼓/贝斯/……)是**内置能力**——不需要第三方节点,也不需要下载模型。

其它工作流只用 ComfyUI 核心节点。

---

## 不想用自带工作流?

不必下上面任何东西。ComfyTV 能跑任意 ComfyUI GUI 工作流 JSON,只要放进 `workflows/<kind>/` 下面,再写一份 `_preset.json` 把 stage 的输入映射到工作流节点上即可。在常规 ComfyUI 里搭好工作流、保存、放进来、重启 ComfyUI,对应 stage 的工作流下拉里就会出现这个新选项。

`_preset.json` 的格式和实例见 [custom-workflows.zh.md](custom-workflows.zh.md)。
