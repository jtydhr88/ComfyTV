> 从 ComfyUI 的 `input/` 文件夹选取或上传一张本地图片，作为 ComfyTV 流程的**起点**——适合已有素材、不需要 AI 生成的场景。

## 这个节点是做什么的

**加载图片**（Load Image）是 ComfyTV **Input** 分类下的入口节点。它不会调用任何 AI 模型，只是把磁盘上（或刚上传的）图片文件登记为本项目的**快照**，并以 `COMFYTV_IMAGE` 类型流向下游。

你可以把它理解成「把一张现成的图放进 ComfyTV 项目里」。选完文件后，节点主体会显示预览；下游的裁剪、放大、图生视频等 stage 都会读取这份快照。

与 **从资产加载图片** 不同：本节点读的是 ComfyUI 全局的 **`input/` 目录**（或上传控件写入该目录的文件），而不是 ComfyTV 项目资产库里「跑 stage 产生」的结果。

## 适用场景

- 你手头已有 PNG/JPG/WebP 等文件，想直接接入 ComfyTV 编辑或转视频流程。
- 从其它软件导出图片，拖进 ComfyUI 的 `input/` 文件夹后在此选取。
- 需要把**原始文件**（非项目内生成物）作为参考图，接到 Image Edit、Video Stage 等节点。
- 与原生 ComfyUI `LoadImage` 配合：先用插件节点出图，再通过 Bridge 或本节点转入 ComfyTV（见 FAQ）。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage 与运行按钮**：本节点**没有 ▶ 运行**按钮。在节点内下拉选择文件或上传后，输出**立即生效**——这是「选取即输出」的 Input stage，不占用 ComfyUI 全局 Queue。
- **快照**：选定文件后，ComfyTV 把该文件的访问 URL 存进当前项目。下游 stage 再 Run 时读这份快照，**不会**因为你在 `input/` 里换了同名文件而自动更新——需在本节点重新选取。
- **无 workflow**：本节点背后没有 ComfyUI 子工作流 JSON；它只是登记 `input/` 里的文件路径。生成类节点才需要 `workflows/<kind>/` 里的 workflow。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | 一张图的 URL 快照 | 不是内存里的 `IMAGE` tensor |
| `COMFYTV_IMAGES` | 多图批量 JSON | 不是 `IMAGE` batch |
| `COMFYTV_VIDEO` / `COMFYTV_AUDIO` | 同理 | 需 Bridge 与原生节点互通 |

**如何转换：**

- 原生 → ComfyTV：`ComfyTV/Bridge` → `→ ComfyTV Image`（Run 后存快照）
- ComfyTV → 原生：`← ComfyTV Image`（读快照变回 tensor）

详细说明：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（图片文件）

- **是什么**：下拉框列出 ComfyUI **`input/`** 文件夹中所有图片类型文件；旁边有**上传**控件，新文件会写入同一目录。
- **填什么**：从列表选已有文件，或点击上传本地图片。
- **对结果的影响**：所选文件即本节点唯一输出；换文件即换快照。
- **常见误区**：以为下拉框里是「项目里生成过的图」——那是 **从资产加载图片** 的职责。`input/` 是 ComfyUI 全局共享目录，所有 workflow 都能读。

### project_id / parent_output_id（内部）

- 隐藏字段，由 **Project** 节点与画布连线自动维护，一般无需手动改。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | 所选图片的快照 URL | Image Picker、Crop、Upscale、Inpaint、Video Stage（I2V）、Compare 的 image_a/image_b 等 |

## 新手一步一步

1. 在画布上 **Add Node → ComfyTV → Input → Load Image**（加载图片）。
2. （推荐）先拖一个 **Project** 节点并命名项目，再连到本节点，便于快照归类。
3. 把图片放进 ComfyUI 安装目录下的 **`input/`** 文件夹，或在本节点点击**上传**。
4. 在下拉框选中目标文件——节点主体会显示预览，**无需点 Run**。
5. 将 **image** 输出连到下游，例如 **Image Picker** 或 **Crop**。
6. 在下游节点点 **▶ 运行**，即可基于这张输入图继续处理。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：节点帮助和完整教程有什么区别？**  
A：本页只介绍**这一个节点**的参数与连线。端到端流程、多节点串联和原理说明见上方 **「完整教程（推荐阅读）」** 中的用户指南。


**Q：`COMFYTV_*` 类型和 ComfyUI 原生类型连不上怎么办？**  
A：ComfyTV stage 传递的是项目内 **URL 快照**（如 `COMFYTV_IMAGE`），不是 GPU 里的 `IMAGE` tensor。请使用 **ComfyTV/Bridge** 下的入桥（→）或出桥（←）转换。完整说明见 [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) 教程。

## 相关节点

- **从资产加载图片** —— 从项目资产库选取生成/导入的图。
- **加载视频** / **加载音频** —— 同模式的其它媒体 Input。
- **Image Picker** —— 从批量中挑一张并打开编辑工具栏。
- **→ ComfyTV Image**（Bridge）—— 把原生 `IMAGE` tensor 转入 ComfyTV。
