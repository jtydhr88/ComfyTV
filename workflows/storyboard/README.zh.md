[English](README.md) | **简体中文**

# `storyboard/` 工作流

这个目录下的工作流出现在 **Storyboard** 下拉框。接收一段故事/前提提示词,产出一份结构化镜头表(**不是图** , 逐 shot 的图在下游的 Shot Images stage 出)。

## stage 提供的输入

- **提示词** , 用户的故事前提 / brief。

## 工作流需要包含

- 一个能输出 JSON 字符串的文本生成节点,JSON 结构匹配 `COMFYTV_STORYBOARD` 形状:`{"shots": [{shot_no, duration, prompt, scene_purpose, character, ...}]}`。
- 提示词输入接 LLM 的 prompt 端。
- 结果走 `graph_output_first` 取该节点的第 0 个输出。

完整字段定义参见 `nodes/stages.py` 里的 `_fake_storyboard`。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

无 , 当前的 Qwen / Flux storyboard 选项是 `runners/__init__.py` 里手写的占位 stub。把工作流 + config 放进这个文件夹可以替代它们。
