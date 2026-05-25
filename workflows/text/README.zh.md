[English](README.md) | **简体中文**

# `text/` 工作流

这个目录下的工作流出现在 **Text Stage** 下拉框。接收提示词 + 可选 context,产出一段文本。

## stage 提供的输入

- **提示词** , stage 的主输入。
- **最大输出长度**(`max_length`) , Text Stage widget。
- **随机 seed**(可选)。

## 工作流需要包含

- 一个文本生成节点,**第 0 个输出**就是字符串。
- 提示词输入接 stage 的提示词。
- LLM / CLIP loader。

文本输出不走 `SaveImage`。结果类型是 `graph_output_first`,ComfyTV 读对应节点的第 0 个缓存输出。**必须在 config 里显式声明这一项** , 自动检测只找 save 类节点,文本工作流通常没有。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **Local Qwen3 4B**(`local-qwen3-4b.json` + `_preset.json`) , Qwen3 4B chat LLM,走 `TextGenerate`(`clip_type=lumina2` 把文件按 chat 模型路由)。

## 需要的模型

模型清单见 [docs/models.zh.md](../../docs/models.zh.md)。
