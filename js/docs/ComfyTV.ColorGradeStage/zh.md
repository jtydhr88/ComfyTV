> 在浏览器里用 6 种 GLSL 调色效果实时修图，类似 Lightroom 滑块，无需 ▶ 运行。

## 这个节点是做什么的

**Color Grade（调色）** 对上游图片做非破坏性色彩调整。节点卡片提供效果下拉和对应滑块/曲线控件；每次改动通过 WebGL 片段着色器（GLSL）在本地 GPU（你的浏览器）上实时渲染预览。

这是 **即时（instant）** 节点：不调 ComfyUI 队列、不加载扩散模型。适合曝光/对比微调、色温校正、曲线精修等「后期」步骤，再交给 **Upscale** 或 **Relight** 做生成式增强。

当前内置 **6 种 GLSL 效果**（见下文表格）。选中效果与滑块值序列化为隐藏字段 `grade_state`（JSON）。

## 适用场景

- 生成图偏暗/偏灰，快速提亮对比
- 产品图色温统一、肤色微调
- 分镜批量出图后统一「胶片感」曲线
- Image Picker 工具栏 🎨 调色入口

## 工作原理

Color Grade 属于 transform 类 Stage：**无 Run**。前端 `useGLSLRenderer` 读取源图纹理，按 `grade_state` 选中的 effect id 加载对应 `.frag` 着色器，输出新预览 URL。

- 切换效果或拖滑块 → 即时重绘。
- 不涉及 `workflows/`；与 **Relight**（AI 重打光，需 Run）互补而非替代。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | URL 快照 | 不是 ComfyUI 内存图像 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

上游 `COMFYTV_IMAGE`。

### 效果下拉（6 种 GLSL）

| 效果 ID | 中文名 | 主要控件 | 用途 |
|---|---|---|---|
| **brightness_contrast** | 亮度 / 对比度 | 亮度 −100…+100、对比度 −100…+100 | 整体曝光与反差 |
| **color_adjustment** | 色彩调整 | 色温、色调、自然饱和度、饱和度 | 白平衡与鲜艳度 |
| **color_balance** | 色彩平衡 | 阴影/中间调/高光 R·G·B 各 −100…+100；保留亮度 | 分区调色 |
| **hue_saturation** | 色相 / 饱和度 | 模式（主/红/黄/绿…/着色）、色彩空间 HSL/HSV、色相/饱和/明度、重叠 | 单色系或全局 HSL |
| **color_curves** | 曲线 | Master / R / G / B 四条可编辑曲线 | 精细 tonal 控制 |
| **image_levels** | 色阶 | 通道 RGB/R/G/B；输入黑/白、Gamma、输出黑/白 | 类似 Photoshop 色阶 |

切换效果会重置为该项默认滑块值（除非 UI 保留了你的 `grade_state`）。

### grade_state（隐藏）

JSON：`{ effectId, values: { ... } }`。由 Vue 面板维护，一般勿手改。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | 调色后的单图快照 |

## 新手一步一步

1. 添加 **Color Grade**（ComfyTV / Image 或 Image Picker 🎨）。
2. 上游 **image** 接入。
3. 在效果下拉里选 **亮度/对比度** 或 **色彩调整** 等。
4. 拖滑块；曲线/色阶类可点曲线点微调。
5. 满意后输出接到 **Upscale**、**Compare** 或 Bridge。
6. 若下游是生成式节点，在下游 **▶ 运行**；调色本身不用 Run。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：和 Relight 有什么区别？**  
A：Color Grade 是传统调色、即时生效；Relight 是 AI 重打光，需 Run + workflow。

**Q：曲线调不了？**  
A：选 **color_curves**；点击曲线添加控制点。

**Q：Upscale 后看起来没调色？**  
A：调色改动后需重新 Run Upscale。

**Q：能叠加多种效果？**  
A：每个节点一种效果——串联节点或之后用 Relight。

## 相关节点

- **Relight** — AI 打光（生成式）
- **Crop / Rotate** — 其它即时工具
- **Upscale** — 调色后放大
- **Compare** — A/B 对比调色前后
