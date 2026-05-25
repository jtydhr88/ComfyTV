[English](README.md) | **简体中文**

# `shot-images/` 工作流

这个目录下的工作流出现在 **Shot Images** 下拉框。按 Storyboard 的镜头列表逐 shot 出图,每个 shot 一张。

## stage 提供的输入

- **提示词** , 通常是 per-shot 提示词,host stage 内部按 shot 迭代调用。
- **分辨率**、**比例** 等 , 跟 Image Stage 一样。

## 和 `image/` 的关系

大多数 t2i 工作流既能当 Image Stage 用,也能当 Shot Images 用 , 同一个文件,只是被调 N 次,每次喂不同提示词。作者通常把工作流文件放在 `image/` 下,在 config 里声明 `kinds: ["image", "shot-images"]`,两个下拉框都能选到。

只有当某个工作流**专门**给 Shot Images 用、不想出现在 Image Stage 下拉里时,才放到这个文件夹。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

无。当前 Shot Images 下拉里的选项都来自 `image/` 里声明了多 kind 的工作流。
