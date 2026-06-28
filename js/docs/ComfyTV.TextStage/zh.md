# 文本阶段 (Text Stage)

> 用本地 LLM 根据你的指令生成一段文字，可扩写提示词、写场景描述，或为图像/视频 stage 提供上下文。

## 这个节点是做什么的

**Text Stage** 是 ComfyTV 的「文字生成器」。你在 **main_prompt** 里写要 LLM 做什么（例如「把下面大纲扩写成 3 段电影旁白」），选好 **workflow**（背后是一套 ComfyUI 子工作流），点 **▶ 运行**，节点预览里会出现生成的字符串。

输出类型是 `COMFYTV_TEXT`——不是 ComfyUI 原生的字符串 socket，而是一段带项目快照的文本 URL/载荷，可以接到 Image Stage、Video Stage 的 **texts** 输入，自动拼进它们的提示词。

Text Stage 还可以接收上游的 **texts**、**images**、**videos** 作为多模态上下文（具体是否被 workflow 使用，取决于你选的 backend 和 预设方案绑定）。

## 适用场景

- 用 LLM 扩写简短想法，再接到 Image / Video Stage 做文生图、文生视频。
- 批量生成产品描述、分镜旁白、角色小传等纯文本内容。
- 把多个上游 Text 输出合并：接到 **texts** 槽，与 **main_prompt** 换行拼接后送给 LLM。
- 为 Storyboard Stage 预写故事前提（也可直接用 Storyboard 自己的 main_prompt）。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** = 带 **▶ 运行** 的步骤；点运行**只执行本节点**，不会让整个 ComfyUI 图进入 Queue。
- **快照**：Run 一次后，文本结果存进当前项目；下游 stage 再 Run 时读这份快照，**不会自动重跑** Text Stage。
- **workflow 下拉框** = 仓库 [`workflows/text/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/text) 里注册的 ComfyUI 子工作流 JSON。ComfyTV 负责把 `main_prompt`、seed、max_length 等映射进子图。

文本工作流不保存图片；ComfyTV 直接从 LLM 节点读取生成的字符串。

## 类型说明（COMFYTV_TEXT vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
| --- | --- | --- |
| `COMFYTV_TEXT` | 生成文本的项目快照 | 不是 ComfyUI 原生 STRING 文本接口 |
| 原生 STRING / 文本节点 | 内存里的字符串 | 不能直连 ComfyTV stage 的 texts 输入 |

**如何转换：**

- 原生 → ComfyTV：**ComfyTV/Bridge** → **→ ComfyTV Text**（Run 后存快照）
- ComfyTV → 原生：**← ComfyTV Text**（读快照变回 ComfyUI 内存图像/字符串供原生节点使用）

详见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## 界面与参数说明

### workflow

选择 [`workflows/text/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/text) 中的文本 backend。当前内置 **Local Qwen3 4B**（Qwen3 4B chat，经 `TextGenerate` 节点）。列表为空或选项变灰时，重启 ComfyUI 或检查 workflow 文件是否安装完整。

需要 **Qwen3 4B** 等模型，见 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)。

### main_prompt（主提示词）

你对 LLM 的主指令。上游 **texts** 会按换行追加在后面，形成完整 prompt。

**示例**：`请用中文写三段描述：清晨的咖啡店、雨中的街道、夜景霓虹。`

### texts / images / videos（上游上下文）

可追加多个的接口槽，可接多个上游 stage 输出。Text 最常用；images/videos 留给支持多模态的 workflow（当前 Local Qwen3 4B 以文本为主）。

### 自定义参数（custom_params）（自定义参数）

在选中 stage 后，左侧 **ComfyTV** 侧栏配置额外参数（如 `max_length`、seed、temperature），映射到子工作流里的对应节点。详见 [sidebar-config-editor.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/sidebar-config-editor.zh.md)。

### 项目 id（project_id） / 父输出来源 id / 强制重跑标记

由 UI 自动管理，一般无需手改。绑定当前 Project 与输出 lineage。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
| --- | --- | --- | --- |
| **text** | `COMFYTV_TEXT` | 本次 Run 生成的字符串快照 | Image / Video / Storyboard Stage 的 **texts**；Bridge ← ComfyTV Text |

## 新手一步一步

1. 画布上先放 **Project**，再 **Add Node → ComfyTV → Generate → Text Stage**。
2. **workflow** 选 **Local Qwen3 4B**（或你安装的后端）。
3. 在 **main_prompt** 输入：`写一句赛博朋克风格的电影开场旁白，20 字以内。`
4. 确认已下载 Qwen3 4B 模型（见 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)）。
5. 点 **▶ 运行**，等待节点预览出现文字。
6. 拖一个 **Image Stage**，把 Text Stage 的 **text** 接到 Image 的 **texts**（或复制 main_prompt 内容）。
7. 在 Image Stage 写视觉描述或直接依赖 LLM 输出，再 Run 生成图片。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |
| [自定义工作流](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) | 导入自己的 ComfyUI JSON，不改 Python |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/text |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/text/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题

**Q：Run 后没文字 / 报错 no runner registered？**  
A：workflow 名称与 registry 不一致。重启 ComfyUI 加载新 workflow；或在侧栏重新绑定 preset。

**Q：text 输出连不上 Image Stage？**  
A：确认连的是 **texts** 或 **COMFYTV_TEXT** 兼容口，不是 ComfyUI 原生 STRING。需要时用 Bridge。

**Q：改了 main_prompt 但下游 Image 还用旧描述？**  
A：快照机制——下游不会自动重跑 Text Stage。先重新 Run Text Stage，再 Run Image Stage。

## 相关节点

- **Image Stage / Video Stage**——消费 `COMFYTV_TEXT` 作为提示词上下文。
- **Storyboard Stage**——也用 LLM，但输出结构化分镜 JSON 而非纯文本。
- **Bridge → ComfyTV Text / ← ComfyTV Text**——与原生 ComfyUI 文本节点互通。
- **Project**——提供项目上下文。
