# 仅人声 (Audio · Vocals Only)

> **路线图 / 待支持** —— 设计为用 Demucs 从视频/混音里分离 **人声**；workflow 槽位已有，后端待接入。

## 这个节点是做什么的（设计意图）

**Audio · Vocals Only** 接受带音频的 **COMFYTV_VIDEO**（或经 Demux 的轨），运行 **Demucs** 类 workflow，输出 **纯人声** `COMFYTV_AUDIO`。对口型分析、人声替换、卡拉 OK 预处理等。

> ⚠️ **当前状态**：UI 有 **workflow** 下拉（扫描 `workflows/audio-vocal/`，[尚无内置 JSON](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/README.zh.md)），Run 会因无 workflow / 后端失败。路线图计划接 `lum3on/ComfyUI_AudioTools` 的 `AudioStemSeparate`。见 [roadmap.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md)。

## 适用场景（实现后）

- 从 MV 提取人声做 IA2V / 语音合成对齐
- 人声轨单独 **Audio Stage** 处理
- 与 **Background Only** 配对分轨

## 工作原理（规划）

- **Stage** + **workflow** + **▶ 运行** + 快照。
- 输入：`upstream videos: [video]`，无 text prompt。
- 预期 Demucs 模型分离 stem → WAV → `COMFYTV_AUDIO` URL。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_VIDEO` | 输入（含音轨） |
| `COMFYTV_AUDIO` | 输出人声 |

## 界面与参数说明

### workflow
[`workflows/audio-vocal/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio-vocal)（目录预留，内置待发布）。

### video
源视频 `COMFYTV_VIDEO`。可先 **Demux · Audio Track** 再分离，或直接接含音轨视频。

## 输出说明（实现后）

| 输出 | 类型 |
|---|---|
| **audio** | `COMFYTV_AUDIO` |

## 新手一步一步（当前）

1. 知悉 **Demucs 分离尚未可用**。
2. 仅需原音轨：**Demux · Audio Track**（✅）。
3. 自备 workflow 到 `audio-vocal/` 并配置 sidebar 后可试验（高级）。

## 链接

| 资源 | 链接 |
|---|---|
| 路线图 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md |
| 工作流总览 | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/README.zh.md |
| 视频与音频指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md |

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [视频与音频](https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md) | 剪辑、裁剪、缩放、抽帧、Demux、与 Generate 视频的区别 |
| [路线图](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md) | 已支持 vs 计划中的后端（Upscale 视频、Demucs 等） |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题 FAQ

**Q：和 Demux 区别？**  
A：Demux 整轨抽出；Vocals Only **AI 分离** 人声与伴奏。

**Q：workflow 下拉为空？**  
A：正常，内置尚未发布；见 workflows README。

**Q：实现后要什么模型？**  
A：Demucs 人声分离模型文件 + ComfyUI_AudioTools；关注 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) 更新。

## Demucs 实现预览（路线图）

[roadmap.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/roadmap.zh.md) 计划接 `lum3on/ComfyUI_AudioTools` 的 **AudioStemSeparate** 节点。workflow 放入 [`workflows/audio-vocal/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/audio-vocal) 后，sidebar 绑定即可在 UI 出现选项——与 image/video workflow 扩展方式相同（见 [custom-workflows.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md)）。

**Q：workflow 目录何时有文件？**  
A：随 ComfyTV 版本发布或自行按 [custom-workflows.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) 添加 Demucs workflow。

## 相关节点

- **Audio · Background Only**（待支持）
- **Demux · Audio Track**（✅）
- **Video Stage**（IA2V）
