# 网格布尔 (Mesh Boolean)

> 用 CSG 合并两个网格——union 合并、difference 从一个里挖出另一个、intersect 只保留重叠——通过卡片上的 gizmo 摆放。

## 这个节点是做什么的

**Mesh Boolean** 接收两个 `COMFYTV_MODEL` 输入（`model` = A，`model_b` = B），在有符号距离体素网格上合并它们，返回一个新模型。选好 `operation`，用节点体里的 gizmo 摆放 B（和 A）；变换被内部存储，并在切割前应用。

因为它在 SDF 网格上工作，结果是水密的，但面数取决于 `resolution`——网格越高，切割越锐利、面越多。它运行内置的 mesh3d 后端（**▶ 运行**）。两个输入都必需：`model` 或 `model_b` 为空时阶段会报错。卡片的 3D 预览快照成为 `image` 输出。

输出是 ComfyTV 快照，而非原生张量——要接原生 ComfyUI 节点需插入 **Bridge**（[Bridge 文档](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)）。

## 适用场景

- 打孔或开槽——用 `difference` 从主体（A）里减去一个圆柱或立方体（B）。
- 用 `union` 把两个重叠的形状焊成一个实体。
- 用 `intersect` 只保留两个形状的共有体积（例如把形状雕成模具）。

## 参数

### operation
CSG 操作：`union`（合并两者）、`difference`（从 A 中移除 B 的体积）、`intersect`（只保留重叠）。默认 `union`。

### resolution
SDF 体素网格分辨率。默认 `256`，范围 `32`–`1024`。越高 = 切割越锐利、面越多；如需精确面数，在 **Mesh Ops** 里跟一个 **decimate**。

### smooth_iters
对结果施加的 Taubin 平滑迭代次数。默认 `0`，范围 `0`–`20`。几次迭代能软化低 `resolution` 在切口沿线留下的阶梯感。

### model (A) / model_b (B)
两个 `COMFYTV_MODEL` 输入。`model` 是 A，`model_b` 是 B。对 `difference` 而言，B 的体积从 A 中被移除。运行时两者都必需。

### transform_a / transform_b
内部（隐藏）。每个模型的位置/旋转/缩放（TRS），由节点体里的 gizmo 设置。你用可视化方式摆放网格，无需手动编辑这份 JSON。

### captured_image
内部（隐藏）。成为 `image` 输出的 3D 预览快照 URL。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **model** | `COMFYTV_MODEL` | 合并后的网格（GLB） |
| **image** | `COMFYTV_IMAGE` | 3D 预览的快照 |

## 使用技巧

- `difference` 的顺序很重要：A 是主体，B 是从中移除的工具。若切割方向反了，交换连线。
- 输出可能带有比你想要的更多的面；串一个 **Mesh Ops** 的 decimate 把它压到预算内。
- 若细切口看起来锯齿，优先调高 `resolution` 或加几次 `smooth_iters`，而不要一次两者都上。

## 相关节点

- **Mesh Primitive（网格基元）** — 制作切割工具（圆柱打孔、立方体开槽）。
- **Mesh Ops（网格操作）** — 对布尔结果 decimate / remesh / weld。
- **Mesh Bake Maps（网格烘焙贴图）** — 清理并展开后烘焙细节。
