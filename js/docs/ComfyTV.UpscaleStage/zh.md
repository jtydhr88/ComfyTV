> 用本地模型把图片放大到更高分辨率，点 ▶ 运行执行 `workflows/upscale/` 里的工作流。

## 这个节点是做什么的

**Upscale（高清）** 接收一张上游图，在 GPU 上跑选定的上采样工作流，输出更清晰、像素更多的 `COMFYTV_IMAGE`。属于 **生成式（generative）** Stage：必须点节点上的 **▶ 运行**；不会改参数就自动出图，也不会触发 ComfyUI 全局 Queue 整张画布。

内置 **Ultrasharp 4x**（纯 GAN 4 倍放大）。可选 **scale**（2x / 4x）主要给带 diffusion refine 的自定义 workflow 用；内置 GAN 固定 4× 输出。

## 适用场景

- 文生图分辨率不够，需要印刷 / 大屏尺寸
- **Crop**、**Color Grade** 之后最终出图放大
- Image Picker 工具栏「高清」快捷插入
- 放大后再 **Compare** 看前后差异

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage + Run**：只执行本节点绑定的子工作流 JSON（`workflows/upscale/`），ComfyTV 把 `image`、`scale`、`main_prompt` 映射进 workflow。
- **快照**：Run 成功后结果写入项目；下游 Stage 再 Run 时用该快照，**不会**自动重跑 Upscale，除非你再次点 Upscale 的 Run。
- **与即时节点区别**：Upscale 需要模型文件（如 `4x-UltraSharp.pth`），首次 Run 可能较慢。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | URL 快照 | 非 `IMAGE` tensor |

- 原生 → ComfyTV：`→ ComfyTV Image`（Bridge Run）
- ComfyTV → 原生：`← ComfyTV Image`

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

上游 `COMFYTV_IMAGE`。必接，否则 Run 报错。

### workflow（工作流）

选项来自仓库 [`workflows/upscale/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/upscale)。说明见 [workflows/upscale/README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/upscale/README.zh.md)。

| 内置选项 | 说明 | 所需模型 |
|---|---|---|
| **Ultrasharp 4x** | GAN 4×，无提示词 | `4x-UltraSharp.pth` → `models/upscale_models/` |

模型清单：[models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)

若下拉为空或灰色，检查 workflow 文件是否存在并重启 ComfyUI。

### scale（2x / 4x）

内置 Ultrasharp 忽略此值（固定 4×）。自定义 diffusion-refine workflow 可读此系数。

### main_prompt（提示词，可选）

纯 GAN 上采样不用。带 KSampler refine 的自定义 workflow 可用来引导锐化/细节。

### custom_params

侧栏 **ComfyTV** 配置编辑器里的额外 workflow 参数（种子、模型名等）。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | 放大后的单图（Ultrasharp ≈ 原图 4× 宽高） |

## 新手一步一步

1. 添加 **Upscale**，上游 **Image Picker** 或 **Image Stage** 的 **image** 接入。
2. **workflow** 选 **Ultrasharp 4x**（确认已下载 `4x-UltraSharp.pth`）。
3. 可选填 **main_prompt**（内置 workflow 可留空）。
4. 点 **▶ 运行**，等待进度条完成。
5. 预览区出现高清图；输出可接 **Compare** 或 Bridge。
6. 换源图或改 scale 后，需再次 Run 本节点。

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
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/upscale |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/upscale/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：节点帮助和完整教程有什么区别？**  
A：本页只介绍**这一个节点**的参数与连线。端到端流程、多节点串联和原理说明见上方 **「完整教程（推荐阅读）」** 中的 upstream 用户指南。

**Q：链接为什么指向 jtydhr88/ComfyTV，而不是我的 fork？**  
A：官方文档与用户指南维护在[上游仓库](https://github.com/jtydhr88/ComfyTV)的 `main` 分支；本地 clone/fork 用于开发与贡献，节点帮助内的链接统一指向上游，避免 fork 与官方文档不一致。

**Q：`COMFYTV_*` 类型和 ComfyUI 原生类型连不上怎么办？**  
A：ComfyTV stage 传递的是项目内 **URL 快照**（如 `COMFYTV_IMAGE`），不是 GPU 里的 `IMAGE` tensor。请使用 **ComfyTV/Bridge** 下的入桥（→）或出桥（←）转换。完整说明见 [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) 教程。

## 相关节点

- **Image Stage** — 出图上游
- **Crop / Color Grade** — 放大前即时处理
- **Compare** — 前后对比
- **Bridge ← ComfyTV Image** — 导出到原生节点
