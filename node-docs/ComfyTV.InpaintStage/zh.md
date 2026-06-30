> 用蒙版画笔选定区域，按提示词 AI 重绘该处，点 ▶ 运行 `workflows/inpaint/` 工作流。

## 这个节点是做什么的

**Inpaint（重绘）** 让你在上游图片上**涂出一块蒙版**，再输入 **main_prompt** 描述「蒙版里应该出现什么」，Run 后模型只重生成被涂区域，其余尽量保持。

这是 **生成式** Stage（需 **▶ 运行**），和 **Erase**（无 prompt、抹掉物体）相对。工作流目录：[`workflows/inpaint/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/inpaint)。

## 适用场景

- 换掉路人的脸、改服装颜色、加/减小物件
- 修正 AI 生成图的局部瑕疵
- Image Picker「重绘」+ 蒙版画笔
- 重绘后 **Upscale** 统一清晰度

## 工作原理

- **蒙版画笔 UI** 把笔迹序列化到隐藏字段 `mask_data`；Run 时 ComfyTV 烘进 workflow 的 LoadImageMask 或 alpha 通道。
- **Stage 只跑本节点**子 workflow，不 Queue 整图。
- **快照**：下游用上次 Inpaint 结果，除非你再次 Run Inpaint。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_IMAGE` | 源图与结果 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### 蒙版画笔（Mask Painter）— 新手必读

源图预览上叠加绘图层，工具栏包括：

| 工具 | 作用 |
|---|---|
| **✏️ 画笔** | 涂出要重绘的区域（蒙版） |
| **🧽 橡皮** | 擦掉已涂蒙版 |
| **▭ 矩形 / ◯ 椭圆** | 拖出形状（可辅助标注） |
| **① 标号** | 点击添加自动编号标记（便于多区域说明） |
| **笔刷大小 / 不透明度 / 硬度** | 控制涂抹边缘软硬 |
| **颜色** | 画笔与形状显示色（不影响生成结果） |
| **Clear** | 清空整层蒙版 |

**要点**：蒙版=「要改哪里」；**main_prompt**=「改成什么」。只涂要改的区域，不必涂满整张图。

### image（输入）

源图 `COMFYTV_IMAGE`。

### workflow

[inpaint README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/inpaint/README.zh.md)

| 内置 | 说明 |
|---|---|
| **Flux Fill Inpaint** | 推荐；需 flux1-fill-dev + 文本编码器 + ae |
| **Fooocus SDXL Inpaint** | 需 comfyui-inpaint-nodes 插件 |

模型：[models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)

### main_prompt

描述**蒙版区域内**应出现的内容，例：*「一把木椅」*、*「空白墙面」*。不要重写整张场景。

### mask_data（隐藏）

画笔数据 JSON，由 UI 写入。

### 自定义参数（custom_params）

侧栏随机种子（seed）等。

## 输出说明

| 输出 | 类型 |
|---|---|
| **image** | `COMFYTV_IMAGE` 重绘后全图 |

## 新手一步一步

1. 添加 **Inpaint**，上游接 **Image Picker** 的图。
2. workflow 选 **Flux Fill Inpaint**（确认模型已下载）。
3. 用 **✏️ 画笔**涂要修改的区域（可调笔刷大小）。
4. **main_prompt** 写蒙版内目标内容。
5. 点 **▶ 运行**。
6. 不满意：橡皮修蒙版 / 改 prompt / 侧栏换随机种子 → 再 Run。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/inpaint |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/inpaint/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：整张图都变了？**  
A：蒙版太大或 prompt 描述了整个场景——缩小蒙版并收窄描述。

**Q：蒙版没生效？**  
A：Run 前确认蒙版可见；避免误点 Clear。

**Q：和 Erase 有什么区别？**  
A：Inpaint 用 prompt 生成新内容；Erase 是无 prompt 的擦除与填充。

## 相关节点

- **Erase** — 无 prompt 擦除
- **Outpaint** — 扩画布（不用画笔）
- **Image Edit** — 整图指令改
- **Upscale**
