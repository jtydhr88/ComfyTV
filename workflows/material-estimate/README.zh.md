# material-estimate 工作流

**材质球（Material）** stage 的 VLM 估计工作流：输入一张图（通常是部件分割抠出的
部件图），输出 PBR 参数的 JSON 文本。stage 会从生成文本中提取第一个 `{...}`
JSON 块，合并进材质编辑器，用户在此基础上手调。

给这个 stage 挂自定义工作流的约定：
- 输入：一张图，绑定 `upstream_image:annotated[0]`；
- 输出：包含 JSON 对象的文本，键可为
  `color, metalness, roughness, transmission, opacity, clearcoat,
  clearcoatRoughness, ior, emissive, emissiveIntensity`
  （result 类型 `graph_output_first`，指向产出文本的节点）。

默认 `qwen3vl-estimate` 纯核心节点：`CLIPLoader(qwen3vl_8b) → TextGenerate →
PreviewAny`。模型 `qwen3vl_8b_fp8_scaled.safetensors`（Comfy-Org），放
`models/clip/` 或 `models/text_encoders/`。

gemma4_e4b 评估过但被否了：默认模板和 LTX2 式 `<image_soft_token>` 模板下，
对明显不同的 patch 都返回一模一样的灰色估计——图片根本没影响输出。
