> 一键 AI 抠图，输出带透明背景的 PNG，无提示词，点 ▶ 运行 `workflows/cutout/`。

## 这个节点是做什么的

**Cutout（抠图）** 自动分割画面主体，去掉背景，输出带**真实 alpha 透明通道**的 `COMFYTV_IMAGE`（PNG）。无需蒙版画笔、无需 prompt，接图后选 workflow 并 Run 即可。

**生成式** Stage（需 **▶ 运行**）。与 **Erase**（局部涂蒙版删除）不同：Cutout 针对**整图主体 vs 背景**。

## 适用场景

- 产品图、人物换背景前抠主体
- 合成到 **Timeline** 或设计软件
- Image Picker「抠图」预设
- 抠完接 **Relight** 或 **Upscale**

## 工作原理

- BiRefNet 等分割模型在 workflow 内跑；ComfyTV 只传上游图。
- Run 后快照；无 UI 参数（除 workflow / custom_params）。
- 输出分辨率与输入一致（除非 workflow 内缩放）。

## 类型说明

`COMFYTV_IMAGE`（含 alpha）— [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

源图，主体应相对清晰、与背景有对比。

### workflow

[`workflows/cutout/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/cutout) — [README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/cutout/README.zh.md)

| 内置 | 模型 |
|---|---|
| **BiRefNet Cutout** | `birefnet.safetensors` → `models/background_removal/` |

[models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)

### custom_params

侧栏可换分割模型名等（高级）。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | 透明背景 PNG 快照 |

## 新手一步一步

1. 下载 **birefnet.safetensors** 到 `models/background_removal/`。
2. 添加 **Cutout**，上游接图。
3. workflow 选 **BiRefNet Cutout**。
4. 点 **▶ 运行**（无需 prompt / 蒙版）。
5. 预览检查边缘；可再接 **Inpaint** 修边缘。
6. Bridge 导出或下游 **Relight**。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**。完整操作流程、多节点串联、类型转换与原理，请阅读上游官方仓库 [**jtydhr88/ComfyTV**](https://github.com/jtydhr88/ComfyTV) 的用户指南（文档链接均指向上游 `main`，而非本地 fork）：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 checkpoint/LoRA 与放置目录 |

## 上游仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **官方仓库（上游）** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/cutout |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/cutout/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：节点帮助和完整教程有什么区别？**  
A：本页只介绍**这一个节点**的参数与连线。端到端流程、多节点串联和原理说明见上方 **「完整教程（推荐阅读）」** 中的 upstream 用户指南。

**Q：链接为什么指向 jtydhr88/ComfyTV，而不是我的 fork？**  
A：官方文档与用户指南维护在[上游仓库](https://github.com/jtydhr88/ComfyTV)的 `main` 分支；本地 clone/fork 用于开发与贡献，节点帮助内的链接统一指向上游，避免 fork 与官方文档不一致。

**Q：`COMFYTV_*` 类型和 ComfyUI 原生类型连不上怎么办？**  
A：ComfyTV stage 传递的是项目内 **URL 快照**（如 `COMFYTV_IMAGE`），不是 GPU 里的 `IMAGE` tensor。请使用 **ComfyTV/Bridge** 下的入桥（→）或出桥（←）转换。完整说明见 [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) 教程。

## 相关节点

- **Erase / Inpaint** — 局部修边
- **Relight** — 抠图后打光
- **Upscale**
- **Bridge ← ComfyTV Image**
