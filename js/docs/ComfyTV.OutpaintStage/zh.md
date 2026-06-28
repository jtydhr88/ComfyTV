> 把画布向外扩展并用 AI 填充新区域，拖边距手柄 + 描述整图，点 ▶ 运行。

## 这个节点是做什么的

**Outpaint（扩图）** 在原有图片四周**加大画布**，用扩散模型根据提示词生成扩展区域的内容，同时尽量保留原图中心。你在预览里拖 **上/下/左/右** 扩展手柄（或填 pad 像素），再写 **main_prompt** 描述**整张成品**长什么样。

这是 **生成式** Stage，需 **▶ 运行**。工作流来自 [`workflows/outpaint/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/outpaint)。

## 适用场景

- 横图改竖构图、给主体留呼吸空间
- 分镜需要更宽的环境，但不重画整张
- Image Picker「扩图」预设
- 扩完再 **Upscale** 或 **Relight**

## 工作原理

- ComfyTV 把 `pad_left/top/right/bottom`、`feathering` 传给 workflow 的 `ImagePadForOutpaint`；**不需要**蒙版画笔。
- **main_prompt** 应描述**完整场景**（主体 + 环境 + 风格 + 光照），不要写「把左边延长」这类指令。
- Run 一次 → 快照；改 pad 或 prompt 后需重新 Run。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_IMAGE` | 输入/输出均为单图快照 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

源图 `COMFYTV_IMAGE`。

### workflow

[`workflows/outpaint/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/outpaint) — [README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/outpaint/README.zh.md)

| 内置 | 模型要点 |
|---|---|
| **Flux Fill Outpaint** | `flux1-fill-dev` + t5 + clip_l + ae |
| **Fooocus SDXL Outpaint** | 需 [comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes) + SDXL checkpoint |

详见 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)

### 扩展手柄 / pad_*（隐藏）

拖预览边手柄设置四向扩展像素：`pad_left`、`pad_top`、`pad_right`、`pad_bottom`。未扩的方向为 0。

### feathering（羽化，默认 40）

扩展边界软过渡宽度，减少接缝。0–256 px。

### main_prompt

描述**整张图最终效果**，例：*「森林小径上的徒步者，黄金时刻，写实摄影」*。不要只描述新增条带。

### 自定义参数（custom_params）

侧栏额外参数（seed 等）。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | 扩展后更大尺寸的单图 |

## 新手一步一步

1. 添加 **Outpaint**，接入上游图。
2. 选 **workflow**（建议先 **Flux Fill Outpaint**）。
3. 拖预览**边缘手柄**向需要方向扩展；看 pad 数值变化。
4. 在 **main_prompt** 写完整场景描述（中英文均可，视模型而定）。
5. 点 **▶ 运行**，等待生成。
6. 不满意：改扩展边距 / 提示词 / 随机种子（侧栏）→ 再 Run。

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
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/outpaint |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/outpaint/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：和 Inpaint 有什么区别？**  
A：Outpaint 是扩展画布；Inpaint 是在已有像素上画蒙版重绘。

**Q：接缝模糊？**  
A：增大羽化；丰富 prompt；换随机种子。

**Q：Fooocus 报错？**  
A：按 README 安装 comfyui-inpaint-nodes。

## 相关节点

- **Inpaint** — 局部重绘（蒙版）
- **Image Edit** — 整图指令编辑
- **Upscale** — 扩图后放大
- **Crop** — 扩完再裁构图
