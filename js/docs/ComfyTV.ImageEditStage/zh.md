> 用自然语言指令编辑整张图（换背景、改颜色、删物体），点 ▶ 运行 `workflows/image-edit/`。

## 这个节点是做什么的

**Image Edit（修改图片）** 接收一张源图 + **指令式 main_prompt**，Run 后模型在尽量保持构图的前提下按文字修改内容。不需要蒙版画笔；与 **Inpaint**（局部蒙版）、**Outpaint**（扩画布）不同。

**生成式** Stage，需 **▶ 运行**。内置 **Flux Canny Edit**（用 Canny 边缘约束结构）。

## 适用场景

- 「把自行车去掉」「裙子改成红色」「背景换成雪山」
- Image Picker 工具栏「推演 +3s/+5s」会路由到 Image Edit 类 workflow
- 整图风格微调后再 **Upscale**

## 工作原理

- workflow 把上游图作结构参考（Canny 等），prompt 作编辑指令。
- **快照**机制：改 prompt 后需重新 Run 本节点。
- prompt 用**祈使 / 动作**语言，描述**要做什么改变**，不要重写整幅场景散文。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

`COMFYTV_IMAGE` — [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

源图 `COMFYTV_IMAGE`。

### workflow

[`workflows/image-edit/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image-edit) — [README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image-edit/README.zh.md)

| 内置 | 模型 |
|---|---|
| **Flux Canny Edit** | `flux1-canny-dev` + t5 + clip_l + ae |

[models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)

### main_prompt

指令示例（英文往往更稳，中文视模型支持）：

- *remove the bicycle*
- *change the dress to red*
- *replace the background with mountains*

避免：*「一张有人在山里的照片」*（那是生成描述，不是编辑指令）。

### 自定义参数（custom_params）

侧栏 seed、denoise 等（若 workflow 暴露）。

## 输出说明

| 输出 | 类型 |
|---|---|
| **image** | 编辑后 `COMFYTV_IMAGE` |

## 新手一步一步

1. 添加 **Image Edit**，上游接选定图。
2. workflow 选 **Flux Canny Edit**（下载 canny dev 模型）。
3. **main_prompt** 写一条清晰指令（一次一个主要改动更稳）。
4. **▶ 运行**。
5. 多轮编辑：把输出再接下一个 Image Edit，或回 Image Picker 选图。
6. 侧栏调 seed 直到满意。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |
| [自定义工作流](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) | 导入自己的 ComfyUI JSON，不改 Python |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image-edit |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image-edit/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：和 Inpaint 有什么区别？**  
A：局部蒙版 + 内容 → Inpaint；整图指令 → Image Edit。

**Q：构图漂移了？**  
A：收窄指令；降低 denoise；换随机种子。

## 相关节点

- **Inpaint / Erase / Outpaint**
- **Relight** — 专注重打光
- **Image Variations** — 批量变体
- **Upscale**
