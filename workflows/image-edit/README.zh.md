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

- **Flux Canny Edit**(`flux-canny-edit.json` + `_preset.json`) , 把上游图作 Canny 边缘图,按提示词重画。测试通过。

## 需要的模型

- `flux1-canny-dev_fp8.safetensors` , 放进 `models/diffusion_models/`
- `clip_l.safetensors` + `t5xxl_fp16.safetensors` , 放进 `models/clip/`
- `ae.safetensors` , 放进 `models/vae/`

