[English](README.md) | **简体中文**

# `inpaint/` 工作流

这个目录下的工作流出现在 **Inpaint** 下拉框。用户在源图上涂抹 mask,工作流按提示词重新生成被涂的区域。

## stage 提供的输入

- **源图**(必需) , 来自上游。
- **mask**(必需) , 用户用 painter widget 涂出的区域。
- **提示词** , 被 mask 的区域应该变成什么。
- **随机 seed**。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `LoadImage` 接源图。
- 一个 `LoadImageMask` 接 mask(`channel = "alpha"`)。
- 一个 `CLIPTextEncode` 接提示词。
- 模型对应的 inpaint conditioning(Flux Fill 用 `InpaintModelConditioning`、SD1.5 用 `VAEEncodeForInpaint`)。
- `KSampler` 一个,`denoise=1.0` 完全重生成被 mask 区域。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **Flux Fill Inpaint**(`flux-fill-inpaint.json` + `_preset.json`) , Flux Fill Dev fp8 inpaint,子图工作流。测试通过。**不依赖第三方插件。**
- **Fooocus SDXL Inpaint**(`fooocus-sdxl-inpaint.json` + `_preset.json`) , 改自 Acly 的 `comfyui-inpaint-nodes` 插件 `inpaint-refine.json` 模板。SDXL base + Fooocus inpaint head/patch。**需要安装插件 + 额外模型文件** , 见下文「可选:Fooocus 变种」。

## 需要的模型

**Flux Fill Inpaint:**
- `flux1-fill-dev_fp8.safetensors` , 放进 `models/diffusion_models/`
- `clip_l.safetensors` + `t5xxl_fp16.safetensors` , 放进 `models/clip/`
- `ae.safetensors` , 放进 `models/vae/`

## 可选:Fooocus SDXL 变种

Fooocus 变种走 Acly 的 [`comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes) 插件提供的 inpaint head + patch 节点(同 LaMa Erase 是同一个插件)。下拉框选「Fooocus SDXL Inpaint」前:

1. **安装插件**(如果 Erase 已经装过就跳过):
   ```bash
   cd I:/ComfyUI/custom_nodes
   git clone https://github.com/Acly/comfyui-inpaint-nodes.git
   pip install opencv-python
   ```
2. **下载 Fooocus inpaint 文件**,按插件 README([Acly/comfyui-inpaint-nodes#installation](https://github.com/Acly/comfyui-inpaint-nodes#installation))说明操作。文件放进 `I:/ComfyUI/models/inpaint/`:
   - `fooocus_inpaint_head.pth`(~3 MB)
   - `inpaint_v26.fooocus.patch`(~1.3 GB)
3. **准备一个 SDXL checkpoint** 在 `models/checkpoints/`。preset 默认用 `animagine-xl-3.1.safetensors`,要换在侧边栏改 CheckpointLoader 的模型名即可。
4. 重启 ComfyUI 让插件的节点注册。
