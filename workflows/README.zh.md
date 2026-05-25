[English](README.md) | **简体中文**

# Workflows

这个目录是 ComfyTV 对外的扩展入口。**添加新模型 = 把 JSON 文件放进对应子目录。无需修改 Python 代码。** 改完重启 ComfyUI 即可生效。

## 目录结构

```
workflows/
  <kind>/                              ← 每种 stage 一个目录
    <name>.json                        ← GUI 格式的 ComfyUI 工作流导出
    <name>_preset.json                 ← 可选 , 默认配置
```

文件夹名**就是** runner 的 kind ,每个 stage 只扫自己那个文件夹来填下拉框。

| 文件夹 | 对应 Stage | 已测试的内置 | per-kind 文档 |
|---|---|---|---|
| `audio/`       | Audio Stage             | ACE-Step v1 Song | [README](audio/README.zh.md) |
| `image/`       | Image Stage              | Local SD1.5 (文生 + 图生)、Image Ideogram4 T2I | [README](image/README.zh.md) |
| `image-edit/`  | Image Edit              | Flux Canny Edit | [README](image-edit/README.zh.md) |
| `inpaint/`     | Inpaint                 | Flux Fill Inpaint（子图）；Fooocus SDXL Inpaint *（需装插件）* | [README](inpaint/README.zh.md) |
| `outpaint/`    | Outpaint                | Flux Fill Outpaint；Fooocus SDXL Outpaint *（需装插件）* | [README](outpaint/README.zh.md) |
| `upscale/`     | Upscale                 | Ultrasharp 4x (GAN) | [README](upscale/README.zh.md) |
| `cutout/`      | Cutout                  | BiRefNet（子图） | [README](cutout/README.zh.md) |
| `erase/`       | Erase                   | LaMa Erase（Acly inpaint-nodes 插件 + big-lama.pt） | [README](erase/README.zh.md) |
| `relight/`     | Relight                 | Qwen Edit 2509 Relight + (with reference) 变种 | [README](relight/README.zh.md) |
| `multiangle/`  | Multiangle              | Qwen Edit 2511 Multiangle（fal Multiple-Angles LoRA） | [README](multiangle/README.zh.md) |
| `multiview/`   | Image Variations（并行多角度） | Face 3-View、Product 3-View、Character 3-View、Multi-cam 9 | [README](multiview/README.zh.md) |
| `sequence/`    | Image Variations（链式故事帧） | Story 4、Storyboard 25（Next-Scene LoRA） | [README](sequence/README.zh.md) |
| `panorama/`    | Panorama                | Qwen-Image 2512 + 360 LoRA、Qwen-Image-Edit 2511 Image-to-Panorama | [README](panorama/README.zh.md) |
| `text/`        | Text Stage              | Local Qwen3 4B | [README](text/README.zh.md) |
| `video/`       | Video Stage             | LTX 2.3 T2V / I2V / FLF2V / IA2V | [README](video/README.zh.md) |
| `storyboard/`  | Storyboard              | Local Qwen3 Storyboard | [README](storyboard/README.zh.md) |
| `shot-images/` | Shot Images             | Flux Schnell、Local Z-Image Turbo | [README](shot-images/README.zh.md) |
| `audio-vocal/` `audio-bg/` `timeline/` | 各种 | *暂无内置* | — |

## 加载一个新的工作流

1. ComfyUI 网页里，打开你想要的工作流，选 **Workflow → 保存**（GUI 格式 , **不要**用 "Save (API Format)"）。
2. 把导出的 JSON 存为 `workflows/<kind>/<name>.json`。
3. **重启 ComfyUI。** 工作流就会出现在对应 stage 的下拉框里，标签是把文件名人化后的样子。

工作流里如果有 `SaveImage` / `SaveVideo` / `PreviewImage` 节点，ComfyTV 会自动识别，用导出时的 widget 值跑。够用于**测试管线**,要把用户输入（提示词、上游图片、seed）接进去。

## 把用户输入接进去

两种方式把 stage 的输入（提示词、上游图片、seed、模型文件）绑到工作流节点：

1. **导出 `<name>_preset.json`** 同目录 ,DB 第一次 seed 时读一次。适合发布带默认值的工作流。
2. **侧边栏运行时编辑** ,直接写 DB。适合用户自己微调。

详见：
- [`docs/custom-workflows.zh.md`](../docs/custom-workflows.zh.md) , preset 完整 schema（`from:` 数据源、修饰符、子图 ID、剪枝规则）
- [`docs/sidebar-config-editor.zh.md`](../docs/sidebar-config-editor.zh.md) , 侧边栏 UI 详解

参考具体 kind 的 `README.md`，里面有运行时约定（stage 给工作流传什么、工作流通常需要哪些节点）。
