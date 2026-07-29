# 网格基元 (Mesh Primitive)

> 生成一个干净的基础网格——立方体、球体、圆柱、圆锥、平面或圆环——用来开始一次 3D 建模，或喂给几何工坊的其余节点。

## 这个节点是做什么的

**Mesh Primitive** 是 ComfyTV 3D 几何工坊的起点。选一个形状，它就从一份 three.js 几何配方（尺寸、半径、分段数、弧/扫掠角）构建出一个崭新、结构良好的网格。结果是一个 `COMFYTV_MODEL`（GLB），可直接接入 **Mesh Ops**、**Mesh Boolean**、**Mesh Bake Maps** 或 **Line Art**。

卡片上会实时预览你选择的形状。你无需接触原始配方——节点体会为选定的 `kind` 自动填好，预览则写出一张快照作为 `image` 输出。这是一个由后端快速生成的阶段（运行内置的 mesh3d 构建器），并非 GPU 模型推理。

输出是 ComfyTV 快照，而非原生张量——要接原生 ComfyUI 节点需插入 **Bridge**（[Bridge 文档](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)）。

## 适用场景

- 任何 3D 建模从基元开始，而不必从磁盘加载模型。
- 制作一个布尔工具——例如用圆柱打孔、用立方体开槽——接入 **Mesh Boolean**。
- 在拿到最终资产之前，快速做一个基础形状（球、圆环）来测试 **Line Art** 的取景或烘焙。

## 参数

### kind
要构建的基元。取值为 `cube`、`sphere`、`cylinder`、`cone`、`plane`、`torus` 之一（默认 `cube`）。切换 kind 会重塑配方与实时预览。

### recipe
内部（隐藏）。选定 `kind` 的 three.js `geometry.parameters` JSON——width、radiusTop、phiLength、arc 等。由节点体从卡片填入，你无需手动编辑。下游 op 会根据这份配方生成实际网格。

### captured_image
内部（隐藏）。3D 预览快照的 `/view?` URL，由节点体中的预览写入。它会成为 `image` 输出，方便你在下游看到网格。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **model** | `COMFYTV_MODEL` | 生成的基础网格（GLB） |
| **image** | `COMFYTV_IMAGE` | 3D 预览的快照 |

## 使用技巧

- 网格是全新且干净地生成的，因此在 **Mesh Ops** 里焊接和展开都可预测——好习惯是基元 → op，而不是导入杂乱的几何体。
- 配方里更高的分段数会让球/圆柱更平滑，但面数更多；如需精确面数预算，之后在 **Mesh Ops** 里 decimate。

## 相关节点

- **Mesh Ops（网格操作）** — 对基元 decimate、remesh、weld、subdivide、unwrap、smooth 或 export。
- **Mesh Boolean（网格布尔）** — 用 union / difference / intersect 合并两个网格。
- **Line Art（线稿）** — 把网格渲染成线稿图。
