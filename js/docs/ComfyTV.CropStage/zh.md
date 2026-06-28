> 在浏览器里即时裁切一张图，拖矩形框即可，无需点 ▶ 运行，也不占用 GPU。

## 这个节点是做什么的

**Crop（裁剪）** 从上游图片里切出一块矩形区域，输出仍是同一张「逻辑图」，只是视野变小了。你在节点卡片上看到源图预览，上面叠一个可拖动的裁剪框；改框的位置或大小，结果**立刻**更新。

这是 **即时（instant）** 节点：处理全在浏览器完成，不会提交 ComfyUI 队列，也不会下载模型。适合构图微调、去水印边缘、把横图裁成竖图等轻量操作。

输入、输出都是 `COMFYTV_IMAGE`（一张图的 URL 快照），不是 ComfyUI 内存图像。若你的图来自 Save Image 或其它插件，请先接 **Bridge → ComfyTV Image**。

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

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | 一张图的 URL 快照 | 不是 ComfyUI 内存图像 |
| `COMFYTV_IMAGES` | 多图批量 JSON | 不是 `IMAGE` batch |

**如何转换：**

- 原生 → ComfyTV：`ComfyTV/Bridge` → `→ ComfyTV Image`（Run 后存快照）
- ComfyTV → 原生：`← ComfyTV Image`（读快照变回 ComfyUI 内存图像）

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

**Q：为什么没有 ▶ Run？**  
A：Crop 是即时的，裁切框立即生效。只有 GPU/模型 stage 才有 Run。

**Q：改了裁切但 Upscale 看起来一样？**  
A：下游仍用上次 Run 快照。请重新 Run Upscale。

**Q：连不上 Save Image？**  
A：类型不匹配。加 `→ ComfyTV Image` Bridge，Run 后再 Crop。

**Q：输出分辨率是多少？**  
A：正好是裁切框的宽×高；不会自动放大。

## 相关节点

- **Rotate**、**Mirror**、**Color Grade**、**Grid Split** — 同类即时工具
- **Image Picker** — 选图 + 编辑工具栏入口
- **Upscale / Outpaint** — 裁完后的常见下游
- **Bridge → ComfyTV Image** — 从原生 IMAGE 接入
