> 把一张图切成网格多张小图，浏览器即时切分，输出图批量，无需 Run。

## 这个节点是做什么的

**Grid Split（网格切分）** 将上游单张图按行×列切成多块，每块成为批量里的一张图。预览区显示网格线；改行数、列数或边框参数后**立即**更新切分结果。

这是 **即时（instant）** 节点。典型用途：把 **Image Stage** 出的九宫格大图拆成单格、分镜板逐格挑选、或配合 **Image Picker** 从批量里选一张继续编辑。

输出有两个口：**images**（`COMFYTV_IMAGES` 整批 JSON）和 **image**（`COMFYTV_IMAGE` 当前选中格）。

## 适用场景

- AI 一次生成 2×2 / 3×3 联画，需要拆成独立镜头
- 产品多角度拼图后逐张 **Upscale**
- Image Picker 工具栏「网格切分」
- 切分 → **Image Picker** 选一格 → **Inpaint**

## 工作原理

Grid Split 在浏览器按像素矩形切图，写入隐藏参数 `rows`、`cols`、`border`、`outer_border`。

- **无 Run**；切分逻辑纯前端。
- `selected_index`（默认 1）决定 **image** 单输出口对应批量中第几张（从 1 起计）。
- 与 **Image Variations** 不同：后者是 AI **生成** 多张关联图，需 Run + workflow。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | 单张 URL 快照 | 非 `IMAGE` tensor |
| `COMFYTV_IMAGES` | 多图 JSON 批量 | 非 `IMAGE` batch |

Bridge：`→ ComfyTV Image(s)` / `← ComfyTV Images` — [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

上游 `COMFYTV_IMAGE` 单图。

### 预设 / Rows / Cols

- 快捷预设：1×2、2×1、2×2、2×3、3×3 等。
- **Rows** 行数（1–10）、**Cols** 列数（1–10）；预览网格线实时对齐。

### border（边框宽度）

切分时从相邻格之间**裁掉**的像素宽度（源图像素）。0 = 纯等分，无 gutter。

### outer_border（外边框）

开启后，边框宽度也会从整图外缘再裁一圈（相当于给网格加 margin）。

### selected_index

选中第几张作为 **image** 单输出（1-based）。在卡片缩略图条点击也可切换。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
|---|---|---|---|
| **images** | `COMFYTV_IMAGES` | 全部切分结果 | Image Picker、Bridge ← ComfyTV Images |
| **image** | `COMFYTV_IMAGE` | 当前选中格 | 任意单图 Stage |

## 新手一步一步

1. 添加 **Grid Split** 并接入上游大图。
2. 选预设（如 3×3）或设 **Rows/Cols**。
3. 若有 AI 网格黑边，调 **border** 去掉分隔线。
4. **images** → **Image Picker** 浏览全部；或 **image** → 单格继续编辑。
5. 对选中格下游 **Upscale** 等需 **▶ 运行**。
6. 改行列后，重新 Run 下游。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |
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

- **Image Picker** — 浏览批量
- **Image Variations** — AI 多图生成
- **Crop** — 切前可先裁主体
- **Upscale** — 单格放大
