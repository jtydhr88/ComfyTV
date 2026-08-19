[English](README.md) | **简体中文**

# `model/` 工作流

本目录中的工作流会出现在 **3D Model Stage** 的下拉框里。输入一张上游图片（可选文本 / 模型输入），产出一个 3D 资产。Stage 的预览视口能渲染工作流保存的任何格式——网格（`.glb`、`.gltf`、`.obj` 等）、高斯泼溅（`.spz`、`.splat`、`.ksplat`、splat 型 `.ply`）和点云（`.ply`）都支持，所以 mesh、splat、点云工作流共用这一个目录。

## Stage 输入

- **提示词** — 可选；内置的三个图生 3D 工作流都不消费它，但文生 3D 类工作流可以绑定。
- **上游图片** — 内置工作流都把 `images.image0` 提升为 3D。
- **上游文本 / 模型**（可选）— 供需要参考输入的工作流使用。
- **自定义参数** — 每个 preset 暴露的质量旋钮（见下）；未暴露的参数一律保持官方模板默认值。

## 你的工作流需要什么

- 末端一个 `SaveGLB`（或任何输出 `ui["3d"]` 结果的保存节点）——splat 管线经 `SplatToFile3D` 到达。
- 一个 `LoadImage` 承接上游图片。

自定义工作流见 [docs/custom-workflows.md](../../docs/custom-workflows.md)；逐节点绑定配置：在画布选中 stage 后打开左侧 **ComfyTV** 侧边栏，见 [docs/sidebar-config-editor.md](../../docs/sidebar-config-editor.md)。

## 当前内置

三个都改编自 ComfyUI 官方内置模板，做了拍平处理（去掉子图 / 预览分支），官方参数默认值全部保留。生成式工作流的公共自定义参数：`seed`（未设置时每次 Run 随机）。

- **Hunyuan3D 2.1**（`hunyuan3d-21.json` + `_preset.json`）— 图 → 无贴图**网格** GLB。官方 `3d_hunyuan3d-v2.1` 模板默认值：30 步、cfg 5、euler/normal、latent 分辨率 4096、解码 num_chunks 8000 / octree_resolution 256、surface-net 阈值 0.6。自定义参数：`seed`、`steps`、`guidance`。模型：`checkpoints/hunyuan_3d_v2.1.safetensors`。
- **TripoSplat Gaussian**（`triposplat-gaussian.json` + `_preset.json`）— 图 → **3D 高斯泼溅**（`.spz`）。预处理前固定走 BiRefNet 自动去背景（erode 1、size 1024——模型的训练分辨率）。采样默认：20 步、cfg 3、dpmpp_2m/simple；解码产出 262144 个高斯（八叉树密度——调高只是过采样，不会有新细节）。自定义参数：`seed`、`steps`、`guidance`、`num_gaussians`。模型：`diffusion_models/triposplat_fp16.safetensors`、`clip_vision/dino_v3_vit_h.safetensors`、`vae/triposplat_vae_decoder_fp16.safetensors`、`vae/flux2-vae.safetensors`、`background_removal/birefnet.safetensors`。
- **MoGe-2 Depth Mesh**（`moge2-mesh.json` + `_preset.json`）— 图 → 可见表面的带贴图**点图网格** GLB（单目几何估计的场景浮雕，不是封闭物体）。确定性算法，无 seed。默认值：resolution_level 9、fov 自动恢复、decimation 1、断裂阈值 0.04、贴图开。自定义参数：`resolution_level`（0 最快 … 9 最细）。模型：`geometry_estimation/moge_2_vitl_normal_fp16.safetensors`。

## 引用的模型

下载地址内嵌在各工作流节点的 `properties.models` 里；另见 [docs/models.md](../../docs/models.md)。
