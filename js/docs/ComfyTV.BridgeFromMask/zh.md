# ← ComfyTV 蒙版 (Bridge From Mask)

> **出桥**：从 **COMFYTV_IMAGE**（常带 alpha 的 PNG）提取 **MASK** 内存蒙版；**无 ▶ 运行**，Queue 时加载。

## 这个节点是做什么的

ComfyTV **Cutout**、带 alpha 的 bridge PNG 等输出 **`COMFYTV_IMAGE`**。ComfyUI inpaint / ControlNet 等要 **`MASK`**。按 ComfyUI 约定，mask 高值表示 **保留区域**；本节点将 PNG **alpha 反相** 为 mask（`mask = 1.0 - alpha`），与 `_load_image_tensor` 逻辑一致。

与 **← ComfyTV Image** 共用同一 URL 输入：Image 口要 RGB，Mask 口要 alpha 蒙版。

## 适用场景

- ComfyTV **Cutout** → 原生 **Inpaint**
- ComfyTV 编辑结果 → ControlNet Inpaint
- 同一张 COMFYTV_IMAGE 分叉：← Image + ← Mask

## 工作原理

- 普通节点，无 Run。
- 有 alpha：`mask = 1.0 - alpha`；无 alpha：全零 mask。
- 输出 shape `[1,H,W]` float。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 输入 | 输出 |
|---|---|
| `COMFYTV_IMAGE` | ComfyUI `MASK` |

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image
含 alpha 的 **COMFYTV_IMAGE** 最佳；无 alpha 则输出空蒙版。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **MASK** | ComfyUI MASK | Inpaint、ControlNet Apply |

## 新手一步一步

1. **Cutout** 或带透明 PNG 的 ComfyTV 输出。
2. **← ComfyTV Mask** 连 **image**。
3. MASK 接 Inpaint 等；RGB 另接 **← ComfyTV Image**。

## 链接

| 资源 | 链接 |
|---|---|
| Bridge 指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md |

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

**Q：Cutout 后 mask 全白/全黑不对？**  
A：确认 PNG 含 alpha；Cutout 输出应为带透明背景。

**Q：和 Inpaint Stage 蒙版画笔关系？**  
A：Inpaint Stage 在 ComfyTV 内画 mask；本节点是把 ComfyTV 结果 **导出** 给原生 inpaint。

## 与 ← ComfyTV Image 并用

同一张 **COMFYTV_IMAGE** 常分两路：

```
[Cutout] ──COMFYTV_IMAGE──┬──→ [← ComfyTV Image] ──→ IPAdapter / VAE
                          └──→ [← ComfyTV Mask]   ──→ Inpaint / ControlNet
```

RGB 与蒙版来自同一 PNG 文件，无需两次 Run 上游。

**Q：Inpaint 蒙版反了？**  
A：ComfyUI 各 inpaint 节点 convention 不同；若反了可在原生侧 **Invert Mask** 再试。

## 相关节点

- **← ComfyTV Image**
- **Cutout** / **Inpaint**
- **→ ComfyTV Image**（插件 Cutout 进 ComfyTV 时用）
