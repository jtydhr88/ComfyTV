[English](README.md) | **简体中文**

# `outpaint/` 工作流

这个目录下的工作流出现在 **Outpaint** 下拉框。用户拖拽 handles 扩展画布,工作流按提示词画出新区域,同时保留原图。

## stage 提供的输入

- **源图**(必需) , 来自上游。
- **提示词** , 扩展区域应该填什么。
- **四个方向的扩展像素数**(`pad_left` / `top` / `right` / `bottom`) , 用户拖 handle 出来,没扩展的一边是 0。
- **羽化像素数**(默认 40) , 软边缘。
- **随机 seed**。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `LoadImage` 接源图。
- 一个 `ImagePadForOutpaint`,四方向 pad + feathering 都接 stage 的对应输入。它同时产出填充图和覆盖新区域的自动 mask,不需要 painter。
- 一个 `CLIPTextEncode` 接提示词。
- 模型对应的 inpaint conditioning(Flux Fill 用 `InpaintModelConditioning`)。
- `KSampler` 一个,用 stage 的 seed。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **Flux Fill Outpaint**（`flux-fill-outpaint.json` + `_preset.json`）, Flux Fill Dev fp8 outpaint，走 `ImagePadForOutpaint` + `InpaintModelConditioning`。测试通过。**不依赖第三方插件。**
- **Fooocus SDXL Outpaint**（`fooocus-sdxl-outpaint.json` + `_preset.json`）, 改自 Acly 的 `comfyui-inpaint-nodes` 插件 `outpaint.json` 模板。SDXL base + Fooocus inpaint head/patch + `MaskedFill` / `MaskedBlur` 预填新 pad 区域。**需要安装插件 + 额外模型文件** , 见下文「可选：Fooocus 变种」。

## 需要的模型

**Flux Fill Outpaint：**
- `flux1-fill-dev_fp8.safetensors` , 和 Flux Fill Inpaint 同一个模型
- `clip_l.safetensors` + `t5xxl_fp16.safetensors` , 放进 `models/clip/`
- `ae.safetensors` , 放进 `models/vae/`

## 可选：Fooocus SDXL 变种

Fooocus 变种走 Acly 的 [`comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes) 插件（同 LaMa Erase / Fooocus Inpaint 是同一个插件）。下拉框选「Fooocus SDXL Outpaint」前：

1. **安装插件**（如果 Erase / Inpaint 已经装过就跳过）：
   ```bash
   cd I:/ComfyUI/custom_nodes
   git clone https://github.com/Acly/comfyui-inpaint-nodes.git
   pip install opencv-python
   ```
2. **下载 Fooocus inpaint 文件**，按插件 README（[Acly/comfyui-inpaint-nodes#installation](https://github.com/Acly/comfyui-inpaint-nodes#installation)）说明，放进 `I:/ComfyUI/models/inpaint/`：
   - `fooocus_inpaint_head.pth`（~3 MB）
   - `inpaint_v26.fooocus.patch`（~1.3 GB）
3. **准备一个 SDXL checkpoint** 在 `models/checkpoints/`。preset 默认用 `animagine-xl-3.1.safetensors`,要换在侧边栏改 CheckpointLoader 的模型名即可。
4. 重启 ComfyUI 让插件的节点注册。

