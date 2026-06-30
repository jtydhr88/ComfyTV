# ← ComfyTV 文本 (Bridge From Text)

> **出桥**：**COMFYTV_TEXT** 快照 → 原生 **STRING**；**无 ▶ 运行**，Queue 时直接传递字符串。

## 这个节点是做什么的

ComfyTV **Text Stage** 或 **→ ComfyTV Text** 产出 **`COMFYTV_TEXT`**。原生节点（CLIP Text Encode、Show Text、LLM 链）要 **STRING**。**← ComfyTV Text** 原样输出字符串，无磁盘 IO。

用于 ComfyTV 生成文案 → 原生 ComfyUI 工作流其他分支。

## 适用场景

- **Text Stage** 剧情 → 原生 CLIP 编码对比
- ComfyTV prompt 链 → 第三方 STRING 工具
- 调试：Show Text 查看 ComfyTV 快照内容

## 工作原理

- 普通节点；`execute` 返回 `str(text)`。
- 无 Run；随 Queue 执行。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV | 原生 |
|---|---|
| `COMFYTV_TEXT` | `STRING` |

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### text
上游 **COMFYTV_TEXT**。

## 输出说明

| 输出 | 类型 |
|---|---|
| **STRING** | ComfyUI STRING |

## 新手一步一步

1. Run **Text Stage** 或 **→ ComfyTV Text**。
2. **← ComfyTV Text** 连线。
3. STRING 接 CLIP Text Encode 等。
4. Queue 整图。

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

**Q：空字符串？**  
A：上游 ComfyTV text stage 未 Run 或无内容。

**Q：和 → ComfyTV Text 区别？**  
A：→ 进 ComfyTV（Run）；← 出 ComfyTV（无 Run）。

## 入桥 vs 出桥（复习）

| 方向 | 节点前缀 | 有 Run？ | 作用 |
|---|---|---|---|
| 进 ComfyTV | **→ ComfyTV *** | ✅ 必须 Run | STRING/IMAGE/… → COMFYTV_* 快照 |
| 出 ComfyTV | **← ComfyTV *** | ❌ 无 Run | COMFYTV_* → ComfyUI 内存里的数据/STRING |

本节点是 **出桥** 文本方向。完整图解见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

**Q：Show Text 看不到内容？**  
A：确认上游 **Text Stage** 或 **→ ComfyTV Text** 已 Run；出桥不触发 ComfyTV Run。

**Q：能接多个 ← ComfyTV Text 吗？**  
A：可以，各自 STRING 进不同 CLIP 分支或 Concat 节点。

## 相关节点

- **→ ComfyTV Text**
- **Text Stage**
- **Image Stage**（texts 输入来自 COMFYTV_TEXT，非 STRING）
