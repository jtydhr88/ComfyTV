> 水平或垂直镜像翻转图片，开关即生效，浏览器即时处理，无需 Run。

## 这个节点是做什么的

**Mirror（镜像）** 对上游图片做轴对称翻转：可单独或同时开启 **水平（⇋ 左右）** 与 **垂直（⇅ 上下）**。两个布尔开关对应隐藏参数 `flip_horizontal`、`flip_vertical`；切换后预览立刻更新。

属于 **即时（instant）** 节点，不调用 GPU 模型。常用于修正自拍镜像、对称构图试验、或配合 **Rotate** 调整朝向。

## 适用场景

- 人脸 / 产品图需要左右翻转
- 纹理或图案检查对称性
- Image Picker 工具栏「镜像」快捷插入
- 翻转后再 **Crop** 或 **Upscale**

## 工作原理

Mirror 与 Crop、Rotate 相同：**Stage 但无 Run**。翻转在浏览器完成，输出仍是 `COMFYTV_IMAGE` 快照。

- 同时开水平 + 垂直 ≈ 旋转 180°（但实现路径不同，与 **Rotate** 可叠加使用）。
- 改开关不会自动重跑下游生成式节点。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_IMAGE` | URL 快照 | 不是 ComfyUI 内存图像 |

转换：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）

上游 `COMFYTV_IMAGE`。

### ⇋ 水平翻转 flip_horizontal

true = 左右镜像。默认 false。

### ⇅ 垂直翻转 flip_vertical

true = 上下镜像。默认 false。

两个可独立或组合使用。UI 开关写入隐藏布尔字段；无额外滑块。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | 翻转后的单图 |

## 新手一步一步

1. 从 **ComfyTV / Image** 添加 **Mirror**，或从 Image Picker 工具栏插入。
2. 连接上游 **image**。
3. 打开 **水平** 和/或 **垂直** 开关，在预览里确认。
4. 输出接到 **Crop**、**Color Grade** 或生成式节点。
5. 若下游需 Run（如 Upscale），在下游点 **▶ 运行**。
6. 改翻转后，重新 Run 下游。

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

**Q：下游没变化？**  
A：重新 Run 下游；确认连的是 Mirror **output**，不是旁路。

**Q：和 Rotate 180° 一样吗？**  
A：两种翻转效果相近；选一种方式即可。

**Q：会损失画质？**  
A：翻转是无损的；需要时再 Upscale。

## 相关节点

- **Rotate**、**Crop** — 其它几何即时工具
- **Color Grade** — 翻转后调色
- **Image Picker** — 工具栏入口
