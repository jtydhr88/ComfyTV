# 故事板 (Storyboard Stage)

> 用 LLM 把简短故事大纲扩写为结构化分镜表（每镜 16 个字段），供 Shot Images 逐镜出图——本节点本身不生成图片。

## 这个节点是做什么的

**Storyboard Stage**（显示名 **Storyboard**）是「分镜脚本生成器」。你在 **main_prompt** 写故事前提（一两句话概述情节），设置总时长和镜头数，点 **▶ 运行**，LLM 返回 **`COMFYTV_STORYBOARD`**——一份 JSON 镜头表，包含每镜的时长、画面描述、景别、对白、图生提示词等 **16 个字段**。

节点内嵌**分镜编辑器**：Run 后可在 UI 里改每一镜的 prompt、时长、对白，再交给下游 **Shot Images Stage** 为每个镜头生成一张图。

**注意**：Storyboard 输出的是**文本结构**，不是图片。逐镜画面在 **Shot Images Stage** 生成。

## 适用场景

- 短片、广告、MV 前期：先出分镜表再批量出关键帧。
- 固定 **shot_count**（如 6 镜）和 **total_duration_s**（如 30 秒），让 LLM 自动分配每镜时长。
- 预先定义 **characters** 角色卡，保证每镜提到同一角色时描述一致。
- Text Stage 扩写大纲 → Storyboard 拆镜 → Shot Images 出图 → Video Stage 动起来的完整流水线。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** 只跑 [`workflows/storyboard/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/storyboard) 里的 LLM 子 workflow。
- ComfyTV 在发送给 LLM 前，会把 **main_prompt + 上游 texts**、**total_duration_s**、**shot_count**、**characters** 拼成结构化指令，要求 LLM **严格输出指定数量的镜头**。
- LLM 返回的文本会解析为 JSON 分镜表；结果存快照，下游 Shot Images 读 **`storyboard`** 接口，按镜号循环调用图像工作流。

文本输出不经过 SaveImage；需在侧栏工作流预设里声明从哪个 LLM 节点读取字符串。

## 类型说明（COMFYTV_STORYBOARD）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
| --- | --- | --- |
| `COMFYTV_STORYBOARD` | 结构化镜头表 JSON 快照 | 无 ComfyUI 原生对应类型 |
| `COMFYTV_TEXT` | 纯字符串 | Storyboard 是带 shots 数组的结构化数据 |

Storyboard 不能当普通文本接 Image Stage **texts**；应接 **Shot Images Stage** 的 **storyboard** 输入，或手动复制某一镜的 **image_prompt** 字段。

Bridge 节点目前以 Image/Video/Audio/Text 为主；Storyboard 通常在 ComfyTV 内部流水线使用。

## 界面与参数说明

### workflow

[`workflows/storyboard/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/storyboard) 中的 LLM backend。

仓库 README 说明：当前目录**可能尚无完整内置 JSON**；下拉框里可能出现 runner 注册的占位项（如 Qwen Storyboard stub）。你可自行添加 workflow + `_preset.json` 到该目录，重启 ComfyUI 后即可在下拉框选择。

说明文档：[workflows/storyboard/README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/storyboard/README.zh.md)

### main_prompt（故事前提）

一两句话描述故事核心冲突或场景走向。

**示例**：`一名赛车手在雨夜赛道上发生翻车，回忆闪回揭示事故真相。`

上游 **texts** 会换行拼接到前提后面。

### total_duration_s（总时长）

整段片子的目标秒数（**2–600**，默认 **30**）。LLM 会为每镜分配 **duration**，理想情况下各镜之和接近此值。

### shot_count（镜头数）

要生成的**精确镜头数量**（**1–25**，默认 **6**）。LLM 被指令严格输出这么多镜，不多不少。

### characters（角色卡）

可选，每行一个角色，格式建议：

```
- 林岳_赛车手: 32岁男性,身材精悍,穿白色赛车服
- 沈昭_记者: 28岁女性,短发,持麦克风
```

某镜引用角色时，LLM 会重复完整描述，保证各镜 prompt 可独立用于出图。

### texts（上游文本）

可追加多个的接口槽，可接 Text Stage 扩写结果作为额外前提。

### storyboard_data（分镜数据）

隐藏字段，由**分镜编辑器**读写 serialized JSON。一般不要手改；在 UI 表格里编辑各镜字段后会自动更新。

### 自定义参数（custom_params）

侧栏可绑 LLM 的 max_length、temperature、seed 等。

## 每镜 16 个字段（输出 JSON 结构）

Run 成功后，每个 shot 对象包含（中英字段名在 UI 中对应）：

| 字段 | 含义 |
| --- | --- |
| shot_no | 镜号 |
| duration | 本镜秒数 |
| scene_purpose | 画面描述 / 叙事目的 |
| character | 出场角色名 |
| character_desc | 角色外貌描述 |
| character_img / reference_img | 角色图 / 参考图（可留空） |
| shot_size | 景别（特写、全景等） |
| action | 角色动作 |
| emotion | 情绪 |
| scene_tags | 场景标签 |
| lighting | 光影氛围 |
| sfx | 音效提示 |
| dialogue | 对白 |
| image_prompt | **分镜静帧**文生图提示词 |
| motion_prompt | **视频运动**提示词（给 Video Stage） |

下游 **Shot Images** 主要消费 **image_prompt**；Video Stage 可参考 **motion_prompt**。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
| --- | --- | --- | --- |
| **storyboard** | `COMFYTV_STORYBOARD` | 完整镜头表 JSON 快照 | **Shot Images Stage** 的 **storyboard** |

## 新手一步一步

1. 放 **Project**，可选 **Text Stage** 扩写故事（输出接到 Storyboard **texts**）。
2. **Add Node → ComfyTV → Generate → Storyboard**。
3. **workflow** 选已安装的 LLM backend（需 Qwen 等模型，见 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)）。
4. **main_prompt** 写 1–3 句故事大纲；**total_duration_s** `30`，**shot_count** `6`。
5. 如有固定角色，填入 **characters** 多行描述。
6. 点 **▶ 运行**，在节点内分镜编辑器检查 6 镜内容，按需改 **image_prompt**。
7. 拖 **Shot Images Stage**，**storyboard** 连线 → 选 image workflow → Run 逐镜出图。
8. 选一镜图接 **Video Stage I2V**，motion 描述可参考该镜 **motion_prompt**。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |
| [自定义工作流](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) | 导入自己的 ComfyUI JSON，不改 Python |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/storyboard |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/storyboard/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题

**Q：Run 后没有分镜表 / 报错 NotImplemented？**  
A：当前 workflow 可能是占位 stub。向 `workflows/storyboard/` 添加真实 LLM workflow 并配置 preset，或换已实现的 backend。

**Q：能直接出图吗？**  
A：不能。必须接 **Shot Images Stage** 或手动把 **image_prompt** 复制到 Image Stage。

**Q：镜头数和时长对不上？**  
A：在分镜编辑器里手动微调各镜 **duration**；重新 Run Storyboard 会覆盖编辑。

**Q：storyboard 口连不上 Image Stage texts？**  
A：类型不匹配。用 **Shot Images Stage** 或复制单镜 **image_prompt** 文本。

## 相关节点

- **Text Stage**——上游扩写故事前提。
- **Shot Images Stage**——消费 **storyboard**，为每镜生成图片。
- **Image Stage**——单镜手动出图（复制 image_prompt）。
- **Video Stage**——用 motion_prompt 或 Shot Images 结果做 I2V。
- **Speech Stage**——把各镜 **dialogue** 转成配音。
- **Project**——项目上下文。
