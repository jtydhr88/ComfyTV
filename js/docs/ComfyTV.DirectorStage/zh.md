# 导演台

> 一条 clip 时间线渲染整部短片:逐段 prompt、参考、转场、seed,内容寻址缓存让改动过的段落才重渲。

## 这个节点做什么

**导演台**把一个节点变成多镜头制片台。你在横向时间线上铺 **clip** — 每段有自己的 prompt、时长、seed、可选的工作流覆盖、单独的参考媒体和出场转场 — 然后按一次 **▶ Run**。ComfyTV 用选定的视频工作流逐段串行渲染,按你的转场拼接,输出一条完整成片。

核心经济性在**内容寻址缓存**:每段渲染以完整配方(prompt、seed、参考、时长、工作流、共享设置)为键。下次 Run 时没改动的段直接复用缓存,只有你动过的段重新生成。五镜短片里改第 3 镜,只花一镜的钱。

## 什么时候用

- 多镜头短片:每镜各有 prompt,但共享演员表和风格
- 反复打磨单个镜头,不想整片重跑
- 链式生成:每段接着上一段的最后一帧继续

## ComfyTV 的设计

- **单一时间线 widget**:整个剪辑存在一个 `timeline_data` JSON 里,undo、复制粘贴、工作流保存都带着全片走。
- **共享演员表 + 逐段参考**:挂在节点上的资产参考是全片演员表(序数在每段稳定);每段还能叠自己的参考。@ 序数合并编号:共享在前、clip 在后 — `@image_0` 在每段都指同一位演员。
- **@即选择**:不写 mention 时全池发送;写了就只发被 @ 的,按 mention 顺序。
- **衔接三模式**:`off` 各段独立;`prepend` 把上一段最后一帧作为额外前置参考喂给下一段;`replace` 用那一帧替换本段的图片参考 — 追求严格视觉连续时用。
- **Run 自适应**:有改动 → 增量渲染;失败且未改 → 从失败处续跑;成功且未改 → 全片重掷新 seed(新的一条)。
- **单段重拍**:每段有"重新生成"按钮,重掷该段 seed 并只重跑该段。
- **Agent 可驱动**:[MCP 工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/mcp.zh.md) `director_get` / `director_edit` 以编程方式读写同一条时间线。

## 类型(COMFYTV_* vs 原生 ComfyUI)

| ComfyTV 类型 | 是什么 | vs ComfyUI |
|---|---|---|
| `COMFYTV_VIDEO` | 视频 URL 快照 | 经 Bridge 与 `VIDEO` 互转 |

## 参数

### workflow
每段默认的视频工作流(`video` 工作流库里的任意条目)。单段可以覆盖。

### resolution / aspect_ratio
输出档位(如 720P)与画幅(如 16:9),全片共享,保证拼接均匀。

### generate_audio
clip 工作流是否生成音频。打算单独配乐时关掉。

### main_prompt
全片级 prompt,每段可见;段内 prompt 可用 `@image_N` 引用共享演员表。

### 时间线(编辑器)
点加号添加 clip,拖动换位,拖边缘改时长(每段 1–120 秒)。选中一段展开编辑:带完整 @ 体验的 prompt、时长、转场(21 种:cut、fade、dissolve、擦除、滑动、圆形、像素化、缩放……)与转场时长、单段参考、启用开关、重新生成按钮。

## 输出

| 输出 | 类型 | 含义 | 下游 |
|---|---|---|---|
| **video** | `COMFYTV_VIDEO` | 拼接成片 | Mux · Audio、Video Clip、Upscale |

## 一步步来

1. 添加**导演台**,选一个视频 **workflow**(图生视频或参考生视频)。
2. 把演员表作为资产参考挂到节点上 — 每段里就是 `@image_0`、`@image_1`……
3. 铺 clip,逐段写 prompt、定时长、选转场。
4. **▶ Run** — 时间线上看逐段进度。
5. 哪镜不满意?选中它改 prompt 或点重新生成,只重跑那一段。
6. 把 **video** 连进 **Mux · Audio** 配上音乐收尾。

## 完整指南(推荐阅读)

| 指南 | 内容 |
| --- | --- |
| [合成](https://github.com/jtydhr88/ComfyTV/blob/main/docs/compose.zh.md) | 时间线、转场、组装成片 |
| [Agent 接入(MCP)](https://github.com/jtydhr88/ComfyTV/blob/main/docs/mcp.zh.md) | 用 agent 驱动导演台 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南索引** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |

## FAQ

**Q:成功跑完后再按 Run,怎么全片都重渲了?**  
A:零改动再跑 = "再来一条",全部 seed 重掷。想增量就先编辑任意一段。

**Q:共享参考和段内参考的编号会打架吗?**  
A:不会。合并池共享在前,`@image_0` 在每段都是第一个共享参考;段内参考顺延编号。

**Q:seed 输入框去哪了?**  
A:seed 逐段管理,藏在"重新生成"按钮后面 — 点它就是该段的新一条。

## 相关节点

- **Video Stage** — 单镜生成
- **Director Timeline** / **Timeline Video** — 从散段手工组装
- **Mux · Audio** — 给成片配音轨
