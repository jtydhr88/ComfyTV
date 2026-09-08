[English](README.md) | **简体中文**

# `custom/` 工作流

这个目录里的工作流会出现在 **Custom Stage（自定义节点）** 的下拉框里。这里不内置任何工作流，这个类别就是给你自己的工作流用的。

## 阶段输入

没有固定输入。在画布上选中节点，点卡片上的 **暴露输入输出**，勾选要暴露的工作流节点。媒体加载器（`LoadImage`、`LoadVideo`、`LoadAudio`、`Load3D`）变成接口，`STRING` 控件变成带卡片编辑框的文本接口，其它控件变成卡片上的参数。

## 工作流需要什么

- 至少一个可暴露的输出节点：`SaveImage` / `PreviewImage`（图像或批次）、`SaveVideo` / `VHS_VideoCombine`（视频）、`SaveAudio*`（音频）、`SaveGLB`（3D 模型），或 `PreviewAny` / `ShowText` 这类文本预览节点（文本）。
- 用普通的 GUI 格式保存（不是「Save (API Format)」）。

暴露定义以普通绑定 + `meta.custom_io` 保存，和其它工作流一样可以导出成 `_preset.json`。见 [docs/custom-workflows.md](../../docs/custom-workflows.md)。
