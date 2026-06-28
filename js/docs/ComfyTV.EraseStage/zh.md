> 涂蒙版抹掉不需要的物体，AI 用周围内容填补，无需提示词，点 ▶ 运行。

## 这个节点是做什么的

**Erase（擦除）** 与 Inpaint 共用同一套 **蒙版画笔 UI**，但逻辑相反：你涂出要**去掉**的区域，Run 后工作流用 LaMa 等模型根据周围像素**智能填充**，**没有 main_prompt 输入**。

**生成式** Stage，需 **▶ 运行**。工作流：[`workflows/erase/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/erase)。

## 适用场景

- 去水印、路人、电线、杂物
- 比 Inpaint 更快（不需想 prompt），适合「让它消失」
- Image Picker「擦除」预设

## 工作原理

- `mask_data` 同 Inpaint；workflow 内置固定 fill prompt，用户不可见。
- 内置 **LaMa Erase** 依赖 [Acly/comfyui-inpaint-nodes](https://github.com/Acly/comfyui-inpaint-nodes) + `big-lama.pt`。
- 只跑本节点 workflow；结果快照供下游。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

`COMFYTV_IMAGE` 入/出 — [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### 蒙版画笔（与 Inpaint 相同）

| 工具 | 用法 |
|---|---|
| **✏️ 画笔** | 涂**要删除**的区域（稍大于物体边缘更稳） |
| **🧽 橡皮** | 修正蒙版 |
| **▭ / ◯ / ①** | 形状与标号（可选） |
| **笔刷大小 / 不透明度 / 硬度** | 边缘过渡 |
| **Clear** | 清空蒙版 |

Erase **不需要**写提示词；涂准要删的区域即可。

### image（输入）

源图。

### workflow

[erase README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/erase/README.zh.md)

| 内置 | 依赖 |
|---|---|
| **LaMa Erase** | comfyui-inpaint-nodes + `big-lama.pt` → `models/inpaint/` |

[models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)

### mask_data（隐藏）

画笔序列化数据。

### 自定义参数（custom_params）

侧栏参数（一般仅 seed）。

## 输出说明

| 输出 | 类型 |
|---|---|
| **image** | 擦除并填补后的 `COMFYTV_IMAGE` |

## 新手一步一步

1. 添加 **Erase**，接入图片。
2. 确认已安装 inpaint-nodes 并下载 **big-lama.pt**。
3. workflow 选 **LaMa Erase**。
4. **画笔**涂要去除的物体（可略大于边缘）。
5. **▶ 运行**（无需填 prompt）。
6. 有残留：扩大蒙版或再 Run 一次。

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
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/erase |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/erase/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：缺少 INPAINT_ 节点？**  
A：安装 comfyui-inpaint-nodes 后重启 ComfyUI。

**Q：擦除区域模糊？**  
A：扩大蒙版范围；复杂纹理可改用 **Inpaint** 并填写 prompt。

**Q：和 Inpaint 有什么区别？**  
A：Erase 是擦除物体；Inpaint 是用 prompt 描述的内容替换蒙版区域。

## 相关节点

- **Inpaint** — 蒙版 + prompt 重绘
- **Image Edit** — 整图指令
- **Cutout** — 抠主体（非局部擦除）
