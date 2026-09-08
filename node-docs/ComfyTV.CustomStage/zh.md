# 自定义节点 (Custom Stage)

> 把任意 ComfyUI 工作流变成一张 ComfyTV 卡片：由你决定它对外暴露哪些节点的输入和输出。

## 这个节点是做什么的

**Custom Stage** 包装 `custom/` 库里的工作流。它没有固定契约（提示词 + 图 → 图），而是在卡片上点 **暴露输入输出**，勾选要暴露到外面的原生节点：

- **输入** — `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` 的文件选择变成 `image` / `video` / `audio` / `model` 接口；`STRING` 控件变成 `text` 接口，并在卡片上有可编辑文本框；`INT` / `FLOAT` / `BOOLEAN` / 下拉控件变成卡片上直接编辑的参数。
- **输出** — `SaveImage` / `SaveVideo` / `SaveAudio` / `SaveGLB` 以及文本预览节点变成 `image`（或 `images` 批次）/ `video` / `audio` / `model` / `text` 输出。第一个暴露的输出就是卡片预览。

每一项都可以改名；名称会显示在接口和卡片上。媒体输入可以标记为必填。

## 运行方式

- ▶ 运行只执行这一个工作流。已连线的接口注入到对应节点；文本和参数来自卡片（已连线的 `text` 接口优先于手填值）。
- 所有暴露的输出在一次运行里一起收集并落到各自接口；主输出作为阶段快照保存，刷新后仍在。
- 暴露定义属于**工作流**，选同一个工作流的所有 Custom Stage 共用；参数值是每张卡片各自的。

## 说明

- 仅支持 V2 皮肤，请在 ComfyTV 设置里开启。
- 每种类型最多一个输出。图像输出可切换 **批量** 变成 `images`。
- 工作流库目录是 `user/comfytv/workflows/custom/`；底部的 **🔗 关联工作流** 可以直接从 ComfyUI 自己的工作流库添加。
