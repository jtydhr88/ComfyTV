# 全景图 · 当前视角 (Panorama · Current View)

> 在 360° 全景查看器里瞄准任意方向，截取当前视口为一张普通平面图（`COMFYTV_IMAGE`）。

## 这个节点是做什么的

**Current View** 接在 **Panorama** 下游，自带一个交互式全景查看器。你在球心里 **拖动瞄准** 想保留的画面，松手或点 **▶ 运行** 时，ComfyTV 把该视口「拍照」成一张 **equirectangular 全景上的透视截图**——输出是普通 flat 图，可直接接 Image Edit、Video Stage 等。

这和 Panorama 主节点的区别：Panorama 管「整张 360° 球」；Current View 管「从球里看出去的一扇窗」。

## 适用场景

- 从 HDRI / 生成全景里挑一个镜头角度出图
- 把 360° 环境变成单帧分镜或 I2V 起始图
- 预览不同 **Aspect / Resolution** 下的截图效果再下游编辑

## 工作原理（为什么 ComfyTV 这样设计）

- **Stage** = 带 **▶ 运行**。Run 只处理本节点的视口截取，不 Queue 整张 ComfyUI 图。
- **快照**：**panorama** 输入来自上游 Panorama 的 Run 快照；改 Panorama 后须先重跑 Panorama，再 Run Current View。
- **浏览器端处理**：视口投影在浏览器里即时完成（不占 GPU），和 Panorama 查看器同一套 3D 逻辑。
- **yaw / pitch / fov / aspect_ratio / resolution** 由节点内 Vue 面板驱动（参数在节点上隐藏），预览框锁定宽高比，所见即所得。

## 类型说明（COMFYTV_* vs ComfyUI 原生）

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| ComfyTV 类型 | 是什么 | 与 ComfyUI 的区别 |
|---|---|---|
| `COMFYTV_PANORAMA` | 上游全景 URL | 输入 |
| `COMFYTV_IMAGE` | 截出的单张图 URL | 不是 ComfyUI 内存图像 |

**如何转换：** 要接 IPAdapter / ControlNet 等原生节点 → **← ComfyTV Image**；插件输出进 ComfyTV → **→ ComfyTV Image**。见 [bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)。

## 界面与参数说明

### panorama（输入）
上游 **Panorama** 的 `COMFYTV_PANORAMA`。可先 Run Panorama 再连，或连已有快照。

### yaw / pitch / fov（隐藏，面板驱动）
- **yaw**（-180…180°）：水平转向，0 = 正前方
- **pitch**（-89…89°）：仰俯角，0 = 地平线
- **fov**（10…120°）：垂直视野，默认 75°

### aspect_ratio
截图宽高比（16:9、1:1 等）。预览框锁定此比例。

### resolution
短边分辨率档位：**1K**=1024、**2K**=2048、**4K**=4096。

## 输出说明

| 输出 | 类型 | 含义 | 下游可接 |
|---|---|---|---|
| **image** | `COMFYTV_IMAGE` | 当前视口截图 | Image Edit、Upscale、Video Stage（I2V）、Image Picker |

## 新手一步一步

1. 画布上已有 **Panorama** 并 Run 出全景（或上传）。
2. 拖 **Panorama · Current View**，把 **panorama** 连上。
3. 在节点内查看器里拖动到满意角度。
4. 选 **Aspect** 和 **Resolution**。
5. 点 **▶ 运行**，在缩略图里确认截图，接下游编辑或生成。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [全景图 360°](https://github.com/jtydhr88/ComfyTV/blob/main/docs/panorama.zh.md) | 上传/生成 equirectangular、Current View、Multi-View |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题 FAQ

**Q：截图和预览不一致？**  
A：Run 前先定好角度；改角度后须再 Run。

**Q：要原生 IMAGE 输出？**  
A：在本节点后加 **← ComfyTV Image**。

**Q：Panorama 改了但截图还是旧的？**  
A：先重跑 Panorama，再 Run Current View——下游读上游快照。

## 相关节点

- **Panorama** —— 360° 全景来源
- **Panorama · Multi-View** —— 一次截多张等间距视角
- **Image Edit** / **Video Stage** —— 常见下游
