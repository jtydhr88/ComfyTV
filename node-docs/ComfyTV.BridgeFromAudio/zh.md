# ← ComfyTV 音频 (Bridge From Audio)

> **出桥**：**COMFYTV_AUDIO** wav URL → 原生 **AUDIO** dict；**无 ▶ 运行**，Queue 时用 torchaudio 加载。

## 这个节点是做什么的

ComfyTV **Demux · Audio Track**、**Audio Stage** 等输出 **`COMFYTV_AUDIO`**。原生音频节点（VHS Load Audio、Stable Audio 后处理等）要 **`AUDIO`** `{waveform, sample_rate}`。**← ComfyTV Audio** 从 `/view?` wav 加载为内存音频。

与 **→ ComfyTV Audio** 配对：ComfyTV 分离/生成的音轨 → 原生生态。

## 适用场景

- ComfyTV Demux 音轨 → 原生音频特效
- **Audio Stage** 音乐 → 原生 VIDEO 合成工具
- IA2V 前在 ComfyTV 里选轨，再送原生分析

## 工作原理

- 非 Stage；`torchaudio.load(path)` → `{waveform: unsqueeze(0), sample_rate}`。
- URL 解析同其它出桥。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV | 原生 |
|---|---|
| `COMFYTV_AUDIO` | `AUDIO` |

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### audio
**COMFYTV_AUDIO** URL。

## 输出说明

| 输出 | 类型 |
|---|---|
| **AUDIO** | ComfyUI AUDIO |

## 新手一步一步

1. Run **Demux** 或 **Audio Stage** 得 **COMFYTV_AUDIO**。
2. **← ComfyTV Audio** 连线。
3. 接原生 AUDIO 节点，Queue。

## 链接

| 资源 | 链接 |
|---|---|
| Bridge 指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md |
| 视频与音频指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/video-and-audio.zh.md |

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [Bridge 接入插件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md) | COMFYTV_* 与原生类型、入桥/出桥、IPAdapter 等示例 |
| [自定义工作流](https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md) | 导入自己的 ComfyUI JSON，不改 Python |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **Bridge 实现源码** | https://github.com/jtydhr88/ComfyTV/blob/main/nodes/bridges.py |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题 FAQ

**Q：Demux 后要桥吗？**  
A：只在 **离开 ComfyTV 进原生** 时需要 ←。留在 ComfyTV 内（如 IA2V）直接连 **Video Stage audio**。

**Q：采样率？**  
A：保留 wav 文件原始 sample_rate。

## 入桥 vs 出桥（复习）

| 场景 | 用哪个桥 |
|---|---|
| Stable Audio 输出 → ComfyTV IA2V | **→ ComfyTV Audio**（Run） |
| ComfyTV Demux 音轨 → 原生 VHS 特效 | **← ComfyTV Audio**（Queue） |
| Demux 音轨 → ComfyTV Video Stage IA2V | **无需桥**，直接 COMFYTV_AUDIO 连线 |

wav 文件位置：`output/ComfyTV/bridge/`（与图像/视频入桥同目录）。

**Q：立体声会保留吗？**  
A：torchaudio 加载 wav 保留声道数；下游原生节点需支持对应 channel layout。

**Q：长 wav 加载慢？**  
A：出桥 Queue 时整文件读入内存；超长音频可先 ComfyTV **Clip** 等价处理（若未来有 audio clip）或原生裁剪。

## 相关节点

- **→ ComfyTV Audio**
- **Demux · Audio Track** / **Audio Stage**
- **Video Stage**（IA2V **audio** 输入）
