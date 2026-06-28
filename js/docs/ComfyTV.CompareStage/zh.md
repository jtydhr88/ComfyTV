> 用可拖动的**前后滑条**对比两张图——改前 vs 改后，纯视觉检查，不产生新输出。

## 这个节点是做什么的

**A/B 对比**（Compare）是 **Compose** 分类下的**纯展示** stage。它接收两张 `COMFYTV_IMAGE`：**image_a**（通常放原图 / 改前）和 **image_b**（改后 / 新 workflow 结果），在节点主体内显示**分屏滑条**：拖动竖线即可左右 reveal，细查 Inpaint 边缘、Upscale 锐度、Relight 色偏等差异。

**没有任何输出口**——不参与下游数据流，也不写入资产库。满意后请在**编辑 stage 或 Image Picker** 里选定要保留的版本继续连线。

详见用户文档：[compose.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md)

## 适用场景

- **Upscale** 前后：同一张图是否多了伪细节。
- **Inpaint / Erase** 后检查接缝是否穿帮。
- **Relight / Image Edit** 与 Picker 原图对比。
- 两个 **Image Stage** seed 对比（分别 Bridge 或 Picker 出单张后接入）。

## 工作原理（为什么 ComfyTV 这样设计）

- **无 ▶ 运行**：浏览器即时渲染滑条；改连线后预览自动刷新（读最新快照 URL）。
- **无快照产出**：Compare 不 emit 新 COMFYTV 类型；上游快照仍各自独立存在。
- **为何需要 COMFYTV_IMAGE**：两张输入须为可加载的 URL 快照；原生 `IMAGE` tensor 无法直接进 Compare UI，需 **→ ComfyTV Image** Bridge。
- **与 Image Picker 区别**：Picker **选一个**继续 pipeline；Compare **只看**不选，不替代 Picker。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | 单图 URL | **image_a** / **image_b** 均须此类型 |
| 原生 `IMAGE` | tensor | 各接 **→ ComfyTV Image** 再进 Compare |
| 输出 | 无 | 不能接 Video Stage 等下游 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image_a（改前 / 左）

- **是什么**：Optional `COMFYTV_IMAGE`；滑条**左侧**默认全显示区域。
- **填什么**：Image Picker 原图、Loader 输出、编辑前分支。
- **影响**：作为对比基准；留空则只显示 image_b。

### image_b（改后 / 右）

- **是什么**：Optional `COMFYTV_IMAGE`；滑条**右侧** reveal 区域。
- **填什么**：Upscale / Inpaint / Relight 等编辑 stage 的 **image** 输出。
- **影响**：与 image_a 并排滑移对比。
- **误区**：把两张图接反——习惯 a=原 b=新，接反也能看但语义混乱。

### 滑条 UI

- 在节点主体内**水平拖动**竖线；无额外参数。
- 支持与其他预览相同的滚轮缩放/平移（若节点继承全局预览行为）。

## 输出说明

本节点**无输出 socket**。Compare 不生成合并图、不输出「获胜」一侧——请手动把 preferred 版本连到下游。

## 新手一步一步

1. 准备原图：经 **Image Picker** 或 **Load Image** 得到 `COMFYTV_IMAGE`。
2. 原图分支接 **Upscale**（或其它 Edit），**▶ 运行** 得到改后图。
3. 添加 **Compare** 节点。
4. 原图连 **image_a**，Upscale 的 **image** 连 **image_b**。
5. 在 Compare 主体内**拖动滑条**检查细节。
6. 满意则从 **Upscale**（或原图）继续连下游；Compare 可留在图上作记录。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |

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

- **Upscale** / **Inpaint** / **Relight** / **Erase** —— 常见 image_b 来源。
- **Image Picker** —— 常见 image_a 来源。
- **Load Image** / **Asset Image Loader** —— 外部或库内原图。
- **→ ComfyTV Image** —— 原生 tensor 转入。
- **Image Stage** —— 生成候选后再 Picker + Compare 两套分支。
