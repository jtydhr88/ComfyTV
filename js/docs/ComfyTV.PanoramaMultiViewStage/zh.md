# 全景图 · 多视角 (Panorama · Multi-View)

> 从一张 360° 全景一次性截取多张等间距视口图，输出 `COMFYTV_IMAGES` 批量，适合分镜和多机位。

## 这个节点是做什么的

**Multi-View** 接 **Panorama** 下游，在全景周围 **均匀分布多个相机方向**，一次 Run 产出 **一组平面图**。例如 **View count = 4** 时，视图标注为 Front / Right / Back / Left——像站在房间中央朝四个方向各拍一张。

输出有两个口：**images**（完整批量 JSON）和 **image**（当前选中序号的那一张）。批量可接 **Image Picker** 逐张挑选或并行编辑。

## 适用场景

- 从同一 HDRI / 生成全景快速出多机位分镜
- 角色 / 产品环绕展示（3-view、4-view）
- 为 Image Variations 或 Video FLF2V 准备一组一致环境的帧

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** + **▶ 运行**：一次 Run 截取全部视口，只跑本节点。
- **快照**：读上游 Panorama 快照；Panorama 变更后须先重跑上游。
- **浏览器端**：多视口投影在浏览器完成，不占 GPU。
- **view_count**（1–64）由节点内滑块驱动（节点上隐藏）；**aspect_ratio** / **resolution** 作用于每个视口。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_PANORAMA` | 上游全景 | 输入 |
| `COMFYTV_IMAGES` | 多图批量 JSON | 不是 `IMAGE` batch |
| `COMFYTV_IMAGE` | 批量中当前选中一张 | 由 **selected_index** 决定 |

**如何转换：** ComfyTV → 原生：逐张用 **← ComfyTV Image**；原生 batch → ComfyTV：用 **→ ComfyTV Images**。见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## 界面与参数说明

### panorama（输入）
上游 `COMFYTV_PANORAMA`。

### view_count（隐藏，滑块 1–64）
环绕截取的张数。4 = 前后左右；8 = 每 45° 一张。

### aspect_ratio / resolution
每个视口的宽高比与短边档位（1K / 2K / 4K）。

### selected_index
**image** 输出口对应批量中的序号（从 1 起）。在 **Image Picker** 或节点 UI 切换。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
|---|---|---|---|
| **images** | `COMFYTV_IMAGES` | 全部视口 | Image Picker、Compare |
| **image** | `COMFYTV_IMAGE` | 当前选中一张 | 单张编辑 stage |

## 新手一步一步

1. **Panorama** Run 出全景（或上传）。
2. 拖 **Multi-View**，连 **panorama**。
3. 滑块设 **View count**（如 4）。
4. 选 **Aspect / Resolution**。
5. **▶ 运行** → 接 **Image Picker** 浏览各视角，或逐张下游编辑。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [全景图 360°](https://github.com/jtydhr88/ComfyTV/blob/main/docs/panorama.zh.md) | 上传/生成 equirectangular、Current View、Multi-View |
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

**Q：Current View 和 Multi-View 怎么选？**  
A：单个角度 → **Current View**；环绕一组 → **Multi-View**。

**Q：要原生 ComfyUI batch？**  
A：逐张用 **← ComfyTV Image**，或 **Image Picker** 后再出桥。

**Q：view_count 很大会很慢吗？**  
A：浏览器端截取通常很快；4K 会增加文件体积。

## 相关节点

- **Panorama** / **Current View**
- **Image Picker** —— 批量挑选
- **Image Variations** —— 多视角变体
