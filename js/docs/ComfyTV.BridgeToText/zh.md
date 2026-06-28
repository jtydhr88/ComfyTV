# → ComfyTV 文本 (Bridge To Text)

> **入桥**：任意 ComfyUI **STRING**（提示词增强、Caption、LLM）→ **COMFYTV_TEXT** 快照；**▶ 运行** 写入项目 lineage（文本不落盘 PNG，直接存字符串）。

## 这个节点是做什么的

**Image Stage** / **Video Stage** 的 **texts** 输入要 **`COMFYTV_TEXT`**，不能接原生 **STRING**。**→ ComfyTV Text** 把第三方节点输出的字符串（Prompt Enhance、Qwen LLM、自定义 caption）变成 ComfyTV 可传递、可快照的文本 payload。

```
[Prompt Enhance] ──STRING──→ [→ ComfyTV Text] ──COMFYTV_TEXT──→ [Image Stage texts 输入]
                                   ▲ Run
```

与图像入桥不同：文本 **不写 bridge 文件夹**，Run 时直接把字符串注册为 stage 快照。

## 适用场景

- Comfy-Org **Prompt Enhance** → ComfyTV 生图
- 外部 LLM 节点生成剧情/分镜文案 → **Storyboard**（待完善）或 **Text Stage**
- 多段 STRING 合并进 ComfyTV 上下文链

## 工作原理

- **Stage** + **▶ 运行**；`_stage_emit_auto` 存文本快照。
- **force_input** 允许多 STRING 汇入或 widget 手输。
- 下游 stage Run 时读取快照，不自动重跑 LLM，「除非」重 Run 入桥。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 原生 `STRING` | ComfyTV `COMFYTV_TEXT` |
|---|---|
| 内存字符串 / widget | 项目内持久化文本快照 |

出 ComfyTV：**← ComfyTV Text** → STRING。见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### text
上游 STRING 或节点内 multiline 输入。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **text** | `COMFYTV_TEXT` | Image/Video Stage **texts** |

## 新手一步一步

1. LLM / Prompt Enhance 输出 STRING。
2. **→ ComfyTV Text**，连线。
3. **▶ 运行**。
4. 接到 **Image Stage** 的 **texts**（可多个 COMFYTV_TEXT 链）。

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

**Q：Queue 和 Run 混淆？**  
A：**Run** = ComfyTV stage / 入桥写入快照（本节点必须 Run）；**Queue** = 跑整条 ComfyUI 图。入桥不能用 Queue 代替 Run。

**Q：还要写 main_prompt 吗？**  
A：**texts** 作上下文追加；stage 上 **main_prompt** 仍是主指令。可只用其一。

**Q：STRING 没连线能 Run 吗？**  
A：可以，用节点内 multiline 手输。

**Q：和 Text Stage 区别？**  
A：**Text Stage** 自己调 LLM workflow 生成；入桥只 **转发** 已有 STRING。

**Q：多个 STRING 源能合并吗？**  
A：可链多个 **→ ComfyTV Text**，各自 Run，再全部接到 Image Stage **texts**（多上下文）。

**Q：会写 bridge 文件夹吗？**  
A：**不会**。文本快照只在项目 lineage 里；图像/视频/音频入桥才写 `output/ComfyTV/bridge/`。

## 相关节点

- **Image Stage** / **Video Stage**
- **← ComfyTV Text**
- **Text Stage**
