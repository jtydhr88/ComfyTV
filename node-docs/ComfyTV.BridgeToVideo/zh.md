# → ComfyTV 视频 (Bridge To Video)

> **入桥**：ComfyUI **VIDEO** 对象（如 **mesh2motion**）→ **COMFYTV_VIDEO** URL；**▶ 运行** 写入 `output/ComfyTV/bridge/*.mp4`。

## 这个节点是做什么的

**mesh2motion**、AnimateDiff 导出、ComfyUI 原生 **Create Video** 等输出 **`VIDEO`** 类型——ComfyTV 的 **Video Clip**、**Demux**、**Video Stage** 只认 **`COMFYTV_VIDEO`** 字符串 URL。**→ ComfyTV Video** 在 Run 时把 VIDEO 对象 **save_to** mp4（codec 自动），注册 `/view?` 快照。

```
[mesh2motion] ──VIDEO──→ [→ ComfyTV Video] ──COMFYTV_VIDEO──→ [Video Clip / Demux / …]
                              ▲ Run
```

插件若只有 **IMAGE 帧序列**、没有 VIDEO：先 **Create Video (fps)** 再本入桥。

## 适用场景

- 3D / motion 插件视频进 ComfyTV 剪辑链
- AnimateDiff 结果进 ComfyTV **↪ Extend**
- 原生 VIDEO 进 ComfyTV IA2V 再编辑

## 工作原理

- **Stage** + **▶ 运行**；`_save_video_to_disk`，前缀 `ComfyTV/bridge`。
- 容器/codec：`VideoContainer("auto")` / `VideoCodec("auto")`。
- 快照持久化；下游 Run 不重编码，「除非」你重 Run 入桥。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 原生 `VIDEO` | ComfyTV `COMFYTV_VIDEO` |
|---|---|
| ComfyUI 视频对象，内存/临时文件 | 持久 mp4 `/view?` URL |

[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### video
上游 **VIDEO**。未连接 Run 报错。

## 输出说明

| 输出 | 类型 | 下游 |
|---|---|---|
| **video** | `COMFYTV_VIDEO` | Clip、Crop、Demux、Extract Frame |

## 新手一步一步

1. 跑通 mesh2motion（或 Create Video）到 VIDEO。
2. 拖 **→ ComfyTV Video**，连线。
3. **▶ 运行** 入桥。
4. 接 **Video Clip** 或工具栏 **Demux** 链。

## 链接

| 资源 | 链接 |
|---|---|
| Bridge 指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md |
| ComfyTV 仓库 | https://github.com/jtydhr88/ComfyTV |

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

**Q：Queue 和 Run 混淆？**  
A：**Run** = ComfyTV stage / 入桥写入快照（本节点必须 Run）；**Queue** = 跑整条 ComfyUI 图。入桥不能用 Queue 代替 Run。

**Q：mesh2motion 输出 IMAGE 不是 VIDEO？**  
A：`Create Video` 设 fps → **→ ComfyTV Video**。

**Q：能跳过 Run 吗？**  
A：不能。无 Run 则无 COMFYTV 快照。

**Q：mp4 路径？**  
A：`output/ComfyTV/bridge/ComfyTV_bridge_xxxxx_.mp4`。

**Q：mesh2motion 完整例子？**  
A：`[mesh2motion] VIDEO → [→ ComfyTV Video] Run → [Video Clip] → [Demux]`；若只有 IMAGE 序列则 `Create Video → → ComfyTV Video`。

**Q：bridge mp4 会堆积吗？**  
A：每次 Run 入桥生成新文件名；旧文件仍在 `output/ComfyTV/bridge/`，可自行清理磁盘。

## 相关节点

- **→ ComfyTV Image(s)** —— 帧序列替代路径
- **Video Clip** / **Demux**
- **← ComfyTV Video** —— 出 ComfyTV 回原生
