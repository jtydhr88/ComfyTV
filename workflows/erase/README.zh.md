[English](README.md) | **简体中文**

# `erase/` 工作流

这个目录下的工作流出现在 **Erase** 下拉框。用户在想**去除**的物体上涂抹,点运行,物体消失,涂抹区域由周围环境填充,没有提示词输入。和 **Inpaint** 区分:Inpaint 是"用户描述这片区域应该变成什么",Erase 是"让这片区域消失"。

内置工作流用 LaMa(走 Acly 的 `comfyui-inpaint-nodes` 插件)。

## stage 提供的输入

- **源图**(必需) , 来自上游。
- **mask**(必需) , 用户用 painter widget 涂出的区域。
- 没有提示词。

## 工作流需要包含

- 一个 `SaveImage` 输出节点(自动检测)。
- 一个 `LoadImage` 接源图。
- 一个 `LoadImageMask` 接 mask(`channel = "alpha"`)。
- LaMa(或等价模型)推理:Acly 插件提供的 `INPAINT_LoadInpaintModel` + `INPAINT_InpaintWithModel`。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **LaMa Erase**(`lama-erase.json` + `_preset.json`) , 5 节点工作流:`LoadImage` + `LoadImageMask` → `INPAINT_LoadInpaintModel` + `INPAINT_InpaintWithModel` → `SaveImage`。

## 需要的插件 + 模型

**插件:** [Acly/comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes)

```bash
cd I:/ComfyUI/custom_nodes
git clone https://github.com/Acly/comfyui-inpaint-nodes.git
pip install opencv-python   # 如果还没装
```

**模型:** [big-lama.pt (196 MB)](https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt) → `models/inpaint/`

```bash
cd I:/ComfyUI/models/inpaint
curl -L -O https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt
```

插件和模型都就位后,重启 ComfyUI。
