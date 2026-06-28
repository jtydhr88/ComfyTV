# ← ComfyTV 视频 (Bridge From Video)

> **出桥**：**COMFYTV_VIDEO** URL → 原生 **VIDEO** 对象；**无 ▶ 运行**，Queue 时从 mp4 文件加载。

## 这个节点是做什么的

ComfyTV 剪辑链输出 **`COMFYTV_VIDEO`**（`/view?` 指向 `output/ComfyTV/bridge/` 或 comfytv-video 等路径）。原生节点——VHS、Wan Video、Save Video——需要 ComfyUI **`VIDEO`** 对象。**← ComfyTV Video** 用 `VideoFromFile` 包装磁盘 mp4。

反向于 **→ ComfyTV Video**（mesh2motion 进 ComfyTV）。

```
[Video Clip] ──COMFYTV_VIDEO──→ [← ComfyTV Video] ──VIDEO──→ [Save Video / 原生 VHS…]
```

## 适用场景

- ComfyTV 剪辑/Demux 结果 → 原生视频工具链
- ComfyTV 生成 + Clip → 外部插件再处理
- 最终 **Save Video** 导出

## 工作原理

- 非 Stage，无 Run。
- `_url_to_annotated_path` 解析 URL → `folder_paths.get_annotated_filepath`。
- 输出 `InputImpl.VideoFromFile(path)`。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV | 原生 |
|---|---|
| `COMFYTV_VIDEO` | `VIDEO` |

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### video
**COMFYTV_VIDEO** URL。须先 Run 上游 ComfyTV video stage。

## 输出说明

| 输出 | 类型 |
|---|---|
| **VIDEO** | ComfyUI VIDEO |

## 新手一步一步

1. ComfyTV 链产出 **COMFYTV_VIDEO**（Run Clip/Demux 等）。
2. **← ComfyTV Video** 连线。
3. 接 Save Video 或原生 VIDEO 节点。
4. ComfyUI **Queue** 执行。

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

**Q：和 → ComfyTV Video 成对吗？**  
A：是。插件 VIDEO 进 ComfyTV 用 →；ComfyTV 视频出插件用 ←。

**Q：URL 无效？**  
A：先 Run 上游 stage；URL 必须是 `/view?` 格式。

**Q：ComfyTV 剪辑链完整出桥例子？**  
A：`Video Stage → Clip → [← ComfyTV Video] → [VHS Save Video]`，ComfyTV 段用 stage Run，最后 Queue 保存。

**Q：VHS 与 ComfyTV VIDEO 类型？**  
A：VHS 部分节点仍用旧内存数据路径；优先用 ComfyUI 官方 **VIDEO** 类型节点接 **← ComfyTV Video**。

**Q：Clip 后再出桥常见吗？**  
A：是——ComfyTV 内 PyAV 剪辑后再 **← ComfyTV Video** 给原生 Save/特效。

## 相关节点

- **→ ComfyTV Video**
- **Video Clip** / **Demux**
