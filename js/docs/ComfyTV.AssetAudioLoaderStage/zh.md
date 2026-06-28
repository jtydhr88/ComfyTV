# 从资产库加载音频

> 从 ComfyTV **项目资产库**选取音频——复用 Speech/Music Stage 生成或导入的音轨，作为 Video Stage、时间线或参考音频的输入。

## 这个节点是做什么的

**从资产加载音频**（Load Audio from Asset）让你在节点主体内浏览当前项目的音频资产：分类、搜索、条目列表。点击后输出 `COMFYTV_AUDIO` 快照，**无需 ▶ 运行**。

资产库中的音频通常来自 **Speech Stage**（TTS）、**Music Stage**（文生音乐）、**Demux** 分离轨、或侧栏手动导入。与 **加载音频**（读 `input/` 文件夹）互补。

## 适用场景

- 多次使用同一段配音，避免重复 Run Speech Stage。
- 将已生成 BGM 接到 **Video Stage → audio**（IA2V）。
- 作为 **Speech Stage → reference_audio** 的声音参考（克隆/风格）。
- 拖到 **Director Timeline** 的 optional **audio** 口做音轨铺底。

## 工作原理（为什么 ComfyTV 这样设计）

- **Instant stage**：选取即快照，不跑 workflow。
- **快照语义**：下游 Run 时用当前选中 URL；换选即更新。
- **项目隔离**：只有同一 **Project** 下的 stage 产出会出现在库里。
- **载入 vs 生成**：本节点是**载入**已有成果；**Speech/Music Stage** 才是**创造**新音频（FAQ 重点）。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_AUDIO` | 音频 URL 快照 | 不是 ComfyUI 内存音频 |
| `COMFYTV_VIDEO` | 含音轨的视频 | 可用 Demux 再进库 |
| 原生 `AUDIO` | ComfyUI 内存音频 | **→ ComfyTV Audio** Bridge |

详见：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### 资产选取器

- 缩略图/波形预览（视 UI）、分类、搜索。
- 空库：先 Run **Speech Stage** / **Music Stage** 或导入。

### asset_url / asset_id / category（隐藏）

- UI 写入；持久化 category 筛选。

### 项目 id（project_id） / 父输出来源 id

- 隐藏内部字段。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **audio** | `COMFYTV_AUDIO` | 所选音频快照 | Video Stage（audio）、Director Timeline（audio）、Speech Stage（reference_audio） |

## 新手一步一步

1. 添加 **Project** 并命名。
2. Run **Speech Stage** 生成台词，或 **Music Stage** 生成 BGM（或侧栏导入）。
3. **Add Node → Input → Load Audio from Asset**。
4. 在节点内点击目标音频。
5. 连到 **Video Stage** 的 **audio** 或其它消费口。
6. 在下游 **▶ 运行**（若下游是生成 stage）。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |
| [生成内容](https://github.com/jtydhr88/ComfyTV/blob/main/docs/generate.zh.md) | Text / Image / Video / Music / Speech 生成器与 workflow 选型 |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：和加载音频（input/）比？**  
A：外部文件 → **加载音频**。项目内生成/导入 → **本节点**。

**Q：和 Speech Stage 比？**  
A：Speech **生成**；本节点从库**选取**。此处无 TTS。

**Q：类型不匹配？**  
A：期望 `COMFYTV_AUDIO`；原生 `AUDIO` 需先 Bridge 进库。

**Q：分类筛选后为空？**  
A：切到 `all`；确认该分类下有资产。

## 相关节点

- **加载音频** —— `input/` 原始文件。
- **Speech Stage** / **Music Stage** —— 写入新音频。
- **Video Stage** —— 消费 audio 做 IA2V。
- **Director Timeline** —— 时间线音轨。
- **从资产加载视频** / **从资产加载图片** —— 姊妹节点。
