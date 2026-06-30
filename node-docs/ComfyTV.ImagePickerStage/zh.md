> 从一批图片里**只选一张**继续编辑，并附带完整操作工具栏——ComfyTV 里连接「生成」与「精修」的枢纽节点。

## 这个节点是做什么的

**图片选择器**（Image Picker）属于 **Compose** 分类。上游常接 **Image Stage**、**Grid Split**、**Image Variations**、**Panorama Multi-View** 等产出**多张图**的 stage。本节点展示缩略图条，你点哪张，**image** 输出口就只向下游传递那一张 `COMFYTV_IMAGE`。

选中后会出现 **操作工具栏**：`✏️ Edit`（裁剪/旋转等）、`🌐 Panorama`、`📐 Multiangle`、`💡 Relight`、各类变体 preset 等——相当于 ComfyTV 的「选中即开工」菜单。

**Image Stage 第一次 ▶ 运行** 时，ComfyTV 会**自动**在下游创建一个 Image Picker，新手无需手动添加。

## 适用场景

- 文生图一次出 4–8 张，挑最满意的一张做 Inpaint / Upscale。
- 把 **Grid Split** 或 **Multi-View** 的多格结果汇总到一个池子里慢慢挑。
- 多次 Run 上游，希望**累积**候选图而不丢旧结果（pool 机制）。
- 需要工具栏快速 spawn 编辑子图，而不是手动拖 Crop / Edit 节点。

## 工作原理（为什么 ComfyTV 这样设计）

- **无 ▶ 运行**：点缩略图即更新 `selected_index` 与输出快照，浏览器即时响应。
- **batch 口**：接受 `COMFYTV_IMAGES`（批量 JSON）或单张 `COMFYTV_IMAGE`（视为 1 张的批量）。
- **pool（累积池）**：隐藏 JSON 字段 `{images:[...]}`。UI 会把上游新批量**追加**进池（按 `image_url` 去重），断开上游或重跑上游后池内容仍可保留，方便 A/B 对比候选。点 **Clear** 清空池。
- **快照**：下游 stage Run 时用当前选中图 URL；改选缩略图会改变下游读到的快照。
- **为何用 COMFYTV 类型**：ComfyTV 用 URL 快照在项目间持久化；ComfyUI 内存图像 无法直接跨 stage 保存。需 Bridge 转换（见下表）。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGES` | 多图 JSON 批量 | 接 **batch** 口 |
| `COMFYTV_IMAGE` | 单图 URL 快照 | **image** 输出口；也可接 batch（当 1 张批量） |
| 原生 `IMAGE` | ComfyUI 内存图像 | 先 **→ ComfyTV Image(s)** Bridge |

**如何转换：** [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### batch（上游批量）

- **是什么**：唯一可见的连线输入；类型 `COMFYTV_IMAGES` 或 `COMFYTV_IMAGE`。
- **填什么**：接 Image Stage 的 **images**、Grid Split 的 **images** 等。
- **影响**：新 batch 到达时 UI 合并进 pool 并显示缩略图条。
- **误区**：只连 **image**（单张）口也能工作，但批量生成应连 **images**。

### selected_index（隐藏）

- 1 起始序号；**点击缩略图**时 UI 写入。决定 **image** 输出取池中第几张。

### pool（隐藏）

- 累积池 JSON；UI 管理追加/去重/Clear。手动改 workflow JSON 一般不需要。

### 工具栏（节点 UI）

- 选中缩略图后出现；各按钮 spawn 对应编辑/生成 stage 并预填当前图。
- 详见 [compose.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) 与 [getting-started.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md)。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | 当前选中单图快照 | 任意 Image 编辑 stage、Video Stage（I2V）、Compare 的 image_a/image_b |

## 新手一步一步

1. 添加 **Project** + **Image Stage**，填 prompt，选 workflow（如 Local SD1.5）。
2. **▶ 运行** Image Stage——ComfyTV 自动插入 **Image Picker**（若尚未有）。
3. 在 Picker 缩略图条上**点击**最满意的一张；观察工具栏出现。
4. （可选）点 `✏️ Edit` 进入裁剪，或手动连 **Upscale** 等。
5. 在下游 stage **▶ 运行** 处理选中图。
6. （可选）再次 Run Image Stage 增加候选；旧图留在 pool，除非点 **Clear**。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：直接在 Image Stage 上点缩略图不行吗？**  
A：Image Stage 的 **image** 输出也有 **selected_index**；Picker 额外提供 **池子累积**、专用工具栏，以及合并多个上游批量。

**Q：为什么要用 COMFYTV 类型？**  
A：URL 快照会随项目保存，下游 stage 可独立 Run。原生插件输出需经 Bridge 转换。

**Q：池子太乱怎么办？**  
A：在界面点 **Clear**，或新建一个 Picker 节点。

**Q：没有工具栏？**  
A：必须 **单击** 选中缩略图，不能只悬停。

**Q：加载和生成有什么区别？**  
A：Loader 导入已有文件；Image Stage 生成批量图。生成后先用 Picker（或 Stage 选图）再编辑。

## 相关节点

- **Image Stage** —— 常见上游；首次 Run 自动创建 Picker。
- **Shot Images** —— 分镜批量；可再接 Picker 挑单镜。
- **Compare** —— 对比改前改后（需两张独立 `COMFYTV_IMAGE`）。
- **Grid Split** / **Image Variations** / **Panorama Multi-View** —— 多图上游。
- **→ ComfyTV Images** —— 原生批量转入。
