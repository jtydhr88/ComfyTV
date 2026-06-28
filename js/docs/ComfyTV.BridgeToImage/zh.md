# → ComfyTV 图像 (Bridge To Image)

> **入桥**：把 ComfyUI 原生 **IMAGE** 内存图像（任意插件输出）转成 ComfyTV 的 **COMFYTV_IMAGE** URL 快照；须点 **▶ 运行** 写入 `output/ComfyTV/bridge/` 并持久化到项目。

## 这个节点是做什么的

ComfyTV stage 之间传递的是 **URL 快照**（`/view?filename=…` 字符串），不是 ComfyUI 内存里的图像/音频数据。任何输出 **`IMAGE`** 的 ComfyUI 节点——**IPAdapter**、ControlNet 预处理、**mesh2motion** 渲染帧、自定义 Python 节点——都不能 **直接** 接到 **Image Picker** 或 **Upscale** 这类 ComfyTV stage。

**→ ComfyTV Image** 就是「入境检查站」：Run 时读取上游内存图像，**保存 PNG** 到磁盘，生成 ComfyTV 能读懂的快照 URL。

```
[IPAdapter 等] ──ComfyUI 内存图像──→ [→ ComfyTV Image] ──COMFYTV_IMAGE URL──→ [Image Picker / Upscale / …]
                                      ▲ Run + 快照
```

## 适用场景

- mesh2motion / 3D 插件输出帧 → ComfyTV 编辑流水线
- IPAdapter 风格图 → ComfyTV **Video Stage** I2V
- ControlNet 预处理结果 → ComfyTV **Inpaint**
- 任意第三方 IMAGE → ComfyTV 资产与 lineage 体系

## 工作原理（为什么 ComfyTV 这样设计）

- ComfyTV **Stage** 各自 **▶ 运行**，不 Queue 整图；快照让下游只读 URL，不必重跑昂贵上游。
- **入桥本身也是 Stage**：有 Run 按钮。Run = 执行上游链路（若尚未执行）+ **写 PNG + 注册快照**。
- 文件路径：`ComfyUI/output/ComfyTV/bridge/ComfyTV_bridge_xxxxx_.png`（见 [`bridges.py`](https://github.com/jtydhr88/ComfyTV/blob/main/nodes/bridges.py) `_save_images_to_disk`）。
- 下游 ComfyTV stage 再 Run 时 **直接用桥的快照**，不会自动重跑 IPAdapter，「除非」你再次 Run 入桥。

## 类型说明（ComfyTV 与 ComfyUI 原生类型）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 侧 | ComfyUI 原生 | ComfyTV |
|---|---|---|
| 图像 | `IMAGE` — PyTorch 内存张量 批量 `[B,H,W,C]` | `COMFYTV_IMAGE` — **单图** `/view?` URL 字符串 |
| 多图 | `IMAGE` batch（B>1） | `COMFYTV_IMAGES` — JSON 批量；单张用 **→ ComfyTV Images** |
| 视频 | `VIDEO` 对象 | `COMFYTV_VIDEO` — mp4 URL |
| 音频 | `AUDIO` dict `{waveform, sample_rate}` | `COMFYTV_AUDIO` — wav URL |
| 文本 | `STRING` | `COMFYTV_TEXT` — 纯文本快照 |

**连线规则：** 原生口 **不能** 直连 ComfyTV 口。必须经 **→** 入桥或 **←** 出桥。完整指南：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### image（输入）
上游 **IMAGE** 内存图像。只取 **batch 第 1 张**（`image[:1]`）。多帧请用 **→ ComfyTV Images** 或先 **Create Video**。

### 强制重跑标记 / 项目 id（project_id） / 父输出来源 id（隐藏）
ComfyTV 内部 lineage；一般无需手改。

## 输出说明

| 输出 | 类型 | 含义 |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | 持久化 PNG 的 `/view?` URL |

## 新手一步一步

1. 画布左侧跑通原生插件（如 IPAdapter）到 IMAGE 输出。
2. 拖 **→ ComfyTV Image**，把 **image** 连上。
3. 点入桥上 **▶ 运行**（关键！不 Run 则无快照）。
4. 把 **image** 输出接到 **Image Picker** 或 **Upscale**。
5. 改上游后 **重新 Run 入桥** 更新快照。

## 链接

| 资源 | 链接 |
|---|---|
| Bridge 总指南 | https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md |
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

**Q：连上了但 ComfyTV 下游空的？**  
A：入桥 **必须 Run**。出桥（←）无 Run，入桥（→）有 Run。

**Q：IPAdapter 批量多张？**  
A：用 **→ ComfyTV Images**；或只桥接第一张。

**Q：mesh2motion 出 VIDEO 不是 IMAGE？**  
A：用 **→ ComfyTV Video**；若只有 IMAGE 序列，先 **Create Video (fps)**。

**Q：文件在哪？**  
A：`output/ComfyTV/bridge/*.png`。

## 相关节点

- **→ ComfyTV Images** / **Video** / **Text** / **Audio**
- **← ComfyTV Image** —— 反向出 ComfyTV
- **Image Picker** —— 常见下游
