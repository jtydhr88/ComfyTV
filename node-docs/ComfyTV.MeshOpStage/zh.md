# 网格操作 (Mesh Ops)

> 一个节点，多种网格操作——decimate、remesh、weld、fill holes、smooth normals、subdivide、UV 展开或 export——从下拉框选择，卡片只显示对应操作的参数。

## 这个节点是做什么的

**Mesh Ops** 接收上游的 `COMFYTV_MODEL`，对它运行一种几何操作，返回一个新模型。选好 `operation`，卡片就只显示该操作的参数，其余隐藏。它运行内置的 mesh3d 后端（**▶ 运行**），所以像 remesh 或 unwrap 这类重操作需要稍等片刻。

你必须把一个模型接到 `model` 输入——为空时阶段会报错。卡片还带有 3D 预览，其快照会成为 `image` 输出。运行 `unwrap` 时，UV 图集预览会替换该快照，方便你检查布局。

八种操作：

- **decimate** — 通过 QEM 边折叠减少面数。
- **remesh** — 在体素网格上重建表面（修复杂乱/非流形输入）。
- **weld** — 在容差内合并重合顶点。
- **fill_holes** — 封闭小的开放边界。
- **smooth_normals** — 用折痕阈值重算着色法线。
- **subdivide** — 把每个三角形分成四个，可选平滑。
- **unwrap** — 生成 UV 图集（产出一张 UV 预览图）。
- **export** — 把网格重新编码为 glb / obj / stl。

输出是 ComfyTV 快照，而非原生张量——要接原生 ComfyUI 节点需插入 **Bridge**（[Bridge 文档](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md)）。

## 适用场景

- 在交付或烘焙前，把密集网格压到面数预算内（**decimate**）。
- 清理有孔洞、重复顶点或非流形边的扫描/布尔/导入几何体（**remesh**、**weld**、**fill_holes**）。
- 通过生成 UV（**unwrap**）为贴图做准备，再用 **Mesh Bake Maps** 烘焙到它上面。
- 增加或平滑细节（**subdivide**、**smooth_normals**），或转换格式（**export**）。

## 参数

哪些参数生效取决于 `operation`。

### operation
要运行的操作：`decimate`、`remesh`、`weld`、`fill_holes`、`smooth_normals`、`subdivide`、`unwrap`、`export`（默认 `decimate`）。卡片只显示选中操作的控件。

### decimate 参数

- **target_face_count** — 通过 QEM 边折叠得到的目标最大面数。默认 `50000`，范围 `100`–`5000000`。
- **placement_mode** — `midpoint`（稳健，保留薄特征）或 `qem`（QEM 最优放置，硬表面更锐利）。默认 `midpoint`。
- **feature_edge_quadric_weight** — 对二面角特征边施加的额外 quadric 权重（qem 模式）。默认 `0.0`（关），最高 `1000.0`。
- **feature_edge_min_dihedral_deg** — 一条边算作特征边的最小二面角（°）。默认 `30.0`，范围 `0`–`180`。

### remesh 参数

- **resolution** — 体素网格分辨率。默认 `256`（≈10 万面；512 ≈ 100 万），范围 `32`–`1024`。
- **sign_mode** — `udf`（对杂乱输入稳健）或 `sdf`（干净的单一表面）。默认 `udf`。
- **project_back** — 把重建后的顶点朝原始表面 lerp 拉回。默认 `0.0`，范围 `0`–`1`。
- **smooth_iters** — Taubin 平滑迭代次数。默认 `0`，最高 `20`。（**subdivide** 也用它。）

### weld 参数

- **epsilon_rel** — 合并容差，以包围盒对角线的比例表示。默认 `1e-5`，最高 `0.01`。

### fill_holes 参数

- **max_perimeter** — 要填补的最大孔洞周长，单位为网格单位。默认 `0.03`，最高 `10.0`。
- **max_verts** — 每个孔洞的边界顶点上限。默认 `16`，范围 `3`–`1024`。

### smooth_normals 参数

- **crease_angle** — 比此更锐利的边保持硬边。默认 `180.0`（完全平滑），范围 `0`–`180`。

### subdivide 参数

- **iterations** — 每次迭代把每个三角形分成四个。默认 `1`，范围 `1`–`4`。
- **smooth_iters** — 细分后的 Taubin 平滑（与 remesh 共用）。默认 `0`。

### unwrap 参数

- **segmenter** — `pec`（快速 GPU 图块分割）或 `adaptive`（CPU）。默认 `pec`。
- **atlas_resolution** — 用于纹素密度自动缩放的目标图集分辨率。默认 `1024`，范围 `256`–`8192`（步进 256）。
- **padding** — 图块之间的纹素填充。默认 `1`，范围 `0`–`16`。

### export 参数

- **format** — `glb`（保留一切）、`obj`（保留 UV/法线/颜色）或 `stl`（裸三角形）。默认 `glb`。

### model
要操作的 `COMFYTV_MODEL`（可选插槽，但运行时必需——缺它阶段会报错）。

### captured_image
内部（隐藏）。成为 `image` 输出的 3D 预览快照 URL。对于 `unwrap`，改用 UV 图集预览。

## 输出

| 输出 | 类型 | 含义 |
|---|---|---|
| **model** | `COMFYTV_MODEL` | 处理后的网格（GLB） |
| **image** | `COMFYTV_IMAGE` | 预览快照，或 `unwrap` 后的 UV 图集 |

## 使用技巧

- 典型低模流程：基元/导入 → **remesh** 或 **weld** 清理 → **decimate** 到预算 → **unwrap** → **Mesh Bake Maps**（把 decimate 前的网格作为 high-poly 喂入）。
- `sdf` 的 `remesh` 需要水密输入；开放或杂乱网格用 `udf`。调高 `resolution` 得到更锐利的结果，再 decimate 到你需要的精确面数。
- **Mesh Boolean** 之后，运行 **decimate** 修掉 SDF 切割产生的多余面。

## 相关节点

- **Mesh Primitive（网格基元）** — 生成干净的基础网格来喂入。
- **Mesh Boolean（网格布尔）** — 在清理操作前后做 CSG 合并。
- **Mesh Bake Maps（网格烘焙贴图）** — 展开并 decimate 后烘焙法线/AO。
- **Line Art（线稿）** — 把处理后的网格渲染成线稿。
