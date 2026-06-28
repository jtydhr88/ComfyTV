> 在浏览器里即时裁切一张图，拖矩形框即可，无需点 ▶ 运行，也不占用 GPU。

## 这个节点是做什么的

**Crop（裁剪）** 从上游图片里切出一块矩形区域，输出仍是同一张「逻辑图」，只是视野变小了。你在节点卡片上看到源图预览，上面叠一个可拖动的裁剪框；改框的位置或大小，结果**立刻**更新。

这是 **即时（instant）** 节点：处理全在浏览器完成，不会提交 ComfyUI 队列，也不会下载模型。适合构图微调、去水印边缘、把横图裁成竖图等轻量操作。

输入、输出都是 `COMFYTV_IMAGE`（一张图的 URL 快照），不是 ComfyUI 原生的 `IMAGE` tensor。若你的图来自 Save Image 或其它插件，请先接 **Bridge → ComfyTV Image**。

## 适用场景

- 生成图后只想保留主体，去掉多余背景或留白
- 按固定比例（1:1、16:9、9:16）导出，用于封面或分镜
- 在 **Image Picker** 工具栏点「裁剪」后自动插入的本节点
- 裁完再接 **Upscale**、**Outpaint** 等生成式节点做进一步处理

## 工作原理（为什么 ComfyTV 这样设计）

ComfyTV 把「改图但不跑模型」的操作做成 **Stage**，但和 **Upscale / Inpaint** 不同，Crop **没有 ▶ 运行** 按钮。你在 UI 里拖裁剪框时，前端实时算出 `crop_x / crop_y / crop_w / crop_h`，把裁切后的预览 URL 传给下游。

- **只影响本节点**：不会触发整张 ComfyUI 工作流 Queue。
- **快照机制**：若下游是带 Run 的生成式节点，它 Run 一次后会保存结果；再改 Crop 框不会自动重跑下游，需要你在下游再点一次 Run。
- **无 workflow**：不读 `workflows/` 目录，纯前端 Canvas / WebGL 裁切。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | 一张图的 URL 快照 | 不是内存里的 `IMAGE` tensor |
| `COMFYTV_IMAGES` | 多图批量 JSON | 不是 `IMAGE` batch |

**如何转换：**

- 原生 → ComfyTV：`ComfyTV/Bridge` → `→ ComfyTV Image`（Run 后存快照）
- ComfyTV → 原生：`← ComfyTV Image`（读快照变回 tensor）

详见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

上游 `COMFYTV_IMAGE`。常见来源：**Image Stage**、**Image Picker**、**Load Image**、**Bridge → ComfyTV Image**。没接线时卡片为空，请先接图。

### 裁剪框（预览区）

- **拖动方框**移动位置；拖**边或角**改大小。
- **Ratio** 下拉锁定宽高比（自由、1:1、4:3、16:9 等）；🔒 按钮切换是否锁定。
- **X / Y / W / H** 可填精确像素（对应隐藏参数 `crop_x`、`crop_y`、`crop_w`、`crop_h`）。
- 裁切结果实时生成，无需 Run。

### crop_x / crop_y / crop_w / crop_h（隐藏）

由 UI 自动写入，一般不用手动改。若 W 或 H 为 0，表示尚未有效裁切。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | 裁切后的单张图快照 | 任意 Image 类 Stage、Image Picker、Bridge ← ComfyTV Image |

## 新手一步一步

1. 在菜单 **ComfyTV / Image** 添加 **Crop**，或从 **Image Picker** 工具栏点「裁剪」自动插入。
2. 把上游图的 **image** 口接到本节点 **image**（例如 Image Picker → Crop）。
3. 节点卡片出现预览；拖裁剪框到想要区域，可选 **Ratio** 锁定比例。
4. 预览满意后，把本节点 **image** 输出接到下一步（如 Upscale 或 Compare）。
5. 若下游是生成式节点，到下游点 **▶ 运行**；Crop 本身不用 Run。
6. 想微调构图：改裁剪框 → 再到下游重新 Run 一次。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**。完整操作流程、多节点串联、类型转换与原理，请阅读上游官方仓库 [**jtydhr88/ComfyTV**](https://github.com/jtydhr88/ComfyTV) 的用户指南（文档链接均指向上游 `main`，而非本地 fork）：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |

## 上游仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **官方仓库（上游）** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：节点帮助和完整教程有什么区别？**  
A：本页只介绍**这一个节点**的参数与连线。端到端流程、多节点串联和原理说明见上方 **「完整教程（推荐阅读）」** 中的 upstream 用户指南。

**Q：链接为什么指向 jtydhr88/ComfyTV，而不是我的 fork？**  
A：官方文档与用户指南维护在[上游仓库](https://github.com/jtydhr88/ComfyTV)的 `main` 分支；本地 clone/fork 用于开发与贡献，节点帮助内的链接统一指向上游，避免 fork 与官方文档不一致。

**Q：`COMFYTV_*` 类型和 ComfyUI 原生类型连不上怎么办？**  
A：ComfyTV stage 传递的是项目内 **URL 快照**（如 `COMFYTV_IMAGE`），不是 GPU 里的 `IMAGE` tensor。请使用 **ComfyTV/Bridge** 下的入桥（→）或出桥（←）转换。完整说明见 [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) 教程。

## 相关节点

- **Rotate**、**Mirror**、**Color Grade**、**Grid Split** — 同类即时工具
- **Image Picker** — 选图 + 编辑工具栏入口
- **Upscale / Outpaint** — 裁完后的常见下游
- **Bridge → ComfyTV Image** — 从原生 IMAGE 接入
