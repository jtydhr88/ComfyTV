> 把 **Director Timeline** 编排好的序列编码成成品视频——多镜时间线的「导出」步骤。

## 这个节点是做什么的

**时间线渲染**（Timeline Render，节点 ID `TimelineVideoStage`）读取上游 `COMFYTV_TIMELINE` JSON，调用所选 **timeline workflow** 后端，将各 segment 的图片（与可选音轨）**拼接/编码**为一条 `COMFYTV_VIDEO`。

与 Director Timeline 的关系：前者**剪辑表**，后者**成片**。没有文本 prompt——时长、顺序、素材 URL 全部来自时间线 JSON。

## 适用场景

- Shot Images + Director Timeline 工作流最后一步，导出可分享的 MP4。
- 调整时间线后**只 Re-Run 本节点**，无需重跑所有分镜出图。
- 验证 BGM 与画面长度是否对齐（Render 前在 Director Timeline 听预览）。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage + ▶ 运行**：只跑 timeline workflow，不触发上游 Shot Images / Storyboard 重跑；进度按 segment 回调（`shot 2/5` 等）。
- **快照**：使用 Director Timeline 当前保存的 timeline 快照；若改了时间线但未 Re-Run Render，成片仍是旧版——需再次 Run 本节点。
- **workflow 下拉框**：映射 timeline 类 runner。当前内置 **Multishot (placeholder)** 为演示用占位后端（返回 sample 视频 URL）；正式 multishot 编码 workflow 见 [roadmap.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md)。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_TIMELINE` | 时间线 JSON | **timeline** 输入，来自 Director Timeline |
| `COMFYTV_VIDEO` | 视频快照 | **video** 输出；非原生 `VIDEO` tensor |
| `COMFYTV_IMAGE` | 单图 | 已编进 timeline segments，不直连本节点 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### workflow

- **是什么**：时间线渲染后端；选项来自 `RUNNER_REGISTRY` 中 `kind='timeline'` 的 runner。
- **当前内置**：**Multishot (placeholder)** —— 开发占位，非最终生产编码器。
- **选项从哪来**：仓库 [runners/](https://github.com/jtydhr88/ComfyTV/tree/main/runners) 注册 + 未来 `workflows/timeline/` 工作流文件。
- **需要什么**：视具体 workflow；占位 runner 无需本地模型。
- **影响**：决定编码方式、是否真拼接 segment 等。

### timeline

- **是什么**：上游 `COMFYTV_TIMELINE` 连线。
- **填什么**：**Director Timeline → timeline**。
- **误区**：空 timeline 或 segments 为空会导致无效/占位输出。

### custom_params / force_run_token

- 标准 stage 隐藏字段；侧栏可绑额外 workflow 参数（随 timeline workflow 演进）。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接什么 |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | 渲染后的视频快照 | Video Clip、Upscale、Demux、Compare（需 Extract Frame） |

## 新手一步一步

1. 完成 **Storyboard → Shot Images → Director Timeline** 编排（或等价素材链）。
2. 添加 **Timeline Render**，**timeline** 接 Director Timeline 输出。
3. **workflow** 选可用项（如 Multishot placeholder）。
4. **▶ 运行**，观察逐 segment 进度。
5. 在节点预览播放成片；满意则接 **Video Upscale** 或 **从资产库** 另分支复用。
6. 若改时间线：只 Re-Run 本节点（不重跑 Shot Images）。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**。完整操作流程、多节点串联、类型转换与原理，请阅读上游官方仓库 [**jtydhr88/ComfyTV**](https://github.com/jtydhr88/ComfyTV) 的用户指南（文档链接均指向上游 `main`，而非本地 fork）：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |

## 上游仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **官方仓库（上游）** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/timeline |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/timeline/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：节点帮助和完整教程有什么区别？**  
A：本页只介绍**这一个节点**的参数与连线。端到端流程、多节点串联和原理说明见上方 **「完整教程（推荐阅读）」** 中的 upstream 用户指南。

**Q：链接为什么指向 jtydhr88/ComfyTV，而不是我的 fork？**  
A：官方文档与用户指南维护在[上游仓库](https://github.com/jtydhr88/ComfyTV)的 `main` 分支；本地 clone/fork 用于开发与贡献，节点帮助内的链接统一指向上游，避免 fork 与官方文档不一致。

**Q：`COMFYTV_*` 类型和 ComfyUI 原生类型连不上怎么办？**  
A：ComfyTV stage 传递的是项目内 **URL 快照**（如 `COMFYTV_IMAGE`），不是 GPU 里的 `IMAGE` tensor。请使用 **ComfyTV/Bridge** 下的入桥（→）或出桥（←）转换。完整说明见 [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) 教程。

## 相关节点

- **Director Timeline** —— 必需上游编排。
- **Shot Images** —— 常见 segment 素材来源。
- **Video Stage** —— 单段 AI 视频生成，不同用途。
- **Video Clip** / **Video Upscale** —— 成片后处理。
- **Load Video from Asset** —— 从库复用 Render 结果。
