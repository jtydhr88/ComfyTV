> 在浏览器里任意角度旋转图片，滑块实时预览，无需 ▶ 运行。

## 这个节点是做什么的

**Rotate（旋转）** 把上游图片绕中心旋转指定角度（−180° 到 +180°，正值为顺时针）。预览区会实时显示旋转后的画面，包括旋转后露出的空白区域（通常填充透明或背景色）。

这是 **即时（instant）** 节点：纯浏览器 Canvas 处理，不排队、不跑模型。适合纠正倾斜地平线、把竖构图临时转成横构图预览、或配合 **Crop** 做最终构图。

输入输出均为 `COMFYTV_IMAGE`。来自 ComfyUI 原生 `IMAGE` 时请先 **Bridge → ComfyTV Image**。

## 适用场景

- 航拍 / 扫描件略微倾斜，需要小角度扶正
- 快速试 90° / 180° 方向，再决定是否 **Crop**
- Image Picker 工具栏「旋转」一键插入
- 旋转后接 **Mirror** 或 **Color Grade** 做镜像 / 调色

## 工作原理（为什么 ComfyTV 这样设计）

Rotate 与 Crop 同属 **transform** 类 Stage：**无 Run 按钮**，参数变化立即反映到输出 URL。

- **angle** 由滑块或快捷按钮（⟲ 90°、0°、180°、⟳ 90°）写入隐藏字段。
- 下游生成式节点仍遵循**快照规则**：你改角度后，需在下下游重新 Run。
- 不涉及 `workflows/` 目录。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | 一张图的 URL 快照 | 不是 ComfyUI 内存图像 |

**如何转换：**

- 原生 → ComfyTV：`→ ComfyTV Image`（Run 一次）
- ComfyTV → 原生：`← ComfyTV Image`

详见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

上游 `COMFYTV_IMAGE`。无输入时预览为空。

### 角度滑块 angle（−180 … +180）

- 拖动滑块连续旋转；**正值 = 顺时针**。
- 快捷按钮：⟲ −90°、归零、180°、⟳ +90°。
- 对应隐藏参数 `angle`，默认 0。

### 预览区

实时显示旋转结果。大角度旋转会增大画布边界（可能出现透明边），后续可用 **Crop** 收紧。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | 旋转后的单图快照 | 任意 Image Stage、Bridge |

## 新手一步一步

1. 添加 **Rotate**（ComfyTV / Image 或 Image Picker 工具栏）。
2. 上游 **image** 接到本节点。
3. 拖 **angle** 滑块或点 90° 快捷按钮，直到构图满意。
4. 可选：接 **Crop** 去掉旋转产生的空白角。
5. 若下游是 **Upscale** 等，到下游点 **▶ 运行**。
6. 微调角度后，记得重新 Run 下游。

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

**Q：画布变大了？**  
A：旋转会扩大边界框——之后用 **Crop** 裁切。

**Q：没有 Run 按钮？**  
A：即时节点正常现象。

**Q：上游是原生 IMAGE？**  
A：先用 `→ ComfyTV Image` Bridge 转入。

**Q：和 Multiangle 有什么区别？**  
A：Rotate 是位图几何变换；**Multiangle** 是 AI 换机位重绘（需 Run + workflow）。

## 相关节点

- **Crop** — 旋转后裁边
- **Mirror** — 翻转（不旋转）
- **Color Grade** — 即时调色
- **Multiangle** — AI 换视角（生成式）
