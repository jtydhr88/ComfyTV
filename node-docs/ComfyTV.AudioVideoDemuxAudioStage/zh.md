# 分离音轨 (Demux · Audio Track)

> 从视频容器里 **提取音轨** 为独立 `COMFYTV_AUDIO`，**PyAV** 处理；与 **Demux · Silent Video** 配对使用。

## 这个节点是做什么的

**Demux · Audio Track** 读取 `COMFYTV_VIDEO` 里的音频流，写出独立音频文件（注册为 `/view?` URL）。画面不要了时用本节点；只要无声画面用 **Demux · Silent Video**。

视频 stage 工具栏 🔀 **Demux** 一键同时创建 **Audio Track** + **Silent Video** 两个下游节点并连线。

## 适用场景

- 提取 BGM / 对白做 **Audio Stage** 或 IA2V 输入
- 分离后再对人声跑 **Vocals Only**（Demucs，⏳ 待支持）
- 替换音轨：Silent Video + 新 **Audio Stage** → 再合并（外部 ffmpeg 或未来 Timeline）

## 工作原理

- **Stage** + **▶ 运行**；PyAV `demux_audio`，不占 GPU。
- **快照**：输出音频 URL 持久化在项目里。
- 与 Silent Video 共享同一源视频快照；各 Run 各写文件。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_VIDEO` | 输入视频快照 | 非 `VIDEO` |
| `COMFYTV_AUDIO` | 输出音轨快照 | 非 `AUDIO` dict |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### video
源 `COMFYTV_VIDEO`。必填。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **audio** | `COMFYTV_AUDIO` | **Video Stage**（IA2V）、**Audio Stage**、**← ComfyTV Audio** |

## 新手一步一步

1. Run 上游 **Video Stage** 或 **Load Video**。
2. 拖 **Demux · Audio Track**，连 **video**；或在上游视频节点点 🔀 **Demux** 自动建链。
3. **▶ 运行**。
4. 把 **audio** 接到 **Video Stage** 的 **audio** 口（IA2V）或 **Audio · Vocals Only**（待支持）。

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

**Q：视频没声音轨？**  
A：PyAV 可能写出空文件或报错；确认源片含音频。

**Q：Demux 按钮在哪？**  
A：上游 **Video Stage** / 视频编辑 stage 工具栏 🔀 **Demux**。

**Q：能输出 ComfyUI AUDIO 吗？**  
A：后接 **← ComfyTV Audio**。

**Q：Demux 和 Bridge 区别？**  
A：**Demux** 已在 ComfyTV 内，输出 `COMFYTV_AUDIO`；**→ ComfyTV Audio** 把 **原生 AUDIO** 转成 COMFYTV。Demux 后 **不需要** 再 Demux。

**Q：提取的格式？**  
A：PyAV 按源容器音轨导出，常见 aac→m4a 或转码为 ComfyTV 可读的音频文件。

**Q：Demux 音轨能直接 IA2V 吗？**  
A：可以，**Demux · Audio Track** 的 `COMFYTV_AUDIO` 直接接 **Video Stage** 的 **audio**，无需 **→ ComfyTV Audio**。

## 相关节点

- **Demux · Silent Video**
- **Audio · Vocals Only** / **Background Only**（待支持）
- **Video Stage**（IA2V）
