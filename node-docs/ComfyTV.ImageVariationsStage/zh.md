> 一次 Run 从单张源图生成多视角或连贯分镜批量，workflow 来自 multiview/ 与 sequence/。

## 这个节点是做什么的

**Image Variations（图像变体）** 把一张上游图扩展成**多张关联图**：要么同一主体的**不同机位**（multiview，并行生成多张），要么**剧情连贯的下一帧**（sequence，链式 Next-Scene LoRA）。输出 **images**（整批 `COMFYTV_IMAGES`）+ **image**（当前选中张 `COMFYTV_IMAGE`）。

**生成式** Stage，需 **▶ 运行**。Image Picker 工具栏 preset 点选会自动插入本节点并预选 workflow。

## 适用场景

- 角色/产品三视图、九机位分镜板
- 四格/二十五格故事推演预览
- 从 **Image Stage** 或 Picker 单图扇出批量再逐张精修
- 比多次 **Multiangle** 更高效（一次提交 N 路 sampler）

## 工作原理

- **workflow** 下拉合并 [`workflows/multiview/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/multiview) 与 [`workflows/sequence/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/sequence) 标签。
- **multiview**：共享模型，N 条并行生成支路，每路 prompt 自动前缀不同角度词。
- **sequence**：帧 N+1 用帧 N 输出作输入，连贯但更长；Storyboard 25 约 10 帧后可能漂移。
- **variant_count** 信息性展示（张数由 workflow 固定）；**selected_index** 选 **image** 单输出。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_IMAGE` | 输入源图 / 单张选中输出 |
| `COMFYTV_IMAGES` | 整批 JSON |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 工具栏 Preset 与 Workflow 对照表

（摘自 [image-tools.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md)）

| Preset | Workflow | 输出 | 后端 | 类型 |
|---|---|---|---|---|
| 🎬 **多机位九宫格** | `Multi-cam 9` | 9 张批量 | Qwen Multiple-Angles LoRA，9 路并行 | multiview |
| 👤 **脸部三视图** | `Face 3-View` | 3 张（正 / 45° / 侧） | 同上 | multiview |
| 📦 **产品三视图** | `Product 3-View` | 3 张（正 / 侧 / 背） | 同上 | multiview |
| 🧍 **角色三视图** | `Character 3-View` | 3 张全身（正 / 侧 / 背） | 同上 | multiview |
| 📖 **剧情推演（4 连贯）** | `Story 4` | 4 张批量 | Qwen Next-Scene LoRA，4 帧串行 | sequence |
| 🎞 **25 宫格分镜** | `Storyboard 25` | 25 张批量 | 同链扩到 25 帧；**~10 帧后可能漂** | sequence |
| 🎥 **电影级光影** | — | 单图 | 会跳转到 **Relight** 节点 | （非本节点） |
| ⏱️ **推演 +3s / +5s** | — | 单图 | 路由到 **Image Edit Stage** | （非本节点） |

**multiview 提示词**：写**主体描述**（如 *「一位 30 多岁的亚洲女商人」*），角度词由 workflow 自动前缀。  
**sequence 提示词**：写**场景 / 故事**，每帧自动加节奏关键词；Story 4 连贯性较好，Storyboard 25 更长更慢。

## 界面与参数说明

### image（输入）

源图 / 种子帧 `COMFYTV_IMAGE`。

### workflow

- multiview 说明：[README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/multiview/README.zh.md)
- sequence 说明：[README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/sequence/README.zh.md)

### variant_count（1–25）

展示将产出的张数；实际由所选 workflow 固定，改此滑块不会改 workflow 分支数。

### main_prompt

主体或场景描述（见上）。

### selected_index

批量中第几张作为 **image** 输出（1 起）；卡片缩略图条可点选。

### 自定义参数（custom_params）

侧栏随机种子（seed）等。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **images** | `COMFYTV_IMAGES` | 全部变体 |
| **image** | `COMFYTV_IMAGE` | 当前选中一张 |

## 新手一步一步

1. 在 Image Picker 点 preset（如「脸部三视图」）或手动添加 **Image Variations**。
2. 上游接源图；**workflow** 确认与 preset 一致。
3. **main_prompt** 写主体/场景（不要写角度列表）。
4. 点 **▶ 运行**（multiview 快于 sequence；25 帧需耐心）。
5. 浏览缩略图条，**selected_index** 选满意的一张从 **image** 口往下接。
6. 或 **images** → **Image Picker** 管理整批。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/multiview |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/multiview/README.zh.md |
| **序列类 workflow** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/sequence |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：改了 variant_count 但输出数量不变？**  
A：每张 workflow 固定数量——请切换 workflow。

**Q：multiview 和 sequence 怎么选？**  
A：同一主体多角度 → multiview；叙事连续帧 → sequence。

**Q：Storyboard 25 漂移？**  
A：已知长链限制——试试 Story 4 或更短 run。

**Q：和 Multiangle 有什么区别？**  
A：Multiangle 是自由设定一个 3D 角度；Variations 每次 Run 输出 preset 的 N 张图。

## 相关节点

- **Multiangle** — 单角度 3D 相机
- **Image Picker** — preset 入口与批量浏览
- **Relight / Image Edit** — preset 路由的单图替代
- **Grid Split** — 物理切已有网格（非 AI 变体）
