# 分镜图集

> 根据 **Storyboard** 分镜表，为每一镜自动跑图像 workflow 出图——把「文字分镜」变成「可视分镜图集」的批量生成节点。

## 这个节点是做什么的

**分镜图集**（Shot Images）属于 **Compose** 分类。它读取上游 **Storyboard** 输出的 `COMFYTV_STORYBOARD` JSON（内含 `shots[]`，每镜有 prompt、时长、镜头说明等），然后**按顺序**为每一镜调用一次图像 workflow，每镜产出一张图，最终打包为 `COMFYTV_IMAGES` 批量。

你可以把它看作「Storyboard 的渲染器」：Storyboard 只产**结构化文字**；Shot Images 才产**像素**。

典型流水线：

```
Storyboard（LLM 分镜表）→ Shot Images（逐镜出图）→ Image Picker（挑镜继续 Edit）
```

## 适用场景

- 短视频 / 广告前期：先 AI 写分镜，再一键出概念图。
- 同一故事换不同 image workflow（Flux、SD 等）快速对比视觉风格。
- 多镜共享角色参考图（**images** 口 autogrow 传给每一镜）。
- 为 **Director Timeline** 准备按镜号标注的图片素材。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage + ▶ 运行**：点 Run **只跑本节点**，按镜顺序调用 workflow，不会重跑整张 ComfyUI 图；进度条显示 `shot 2/6` 等。
- **快照**：Run 完成后批量 JSON 存进项目；下游 Picker Run 时用该快照，不会自动重跑 Shot Images。
- **workflow 下拉框**：背后对应 `workflows/shot-images/` 及声明了 `kinds: ["image","shot-images"]` 的 `workflows/image/` JSON。ComfyTV 把每镜 prompt、resolution、aspect_ratio 映射进子工作流。
- **Storyboard 驱动**：无 storyboard 连线或 shots 为空时会失败；请先 Run Storyboard。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_STORYBOARD` | 分镜 JSON | Storyboard 输出，接 **storyboard** 口 |
| `COMFYTV_IMAGES` | 多图批量 | **images** 输出，每镜一张 |
| `COMFYTV_IMAGE` | 单图 | **image** 输出，由 **selected_index** 决定 |
| 原生 `IMAGE` | ComfyUI 内存图像 | 需 Bridge；本节点输出 COMFYTV 快照 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### workflow

- **是什么**：图像生成后端，来自 [workflows/shot-images/](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/shot-images) 及多 kind 的 image workflow。
- **选项从哪来**：仓库 workflow 配置 + 启动时扫描；内置示例含 **Flux Schnell**、**Local Z-Image Turbo** 等（视安装而定）。
- **需要什么模型**：见各 workflow README 与 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)。
- **影响**：决定每镜画面风格与质量；换 workflow 可 A/B 同一分镜表。

### resolution / aspect_ratio

- **是什么**：与 Image Stage 相同的短边档位（如 1K）与宽高比（1:1、16:9…）。
- **影响**：**每一镜统一**使用该尺寸；不会按镜单独改（改分镜请在 Storyboard UI 或后续 Crop）。

### storyboard

- **是什么**：上游 `COMFYTV_STORYBOARD` 连线。
- **填什么**：**Storyboard → storyboard** 接到此处。
- **影响**：shots 数组长度 = 运行次数；每镜 `prompt` / `image_prompt` 字段作为该镜生成 prompt。
- **误区**：在 Shot Images 里改 prompt——应在 **Storyboard 节点 UI** 编辑各镜后再 Run 本节点。

### images（参考图 autogrow）

- **是什么**：最多 8 槽的可选 `COMFYTV_IMAGE` 参考。
- **影响**：**每一镜** workflow 都会收到相同 upstream images（如角色立绘、场景参考）。
- **用途**：保持多镜角色一致性。

### selected_index

- 决定 **image** 单输出口对应批量中第几张（1 起始）；点缩略图可改。

### 自定义参数（custom_params）

- 侧栏绑定的额外 workflow 参数（种子、步数等）。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **images** | `COMFYTV_IMAGES` | 全部分镜图，带 shot 标签 | Image Picker、Director Timeline（images）、Compare（需拆单张） |
| **image** | `COMFYTV_IMAGE` | 当前选中一镜 | 单镜 Edit、Video Stage 等 |

## 新手一步一步

1. **Project** + **Storyboard**：写故事 premise，设 shot_count、时长；从下拉框选 Storyboard workflow（如 Qwen3 Storyboard，后端未就绪时可能仅为占位项），**▶ 运行**。
2. 在 Storyboard UI **检查/修改**各镜 prompt。
3. 添加 **Shot Images**，**storyboard** 口接上一步输出。
4. 选 **workflow**（如 Flux Schnell）、**resolution**、**aspect_ratio**；可选连角色参考到 **images**。
5. **▶ 运行** Shot Images，等待逐镜进度完成。
6. 接 **Image Picker** 挑满意镜头，或用 **Director Timeline** 编排。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/shot-images |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/shot-images/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：报 "no shots" 或 "returned no shots"？**  
A：先 Run **Storyboard** 且 shots 非空；检查模型；查看控制台逐镜失败信息。

**Q：与 Image Stage 有何区别？**  
A：Image Stage = **一个 prompt，N 张相似图**。Shot Images = **N 个不同 prompt（分镜），每镜一张**。分镜批量渲染 vs 单 prompt 批量。

**Q：workflow 列表空白/灰色？**  
A：重启 ComfyUI 重新扫描；确认 shot-images 或多 kind 配置存在。

**Q：不用 Storyboard 能手动写 prompt 吗？**  
A：设计用于分镜 JSON；先 Run Storyboard，在 UI 编辑分镜，再 Run Shot Images。

**Q：Load 与 generate 的区别？**  
A：Loader **导入**文件；Shot Images **生成**分镜画面。可混用：Loader 作参考，Shot Images 产出成品。

## 相关节点

- **Storyboard** —— 必需上游；产出 COMFYTV_STORYBOARD。
- **Image Picker** —— 从分镜批量挑单镜。
- **Image Stage** —— 单 prompt 多图，非分镜流水线。
- **Director Timeline** —— 用分镜图编排时间线。
- **Text Stage** —— 可选，为 Storyboard 提供 premise 扩写。
