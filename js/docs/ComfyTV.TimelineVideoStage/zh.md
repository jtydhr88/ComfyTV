# 时间线渲染

> 把 **Director Timeline** 编排好的序列编码成成品视频——多镜时间线的「导出」步骤。

## 这个节点是做什么的

**时间线渲染**（Timeline Render）读取上游 `COMFYTV_TIMELINE` JSON，调用所选 **timeline workflow** 后端，将各 segment 的图片（与可选音轨）**拼接/编码**为一条 `COMFYTV_VIDEO`。

与 Director Timeline 的关系：**Director Timeline** 负责剪辑表编排，**Timeline Render（本节点）** 负责导出成片。没有文本 prompt——时长、顺序、素材 URL 全部来自时间线 JSON。

## 适用场景

- Shot Images + Director Timeline 工作流最后一步，导出可分享的 MP4。
- 调整时间线后**只 Re-Run 本节点**，无需重跑所有分镜出图。
- 验证 BGM 与画面长度是否对齐（Render 前在 Director Timeline 听预览）。

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage + ▶ 运行**：只跑 timeline workflow，不触发上游 Shot Images / Storyboard 重跑；进度按 segment 回调（`shot 2/5` 等）。
- **快照**：使用 Director Timeline 当前保存的 timeline 快照；若改了时间线但未 Re-Run Render，成片仍是旧版——需再次 Run 本节点。
- **workflow 下拉框**：映射 timeline 类 runner。当前内置 **Multishot (placeholder)** 为演示用占位后端（返回 sample 视频 URL）；正式 multishot 编码 workflow 见 [roadmap.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.md)。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_TIMELINE` | 时间线 JSON | **timeline** 输入，来自 Director Timeline |
| `COMFYTV_VIDEO` | 视频快照 | **video** 输出；不是 ComfyUI 内存视频 |
| `COMFYTV_IMAGE` | 单图 | 已编进 timeline segments，不直连本节点 |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### workflow

- **是什么**：时间线渲染后端；启动时从仓库注册的 timeline 类 workflow 加载选项。
- **当前内置**：**Multishot (placeholder)** —— 开发占位，非最终生产编码器。
- **选项从哪来**：仓库 [runners/](https://github.com/jtydhr88/ComfyTV/tree/main/runners) 注册 + 未来 `workflows/timeline/` 工作流文件。
- **需要什么**：视具体 workflow；占位 runner 无需本地模型。
- **影响**：决定编码方式、是否真拼接 segment 等。

### timeline

- **是什么**：上游 `COMFYTV_TIMELINE` 连线。
- **填什么**：**Director Timeline → timeline**。
- **误区**：空 timeline 或 segments 为空会导致无效/占位输出。

### 自定义参数（custom_params）（隐藏）

- 侧栏绑定的额外 workflow 参数（随 timeline workflow 演进）。

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

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [拼接与编排](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | Image Picker、Compare、Storyboard→Shot Images、时间线 |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/timeline |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/timeline/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：输出是示例视频，不是我的画面？**  
A：**Multishot (placeholder)** 在正式 timeline workflow 上线前会返回演示片段。

**Q：Run 没反应？**  
A：确认 **timeline** 已连线且 Director Timeline 有非空 segments；查看控制台。

**Q：与 Video Stage 有何区别？**  
A：Video Stage **生成** AI 视频（文/图生视频）。Timeline Render **编码已编排的帧**。生成 vs 拼接/导出。

**Q：workflow 列表灰色？**  
A：重启 ComfyUI 重新扫描；timeline runner 在启动时注册。

**Q：Load 与 generate 的区别？**  
A：**Load Video** 导入文件；本节点从 timeline JSON **编码**新成片。Loader 不能替代 Render。

## 相关节点

- **Director Timeline** —— 必需上游编排。
- **Shot Images** —— 常见 segment 素材来源。
- **Video Stage** —— 单段 AI 视频生成，不同用途。
- **Video Clip** / **Video Upscale** —— 成片后处理。
- **Load Video from Asset** —— 从库复用 Render 结果。
