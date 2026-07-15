# split-part 工作流

**部件分割（Split Parts）** stage 的分割工作流：输入一张上游图片 + 部件提示，
输出**每个部件一张透明背景 PNG**（`COMFYTV_IMAGES`，走 `ui_save_batch`）。

模型：`sam3.1_multiplex_fp16.safetensors` →
`https://huggingface.co/Comfy-Org/sam3.1` → 放到 `ComfyUI/models/checkpoints/`。
SAM3 节点是 ComfyUI 核心自带（`comfy_extras/nodes_sam3.py`），不依赖任何插件。

| 工作流 | 提示方式 | 说明 |
|---|---|---|
| `sam3-prompt` | 卡片上点选 + 框选 | stage 每个点组跑一次、所有框合并跑一次 |
| `sam3-text` | stage 主提示词（开放词汇） | 概念的每个实例各出一张图 |

给这个 stage 挂自定义工作流的约定：
- stage 会提供 `option:points_pos` / `option:points_neg`（JSON 字符串
  `[{"x":int,"y":int},…]`，原图像素坐标）和 `option:bboxes`
  （`{x,y,width,height}` 字典列表），按需绑定；
- 输出必须以 SaveImage 结尾，保存整批部件图（每部件一张）；
- `JoinImageWithAlpha` 内部是 `alpha = 1 - mask`，用 SAM mask 合成透明图时
  前面要接一个 `InvertMask`。
