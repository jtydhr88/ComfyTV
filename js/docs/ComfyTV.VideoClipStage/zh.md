# 视频剪辑 (Video Clip)

> 按起止时间剪出一段子片段，保留原帧率，**PyAV** 在磁盘处理，输出新的 `COMFYTV_VIDEO` 快照。

## 这个节点是做什么的

**Video Clip**（trim）从完整视频里切 **[start_s, end_s]** 区间，丢掉头尾。适合从长生成结果里取精华、对齐口型片段、或缩短后再 Crop / Resize。**end_s** 留 0 或 ≤ start 时，自动用到源片总时长。

不占 GPU；PyAV 流式读写，输出写到 ComfyUI output 目录并注册为 `/view?` URL。

## 适用场景

- 从长 T2V / I2V 结果截取 usable 段落
- 统一多段素材时长后再 Timeline 拼接
- 剪短后再 Demux 或 Extract Frame

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** + **▶ 运行**：只重剪本节点输入快照，不 Queue 整图。
- **快照**：下游读 Clip 输出；改 **start_s/end_s** 后须再 Run 更新。
- **PyAV**：[`runners/media.py`](https://github.com/jtydhr88/ComfyTV/blob/main/runners/media.py) 里 `trim_video` 处理容器与时间戳。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_VIDEO` | 视频 URL 快照 | 需 Bridge 与 `VIDEO` 互通 |

**如何转换：** 见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## 界面与参数说明

### video（输入）
源 `COMFYTV_VIDEO`。必填。

### start_s
片段起点（秒），默认 0。

### end_s
片段终点（秒），默认 5。设为 0 或未填时 → 用到源视频 **duration**。必须 **> start_s**。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | 剪后的片段 | Crop、Resize、Demux、Extract Frame |

## 新手一步一步

1. Run 上游 **Video Stage** 或 **Load Video**。
2. 拖 **Video Clip**，连 **video**。
3. 设 **start_s** / **end_s**（秒）。
4. **▶ 运行**，预览缩略图时长。
5. 接 **Video Crop** 或 **Demux** 继续。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：end_s 超过总时长？**  
A：会被 clamp；仍须 **> start_s**。

**Q：帧率会变吗？**  
A：不会——PyAV 保留源帧率。

**Q：mesh2motion 的 VIDEO 怎么剪？**  
A：先 **→ ComfyTV Video**（Run 快照），再接 Clip。

## 相关节点

- **Video Crop** / **Video Resize**
- **Demux · Audio Track** / **Silent Video**
- **→ ComfyTV Video** —— 原生视频入 ComfyTV
