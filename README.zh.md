<!-- Language: [English](README.md) | **简体中文** -->

[English](README.md) | **简体中文**

# ComfyTV
ComfyTV，真正属于ComfyUI的画布式应用。

ComfyTV 把 ComfyUI 变成一个**类 TapNow / LibTV 型的画布式应用**。每一步操作是一个独立节点,结果自动传播到下游。用 stage 连成完整流程:生成 → 挑选 → 编辑 → 拼接。

![ComfyTV 画布概览](docs/images/overview.png)

---

## 亮点

- **逐节点 Run**:每个 stage 都自己跑,不进 ComfyUI 全局队列。下游 stage 消费的是上游最近一次输出的**快照**,重跑一个节点不会拖整条链路跟着跑。
- 与现有ComfyUI生态，子图，插件，完美集成
- 自定义工作流导入，使用你自己环境中的工作流
- **真实的本地生成**:文生图、图生图、图像编辑、Inpaint / Outpaint / 放大 / 多视角、文生/图生/音频生视频(、文本、文生音乐、360° 全景生成,全用你自己的本地模型跑。
- **自带一套工作流**:`workflows/<kind>/` 下有一套精选的 ComfyUI 工作流。
- **节点内的富 UI 编辑器**:多视角 3D 相机、带标注工具的蒙版画笔、裁剪/旋转/镜像、HDRI/equirect 全景查看器+视口截图、A/B 对比、九宫格切分。
- **以项目为单位**:stage 归属于项目;输出落 DB,刷新页面/重启后自动恢复。
- **工作流配置**:直接在GUI进行自定义工作流配置 
- 与现有ComfyUI生态，子图，插件，完美集成

---

## 安装

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/jtydhr88/ComfyTV
```

重启 ComfyUI。ComfyTV 的节点会出现在 Add-Node 菜单的 **`ComfyTV`** 分类下,
再细分成几个子分类(Project / Input / Generate / Image / Panorama / Video / Audio / Compose / Bridge)。

---

## 用户指南

详细的分步使用文档在 [`docs/`](docs/):

| 指南 | 覆盖范围 |
|-------|----------------|
| [getting-started.zh.md](docs/getting-started.zh.md) | 安装、画布基础、第一次生成、逐节点 Run、从批量中挑选 |
| [generate.zh.md](docs/generate.zh.md) | 文本/图/视频/音频生成,选模型,跑起来 |
| [image-tools.zh.md](docs/image-tools.zh.md) | 裁剪、旋转、镜像、Inpaint、擦除、抠图、放大、扩图、九宫格切分、变体、多视角 |
| [panorama.zh.md](docs/panorama.zh.md) | 加载/查看 360° 全景图,单视角 + 多视角截图 |
| [video-and-audio.zh.md](docs/video-and-audio.zh.md) | 视频编辑(剪辑/裁剪/缩放/抽帧/音视频分离)和音频(人声/背景分离、解复用) |
| [compose.zh.md](docs/compose.zh.md) | Image Picker、A/B 对比 |
| [roadmap.zh.md](docs/roadmap.zh.md) | 当前能用什么 vs **TODO**(还没接上的后端工作流) |
| [models.zh.md](docs/models.zh.md) | 自带工作流所需的模型文件 + 放置目录 + 下载地址 |
| [custom-workflows.zh.md](docs/custom-workflows.zh.md) | 把你自己的 ComfyUI 工作流以 JSON 形式接进来（不改 Python） |
| [sidebar-config-editor.zh.md](docs/sidebar-config-editor.zh.md) | 用侧边栏 GUI 编辑 stage 输入到工作流节点的绑定 |
| [bridges.zh.md](docs/bridges.zh.md) | 通过 Bridge 节点接入第三方 ComfyUI 插件（mesh2motion、IPAdapter 等） |

---

## 快速上手

1. 拖一个 **Generate → Image** 节点,输入提示词,workflow 选 `Local SD1.5`,点 **Run**。
   它会出来一批图,自动 spawn 一个 **Image Picker**。
2. 在 Picker 里挑一张。它的 `✏️ Edit` 工具栏提供 Inpaint / Crop / Rotate / Mirror /
   Grid Split / Upscale / Outpaint / Cutout。
3. Crop / Rotate / Mirror 都在浏览器里跑,不用 Run。
4. 把挑出的图接到一个 **Generate → Video** 节点(`Local LTX I2V`),Run。
5. 用 **Compose → Compare** 做 A/B 对比。

---

## License

见 [LICENSE](LICENSE)。
