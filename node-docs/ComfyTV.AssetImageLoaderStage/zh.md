# 从资产库加载图片

> 从 ComfyTV **项目资产库**里挑选一张图片作为流程输入——适合复用本项目中生成、编辑或导入的结果，而不是 `input/` 里的原始文件。

## 这个节点是做什么的

**从资产加载图片**（Load Image from Asset）属于 **Input** 分类。节点主体内嵌**资产选取器**：分类标签、搜索框、缩略图网格。点击某张图后，立即输出 `COMFYTV_IMAGE` 快照。

资产库记录的是**当前 ComfyTV 项目**里各 stage 运行产生、或从侧栏 **资产** 面板导入的媒体。每条资产带有 lineage（来源 stage），便于追溯「这张图是哪一步出的」。

与 **加载图片**（读 ComfyUI `input/` 文件夹）形成互补：外部文件用 Load Image；项目内成果用本节点。

## 适用场景

- 在 **Image Stage** 跑出一批图后，换一条分支从库里再挑一张继续 Edit。
- 从 **Shot Images** 批量结果里选某一镜，不重新生成整表。
- 悬停预览菜单 **加载为资产节点**，一键生成预填的本节点。
- 多分支工作流：同一项目里共享生成物，避免重复跑上游。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage 与运行按钮**：**无 ▶ 运行**。点击缩略图即登记快照，不跑 workflow、不占 Queue。
- **快照**：选中资产的 输出数据地址（URL） 写入项目；下游 Run 读该 URL。换选另一张图会更新快照。
- **资产库 vs input/**：`input/` 是 ComfyUI 全局文件夹，与项目无关；资产库按 **Project** 隔离，只含 ComfyTV stage 产出与显式导入项。
- **无 workflow**：纯选取，不涉及 `workflows/image/`。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | 单图 URL 快照 | 不是 ComfyUI 内存图像 |
| `COMFYTV_IMAGES` | 多图 JSON 批量 | 批量在 Image Picker 里拆成单张 |
| 原生 `IMAGE` | ComfyUI 内存图像 | 需 **→ ComfyTV Image** Bridge 才能进资产流 |

**如何转换：** [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### 资产选取器（节点主体）

- **是什么**：可滚动缩略图 + **分类**标签（`all` 或自定义 category）+ **搜索**。
- **怎么用**：点击缩略图选中；空库时先跑生成 stage 或侧栏导入。
- **对结果的影响**：决定输出的 `COMFYTV_IMAGE`。
- **常见误区**：分类为空 ≠ 坏了，可能只是当前 category 无匹配项，切回 `all`。

### asset_url / asset_id / category（隐藏）

- **asset_url**：UI 写入的内部 输出数据地址（URL），即实际输出内容。
- **asset_id**：库内 id，用于 lineage/调试。
- **category**：上次使用的分类筛选，持久化以便 reopen 工作流时记住筛选状态。

### 项目 id（project_id） / 父输出来源 id（内部）

- 与 **Project** 节点绑定；资产库按项目隔离。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | 所选资产的单图快照 | Image Picker、各类 Image 编辑 stage、Video Stage（I2V）、Compare 等 |

## 新手一步一步

1. 先拖 **Project** 节点并命名项目（资产按项目存储）。
2. 运行任意图像 stage（如 **Image Stage**）或从侧栏 **资产** 导入文件，**填充资产库**。
3. **Add Node → ComfyTV → Input → Load Image from Asset**。
4. 在节点内浏览缩略图；可用分类/搜索缩小范围。
5. **点击**目标图——预览更新，**无需 Run**。
6. 将 **image** 连到下游编辑或生成节点，在下游 **▶ 运行**。

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

## 常见问题

**Q：资产库是空的？**  
A：在同一 **Project** 下 Run 生成节点，或从侧栏导入。确认 Project 与画布一致。

**Q：和 Load Image（input/）有什么区别？**  
A：**外部/原始文件** → **Load Image**。**项目生成/导入** → **从资产加载图片**。Loader **复用**已有资源；生成器 **创建**新图（Image Stage）。

**Q：原生插件的图片？**  
A：先 Run **→ ComfyTV Image** Bridge，结果才会进入资产库。

**Q：点击没反应？**  
A：刷新页面；确认资产 URL 仍有效。

## 相关节点

- **加载图片** —— `input/` 原始文件。
- **从资产加载视频** / **从资产加载音频** —— 同模式其它媒体。
- **Image Stage** —— 向资产库写入新图片。
- **Image Picker** —— 从连线批量中选一张（实时上游），与本节点（库浏览）可并存。
