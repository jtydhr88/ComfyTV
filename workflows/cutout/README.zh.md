[English](README.md) | **简体中文**

# `cutout/` 工作流

这个目录下的工作流出现在 **Cutout** 下拉框。连接一张上游图,返回主体被分割出来、背景替换为透明 alpha 通道的同一张图。

## stage 提供的输入

- **源图**(必需) , 来自上游。没有提示词,没有可调 widget。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `LoadImage` 接源图。
- 一个背景去除节点(BiRefNet、BriaRMBG 等),同时输出 `IMAGE`(主体)和 `MASK`。
- 一个 `JoinImageWithAlpha` 或等价节点把主体 + mask 合成透明背景 PNG(部分分割链内部已经做了这步)。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **BiRefNet Cutout**(`birefnet-cutout.json` + `_preset.json`) , 改自 ComfyUI 的 `utility_birefnet_remove_background` 模板。顶层:`LoadImage` → BiRefNet 子图 → `SaveImage`。子图封装 `RemoveBackground` / `LoadBackgroundRemovalModel` / `InvertMask` / `JoinImageWithAlpha`。

## 需要的模型

- `birefnet.safetensors` , 放进 `models/background_removal/`,约 900 MB。下载:<https://huggingface.co/Comfy-Org/BiRefNet/resolve/main/background_removal/birefnet.safetensors>
