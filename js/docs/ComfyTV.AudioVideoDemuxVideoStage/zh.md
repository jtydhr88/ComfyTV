# 分离无声视频 (Demux · Silent Video)

> 去掉音轨，保留画面，输出无声 `COMFYTV_VIDEO`；**PyAV** 处理，与 **Demux · Audio Track** 配对。

## 这个节点是做什么的

**Demux · Silent Video** 从源视频 **剥离音频流**，写出 **无音轨** 的 mp4（或同等容器）。与 **Demux · Audio Track** 对同一源片操作：一个拿声音，一个拿静音画面。

工具栏 🔀 **Demux** 会 **同时** 创建两个节点并连好线。

## 适用场景

- 原片音轨不要，换成 **Audio Stage** 生成的新音乐
- IA2V 前只要画面轨，音频从别的 stage 接
- 分离后再 **Video Clip** / **Crop** 而不重复处理音频

## 工作原理

- **Stage** + **▶ 运行**；PyAV `silence_video`。
- 视频 fps / 分辨率不变，仅移除 audio track。
- 快照体系与其它视频 stage 一致。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_VIDEO` 入/出 | URL 快照 |

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### video
源 `COMFYTV_VIDEO`。必填。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Clip、Crop、Resize、Video Stage |

## 新手一步一步

1. Run 上游视频。
2. 点 🔀 **Demux** 或手动拖 **Silent Video** 并连线。
3. **▶ 运行** 得无声片。
4. 新音频从 **Demux · Audio Track** 或 **Audio Stage** 另行处理；合并需外部工具或未来 Timeline。

## 链接

| 资源 | 链接 |
|---|---|
| 视频与音频指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md |
| ComfyTV 仓库 | https://github.com/jtydhr88/ComfyTV |

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

**Q：和 Clip 能并行吗？**  
A：可以：Demux → Clip 或 Clip → Demux，按是否需要原音轨选择顺序。

**Q：Silent Video 还能 IA2V 吗？**  
A：可以，**audio** 从别的 **COMFYTV_AUDIO** 接到 **Video Stage**。

**Q：PyAV 会重编码吗？**  
A：通常 remux 或轻量重编码以去掉音轨；画质基本保持。

## 工具栏 🔀 Demux 一键链

在 upstream **Video Stage** 或 PyAV 编辑 stage 的工具栏点 **🔀 Demux**，ComfyTV 自动：

1. 创建 **Demux · Audio Track** 与 **Demux · Silent Video** 两节点；
2. 把当前 **COMFYTV_VIDEO** 连到两者 **video** 输入；
3. 你分别 **▶ 运行** 各节点即可。

比手拖两个节点更不易漏连。详见 [video-and-audio.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md)。

## 相关节点

- **Demux · Audio Track**
- **Video Clip** / **Video Stage**
- **↪ Extend**（视频续接，与 Demux 不同用途）
