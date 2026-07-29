# 线稿 (Line Art)

> 把 3D 模型渲染成干净的线稿——轮廓、折痕与开放边界，带隐线消除——可直接作为 ControlNet lineart 图使用。

## 这个节点是做什么的

**Line Art** 把 `COMFYTV_MODEL` 渲染成 2D 线条画，而不是着色图。它勾勒网格的特征边——轮廓（surface 转离相机处）、折痕（锐利的二面角边）和边界（开放网格的边缘边）——并可用 BVH 射线测试隐去落在表面背后的线条，于是你得到一张真正的可见线条画，而非透视的线框。

你用卡片上的视图相机取景（或留空让它自动框住模型）。它运行内置的 mesh3d 后端（**▶ 运行**），输出单张 `COMFYTV_IMAGE`——线稿渲染。此节点**没有 model 输出**；它是渲染，不是几何操作。

需要在 `model` 输入接一个模型——为空时阶段会报错。默认输出黑底白线，即 ControlNet lineart 期望的约定。

输出是 ComfyTV 快照，而非原生张量——要接原生 ComfyUI 节点需插入 **Bridge**（[Bridge 文档](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)）。

## 适用场景

- 从 3D 模型生成 ControlNet lineart 图，用精确的形状控制驱动图像 workflow。
- 生成网格的技术/蓝图风格线条画。
- 为漫画或故事板画格获得模型的墨线轮廓。

## 参数

### width / height
输出像素分辨率。两者默认 `1024`，范围 `256`–`4096`（步进 64）。

### thickness
线宽，以输出像素计。默认 `2.0`，范围 `0.5`–`8.0`（步进 0.5）。

### silhouette
绘制轮廓边——surface 转离相机处。默认**开**。

### crease
绘制折痕边——二面角超过 `crease_angle` 的锐利边。默认**开**。

### boundary
绘制边界边——开放网格的边缘边。默认**开**。

### crease_angle
相邻面法线之间超过该角度（°）时，边算作折痕。默认 `60.0`，范围 `1`–`179`。调低以捕捉更柔和的边，调高则只保留非常锐利的边。

### occlusion
用 BVH 射线测试隐去落在表面背后的线条。默认**开**。关闭得到线框式透视画，背面的边会透出来。

### invert
`off`（默认）= 黑底白线，ControlNet lineart 约定。`on` = 白底黑线（纸上墨线观感）。

### camera
内部（隐藏）。由节点体设置的视图相机（位置/目标/fov JSON）。为空 = 自动框住模型。

### model
要渲染的 `COMFYTV_MODEL`。必需——缺它阶段会报错。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **image** | `COMFYTV_IMAGE` | 线稿渲染 |

## 使用技巧

- 用作 ControlNet lineart 时，`invert` 保持关闭（黑底白线）；只有想要可打印的墨线观感时才打开。
- 若画面被内部线条弄乱，保持 `occlusion` 开启并调高 `crease_angle`，让只有真正锐利的边被勾出。
- 边界线只出现在开放网格上；水密实体靠轮廓与折痕边勾出外形。
- 运行前用卡片上的相机设好视角——自动取景未必选中你想要的角度。

## 相关节点

- **Mesh Primitive（网格基元）** / **Mesh Ops（网格操作）** / **Mesh Boolean（网格布尔）** — 构建并清理你要渲染的模型。
- **Bridge** — 把线稿图传给原生 ComfyUI 的 ControlNet 节点。
