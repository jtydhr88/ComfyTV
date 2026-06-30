# 全景图 (Panorama)

> 交互式 360° 全景查看器：可上传 HDRI / equirectangular 图，或用 AI workflow 生成整张环绕全景，再从球心向四周浏览。

## 这个节点是做什么的

Panorama 是 ComfyTV 的 **360° 环境图入口**。输出不是普通平面照片，而是一张 **equirectangular（等距柱状投影）** 全景——你可以把它想象成一张被拉平的「世界地图」：横轴绕一圈是 360°，纵轴是从天顶到地面。节点打开 3D 查看器，你坐在球心，拖动就能朝任意方向看。

有三种把全景图导入的方式，**优先级从高到低**：

1. **📤 上传** —— 选本地 `.jpg` / `.png` / `.webp` / `.hdr` / `.exr`，查看器立刻加载，标 **manual** 徽章。上传会盖过其它路径；要走 AI 生成，先 ✕ 清掉上传。
2. **图生全景** —— workflow 选 `Qwen-Image-Edit 2511 Image-to-Panorama`，把普通照片接到 **image**。源图当作正前方，模型向外推完整 360°。
3. **文生全景** —— workflow 选 `Qwen-Image 2512 + 360 LoRA`，只填 **main_prompt**，不需要参考图。

Panorama 节点 **只显示 3D 查看器**，没有平面缩略图。要得到普通 flat 图，请接 **Panorama · Current View** 或 **Multi-View**。

## 适用场景

- 做 3D / 游戏 / VR 环境参考（HDRI 光照、天空盒）
- 从一张普通照片扩展成可环绕查看的场景
- 纯文字描述生成 360° 虚拟环境
- 为分镜或多视角出图提供统一环境底图

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** = 带 **▶ 运行** 的步骤。Run **只跑本节点**，**不会**触发 ComfyUI 全局 Queue 整张图。
- **快照**：Run 后全景 URL 存进项目。下游 Current View / Multi-View 再 Run 时用这份快照，不会自动重跑 Panorama 生成。
- **workflow 下拉框** = 背后执行的 ComfyUI 子工作流 JSON（[`workflows/panorama/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/panorama)）。ComfyTV 把 **main_prompt**、**image** 映射进去；Stage 自动加 `equirectangular 360 degree panorama, ` 前缀。
- **上传模式** 不需要 Run —— 选文件后立即加载；只有 AI 生成才需要 Run。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_PANORAMA` | 全景图的 `/view?` URL 快照 | 不是 ComfyUI 内存图像 |
| `COMFYTV_IMAGE` | 单张图的 URL 快照 | 普通平面截图用此类型 |

**如何转换：** 原生 `IMAGE` → ComfyTV 用 **→ ComfyTV Image**；截图变回 ComfyUI 内存格式 用 **← ComfyTV Image**。Bridge 详解见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## 界面与参数说明

### workflow
[`workflows/panorama/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/panorama) 中的后端。**Qwen-Image 2512 + 360 LoRA**（文生，约 2048×1024）；**Qwen-Image-Edit 2511 Image-to-Panorama**（图生，需 **image**）。选 workflow 后须点 **▶ 运行**；仅上传时可忽略。

### main_prompt
场景描述，如「日落时分的山湖」。不要自己再写 360° 触发词。图生时可补充延伸方向（「向外扩展为草原和远山」）。

### image（可选）
图生 workflow 的参考图 `COMFYTV_IMAGE`。可接 **Image Stage** 或 **Image Picker**。

### manual_source（隐藏）
**📤 Upload** 写入。非空时跳过 workflow。文件存 ComfyUI `input/`。**✕ Clear upload** 后可走生成。

### 自定义参数（custom_params）
JSON，覆盖 workflow 侧栏参数。见 [sidebar-config-editor.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/sidebar-config-editor.zh.md)。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
|---|---|---|---|
| **panorama** | `COMFYTV_PANORAMA` | 360° 全景 URL | **Current View**、**Multi-View** |

## 新手一步一步

1. 搜 **Panorama**，拖到画布。
2. **上传**：点 **📤 Upload panorama**，选 equirectangular / HDRI，在 3D 里拖动查看。
3. **文生**：**workflow** 选 `Qwen-Image 2512 + 360 LoRA`，写 **main_prompt**，点 **▶ 运行**。
4. **图生**：选 `Qwen-Image-Edit 2511 Image-to-Panorama`，上游接 **COMFYTV_IMAGE**，填提示词，Run。
5. 要平面截图：拖 **Current View** 或 **Multi-View**，连 **panorama**，在查看器操作后 Run。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [全景图 360°](https://github.com/jtydhr88/ComfyTV/blob/main/docs/panorama.zh.md) | 上传/生成 equirectangular、Current View、Multi-View |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/panorama |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/panorama/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：已上传文件，Run 没有新结果？**  
A：上传优先。**✕ 清除上传**，选择 workflow 后 Run。

**Q：什么是 equirectangular？**  
A：一种把 360° 球面展开成 2:1 矩形的投影。查看器把它贴在内侧球面上；你从球心向外看。

**Q：没有平面输出——怎么编辑？**  
A：先接 **Current View** → 得到 `COMFYTV_IMAGE` → 再接编辑 stage。

**Q：Workflow Run 失败？**  
A：检查 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) 是否已安装 Qwen-Image / 360 LoRA；或改用上传。

## 相关节点

- **Panorama · Current View** / **Multi-View** —— 截取平面视角
- **Image Stage** —— 图生参考图
- **→ ComfyTV Image** —— 插件 IMAGE 接入 ComfyTV
