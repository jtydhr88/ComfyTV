# → ComfyTV 多图 (Bridge To Images)

> **入桥**：把 ComfyUI **IMAGE 批量**（B>1）逐帧存 PNG，输出 **COMFYTV_IMAGES** JSON + 当前选中 **COMFYTV_IMAGE**；须 **▶ 运行**。

## 这个节点是做什么的

当上游一次输出 **多张 IMAGE**（IPAdapter 多参考、九宫格、动画帧序列尚未打包成 VIDEO）时，**→ ComfyTV Image** 只保留第 1 张。**→ ComfyTV Images** 把 **每一帧** 写入 `output/ComfyTV/bridge/`，组装成 ComfyTV 批量 JSON（含 index、label、image_url），并附带 **selected_index** 对应的单张 **image** 口。

典型链路：插件 IMAGE batch → **→ ComfyTV Images** → **Image Picker** 挑选 → 单张编辑。

若插件输出的是帧序列但无 VIDEO 对象，也可：IMAGE batch → ComfyUI **Create Video (fps)** → **→ ComfyTV Video**。

## 适用场景

- 多参考 IPAdapter / 多视角 render batch
- ComfyUI 原生 batch 出图进 ComfyTV **Compare**
- 动画预览帧序列进 ComfyTV 挑选

## 工作原理

- **Stage** + **▶ 运行**：`_save_images_to_disk` 逐张 PNG → `ComfyTV/bridge/`。
- JSON 形如 `{"images":[{"index":"1","label":"#1","image_url":"/view?…"}, …]}`。
- **selected_index**（从 1 起）决定 **image** 输出口；与 **Image Picker** 联动。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 原生 | ComfyTV |
|---|---|
| `IMAGE` batch | `COMFYTV_IMAGES` + 选中 `COMFYTV_IMAGE` |

详见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### images
上游 ComfyUI 内存图像，batch 维 >1 或 =1 均可。

### selected_index
**image** 口对应序号，默认 1。

## 输出说明

| 输出 | 类型 |
|---|---|
| **images** | `COMFYTV_IMAGES` |
| **image** | `COMFYTV_IMAGE`（选中项） |

## 新手一步一步

1. 原生节点输出 IMAGE batch。
2. **→ ComfyTV Images**，连线，**▶ 运行**。
3. 接 **Image Picker** 浏览批量；或直接用 **image** 单张口。
4. 改 batch 后重 Run 入桥。

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

**Q：只有一张图能用吗？**  
A：可以，等同 **→ ComfyTV Image** 但多一个 **images** JSON 口。

**Q：VIDEO 和 IMAGES 怎么选？**  
A：有 VIDEO 对象 → **→ ComfyTV Video**；只有 IMAGE 帧 → **Images** 或 **Create Video**。

**Q：Run 后文件在哪？**  
A：每张 `output/ComfyTV/bridge/ComfyTV_bridge_xxxxx_.png`。

**Q：batch 很大 Run 很慢？**  
A：每张 PNG 顺序写入 bridge；极大 batch 可考虑 **Create Video** 再 **→ ComfyTV Video**。

## 相关节点

- **→ ComfyTV Image**（单张）
- **Image Picker**
- **← ComfyTV Image**
