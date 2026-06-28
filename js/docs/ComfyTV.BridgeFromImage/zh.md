# ← ComfyTV 图像 (Bridge From Image)

> **出桥**：**COMFYTV_IMAGE** URL 快照 → 原生 **IMAGE** 内存图像；**无 ▶ 运行**，随 ComfyUI 图执行时从磁盘加载 PNG。

## 这个节点是做什么的

ComfyTV stage 输出 **`COMFYTV_IMAGE`**（字符串 URL）。原生节点——**IPAdapter**、ControlNet、Save Image、VAE Encode——需要 **`IMAGE`** 内存图像。**← ComfyTV Image** 在图执行时解析 `/view?`，从 `output/` / `input/` / `temp` 读 PNG，转成 `[1,H,W,C]` float 内存张量。

与 **→ ComfyTV Image** 方向相反：ComfyTV → 原生插件生态。

```
[Upscale Stage] ──COMFYTV_IMAGE──→ [← ComfyTV Image] ──IMAGE──→ [IPAdapter / Save Image / …]
                                        （无 Run，Queue 时加载）
```

## 适用场景

- ComfyTV 编辑结果送回 IPAdapter 二次风格化
- ComfyTV 出图 → ComfyUI 原生放大 / face restore
- ComfyTV 流水线末端 **Save Image** 落盘

## 工作原理

- **不是 Stage**（无 Run、无快照写入）——普通 ComfyUI 节点，**Queue 整图** 时 execute。
- `_load_image_tensor`：RGB + 若有 alpha 通道则同时可读（蒙版见 **← ComfyTV Mask**）。
- URL 必须是 ComfyTV 格式 `/view?filename=…&subfolder=…&type=output`。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV | 原生 |
|---|---|
| `COMFYTV_IMAGE` URL | `IMAGE` 内存图像 |

入 ComfyTV：**→ ComfyTV Image**（须 Run）。见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image
上游 **COMFYTV_IMAGE**。空字符串 → 报错。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **IMAGE** | ComfyUI IMAGE | 任意原生 IMAGE 输入 |

## 新手一步一步

1. ComfyTV 链末端有 **COMFYTV_IMAGE**（如 **Upscale** Run 后）。
2. 拖 **← ComfyTV Image**，连线。
3. 接到 IPAdapter / Save Image。
4. 用 ComfyUI **Queue** 跑整图（不是 ComfyTV stage Run）。

## 链接

| 资源 | 链接 |
|---|---|
| Bridge 指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md |
| ComfyTV 仓库 | https://github.com/jtydhr88/ComfyTV |

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) | COMFYTV_* 与原生类型、入桥/出桥、IPAdapter 等示例 |
| [自定义工作流](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) | 导入自己的 ComfyUI JSON，不改 Python |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **Bridge 实现源码** | https://github.com/jtydhr88/ComfyTV/blob/main/nodes/bridges.py |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题 FAQ

**Q：出桥要不要 Run？**  
A：**不要**。入桥（→）要 Run；出桥（←）随 Queue 加载。

**Q：ComfyTV stage 还没 Run，出桥有图吗？**  
A：没有有效 URL。先 Run 上游 ComfyTV stage 或入桥。

**Q：带 alpha 的 PNG？**  
A：RGB 进 IMAGE；alpha 反相为蒙版请用 **← ComfyTV Mask**。

**Q：IPAdapter 完整例子？**  
A：`[Load Image] → [IPAdapter] IMAGE → [→ ComfyTV Image] Run → [Image Picker] → [Upscale]`。

**Q：Queue 和 Run 混淆？**  
A：**Run** = ComfyTV stage 快照（入桥必须）；**Queue** = 跑整条 ComfyUI 图（出桥在 Queue 时加载）。

## 相关节点

- **→ ComfyTV Image**
- **← ComfyTV Mask**
- **Upscale** / **Cutout** —— 常见上游
