[English](README.md) | **简体中文**

# `sequence/` 工作流

这个目录下的工作流出现在 **Image Variations** 下拉框(当 stage 的 `workflow_kind` 是 `sequence` 时)。概念上和 [`multiview/`](../multiview/README.zh.md) 类似 , 一次运行出 N 张图,但分支是**串行链式**:第 N+1 帧用第 N 帧作为输入。输出是一组 N 张连续画面。

用途:故事板预览、剧情演化、"接下来发生什么"式迭代生成。每帧用上一帧作视觉参考,保持风格 + 角色的连贯性。

## stage 提供的输入

- **源图 / 种子图**(必需) , 第一帧的输入。
- **提示词** , 场景 / 故事描述。内置工作流里每条分支自动在前面拼上各自的故事节奏(第 1 帧 = 设置场景、第 2 帧 = 动作展开等)。

## 工作流需要包含

和 multiview 框架一致,但:

- **链式 latent** , 每条分支自己有 `VAEEncode`,接前一条分支的解码输出。分支 0 接源图;分支 N 接分支 (N-1) 的输出。
- **模型 + LoRA 共享**,但 **每条分支独立 latent 路径**(不像 multiview 共享一个基础 latent)。
- N 个 `SaveImage`,每帧一个,全部会被合到同一组图。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

都用 Qwen-Image-Edit 2511 + **Next-Scene LoRA**：

| 标签 | 文件 | 帧数 |
|---|---|---|
| **Story 4** | `qwen-next-scene-4.json` | 4 |
| **Storyboard 25** | `qwen-next-scene-25.json` | 25 |

## 需要的模型

- `qwen_image_edit_2511_fp8mixed.safetensors` → `models/diffusion_models/`
- `qwen_2.5_vl_7b_fp8_scaled.safetensors` → `models/clip/`
- `qwen_image_vae.safetensors` → `models/vae/`
- `next-scene_lora-v2-3000.safetensors` → `models/loras/`
- `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` → `models/loras/`

