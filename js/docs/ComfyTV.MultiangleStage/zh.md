> 用 3D 相机 widget 选新视角，AI 按角度重渲染主体，点 ▶ 运行 `workflows/multiangle/`。

## 这个节点是做什么的

**Multiangle（多角度）** 保持主体内容，从**新相机视角**重新生成一张图。节点卡片上有 **3D 相机 widget**：拖手柄或旋转场景设定 **方位角（horizontal）**、**俯仰（vertical）**、**距离（zoom）**；Stage 自动把这些数值转成 LoRA 需要的 `<sks> …` 视角关键词，再 Run Qwen Edit + Multiangle LoRA workflow。

**生成式** Stage（**▶ 运行**）。与 **Rotate**（像素旋转整张 bitmap）完全不同。

## 适用场景

- 产品/角色图缺侧面、背面镜头
- 分镜预览另一机位
- Image Picker 多角度入口
- 单张试角度后，用 **Image Variations** 批量出多机位

## 工作原理

- 3D widget 写入 `horizontal_angle` (0–360)、`vertical_angle` (−30–60)、`zoom` (0–10)。
- 服务端 `_multiangle_prompt()` 拼 prompt（8 方位 × 4 俯仰 × 3 景别），workflow **不要再手改** prompt 结构。
- **main_prompt** 仅可选补充主体描述；LoRA 负责相机。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

`COMFYTV_IMAGE` — [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### 3D 相机 widget（新手必读）

预览区内的三维控件：

- **拖环形手柄 / 旋转场景** — 改环绕方位（对应 horizontal_angle）。
- **上下拖** — 俯仰（低角度 / 眼平 / 高角度）。
- **缩放滑块 zoom** — 远景 wide / 中景 medium / 特写 close-up。
- 右侧数值滑块与 widget 同步：`horizontal_angle`、`vertical_angle`、`zoom`。

自动 prompt 示例片段：*front-right quarter view, eye-level shot, medium shot*。

### image（输入）

源图（单主体清晰效果最好）。

### workflow

[`workflows/multiangle/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/multiangle) — [README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/multiangle/README.zh.md)

| 内置 | 模型 |
|---|---|
| **Qwen Edit 2511 Multiangle** | Qwen Edit 2511 + Multiple-Angles LoRA + Lightning |

[models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)

### main_prompt（可选）

主体/场景补充，例：*「现代木质椅子」*。留空也可；相机由 LoRA 控制。

### 自定义参数（custom_params）

侧栏 seed。

## 输出说明

| 输出 | 类型 |
|---|---|
| **image** | 新视角 `COMFYTV_IMAGE`（尺寸回缩至源图大小） |

## 新手一步一步

1. 下载 Qwen 2511 + Multiangle LoRA（同 multiview 套）。
2. 添加 **Multiangle**，接入正面或 3/4 源图。
3. 在 **3D 相机** 拖到目标机位（或调三个滑块）。
4. 可选填 main_prompt 描述主体。
5. workflow 选 **Qwen Edit 2511 Multiangle**。
6. **▶ 运行**；不满意改角度或随机种子后再运行。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/multiangle |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/multiangle/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：和 Rotate 有什么区别？**  
A：Rotate 是即时像素变换；Multiangle 是 AI 新视角 + Run。

**Q：和 Multi-cam 9 有什么区别？**  
A：Multiangle 是一个自定义角度；Variations 是固定 9 机位批量。

**Q：能手写视角 prompt 吗？**  
A：不能——控件会自动生成 `<sks>` 标签。

## 相关节点

- **Image Variations** — 多机位/分镜批量
- **Rotate** — 几何旋转（即时）
- **Relight** — 同 Qwen 家族不同 LoRA
- **Upscale**
