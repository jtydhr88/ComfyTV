<!-- Language: [English](README.md) | **简体中文** -->

[English](README.md) | **简体中文**

# ComfyTV
ComfyTV，真正属于 ComfyUI 的画布式应用。

ComfyTV 把 ComfyUI 变成一个**类 TapNow / LibTV 型的画布式应用**——并且一路做深，做成完整的媒体工作台。每一步操作是一个独立节点，结果自动传播到下游。用 stage 连成完整流程：**生成 → 挑选 → 编辑 → 合成 → 导出**，覆盖图像、视频、音频、音乐、全景、2D 图层和 3D。

目前共有 **约 190 个 stage**，每个都有独立的参考文档页。

📖 **文档站：[comfytv.org](https://comfytv.org)** —— 中英双语指南 + 每个节点的独立参考页。

![ComfyTV 画布概览](docs/images/overview.png)

---

## 核心理念

- **逐节点 Run**：每个 stage 都自己跑，不进 ComfyUI 全局队列。下游 stage 消费的是上游最近一次输出的**快照**，重跑一个节点不会拖整条链路跟着跑。
- **以项目为单位**：stage 归属于项目；每次输出都带完整历史保存，刷新页面/重启后自动恢复。
- **你的模型、你的工作流**：`workflows/<kind>/` 下自带一套精选工作流，全部跑在你自己的本地模型上。任何 ComfyUI 工作流都能以 JSON 导入，在侧边栏 GUI 里绑定输入，按 stage 保存预设、星标默认工作流。
- **融入 ComfyUI 生态**：子图、第三方插件开箱即用；**Bridge 节点**能把任意插件接进 ComfyTV 流水线；远程 ComfyUI 机器可注册为额外的 Runner（Servers 页签），带能力预检。
- **内置多库**：项目级**资产库**（图/视频/音频/3D 模型）、**资源库**（LUT、字体、SoundFont）和可复用的**提示词片段**——都住在[七页签侧边栏](docs/sidebar.zh.md)里，且都能在任意提示词里用 `@` 引用。
- **节点内富编辑器**：很多 stage 在节点里内嵌真正的编辑器——图层编辑器、故事板工作台、钢琴卷帘、3D 视口、示波器等；多数视频特效带实时预览。

## 内容一览

### 图像
生成（文生图、图生图、编辑、Inpaint、Outpaint、擦除、放大、重打光、变体、多视角 3D 相机），浏览器端即时工具（裁剪/旋转/镜像/宫格切分），SAM 部件分割 + 蒙版清理，线稿提取，审片宫格。

### 2D 图层编辑器与故事板
节点里的完整图层编辑器：raster、文字（真字体解析）、矢量形状、参数化填充（纯色/渐变）和调整图层；逐图层蒙版；选区支持魔棒、布尔运算和形态学操作；非破坏变换；撤销；**PSD 导入导出**。故事板工作台按板复用同一引擎，外加洋葱皮、时间线播放、动画稿/GIF/PDF/ZIP 导出、Fountain 剧本导入。

编辑器引擎是独立项目 **[Pentrado](https://github.com/jtydhr88/pentrado)**——浏览器里直接试用：**[pentrado.com](https://pentrado.com)**。

### 视频（约 100 个节点）
- **剪辑**：剪辑、分割、拼接、裁剪、缩放、变速/倒放、旋转、镜头检测、抽帧、代理生成 + 透明代理播放。
- **调色**：色轮/曲线/LUT/ASC CDL/HueCorrect/可选颜色/直方图均衡/灰度世界。
- **抠像**：色度键之外还有整套 keyer 套件——PIK、Keyer、Despill、Color Suppress、KeyMix、matte 监视/形态学、Select0r。
- **Roto 与跟踪**：带羽化的贝塞尔 roto 蒙版、点运动跟踪、光流蒙版传播、Corner Pin、含克隆笔刷的绘画描边。
- **合成**：39 种混合模式、关键帧变换、57 种 xfade 转场 + luma wipe、时间重映射、序列拼装。
- **特效**：辉光、体积光、粒子系统、镜头畸变（多套镜头模型）、色差、镜头光晕、Z 景深、老电影、Regrain、故障艺术、万花筒、波浪扭曲、水波、光涂鸦、Slit Scan、反馈、频闪、风格化等。
- **360**：360° 素材投影 + 稳定、Card3D、STMap UV 重映射 + STMap 生成器。
- **基建**：参数表达式、**FX Chain**（串起多个特效一趟渲染完）、示波器（波形/矢量示波/直方图）、标题/字幕/标注、语音转文字生成字幕。

### 音频（30+ 个节点）
动态处理（压缩/门限/限制器/去齿音）、带图形界面的参数均衡、响度标准化、降噪/修复、回声、调制、立体声工具、变速/移调、饱和；**卷积混响**——还能采录你自己房间的声音——外加一个算法混响；**分轨**成 人声/伴奏/鼓/贝斯/其他（内置能力，无需额外安装）、噪声抑制、节拍与音符提取；混音、交叉淡化、侧链闪避、分段导出、分析与可视化；音频响应参数自动化 + 视频电平表叠加。

### 音乐（符号音乐）
Score 节点支持 MusicXML 与刻谱渲染，钢琴卷帘式的**打谱器和 MIDI 编辑器**，多套风格 profile 的演奏渲染，SoundFont（SF2/SF3）合成器，节拍器，和弦伴奏——作曲 → 演奏 → 合成 → 混音在一张画布上完成。

### 全景
360° 查看器 + 单/多视口截图；文生全景与图生全景工作流。

### 3D
Scene3D DCC 式工作台（多相机、相机路径关键帧、多通道视口捕获），3D 模型生成与加载，几何工坊（网格操作、布尔、基元、贴图烘焙），PBR 材质节点 + 按部件绑材质，3D 转线稿渲染。

### 编排与流转
自动生成的挑选器（图/音频/视频）、A/B 对比、轨道式 Sequence 拼装；完整的导演时间线和「故事板 → 分镜出图」流水线在 [roadmap](docs/roadmap.zh.md) 上。

---

## 安装

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/jtydhr88/ComfyTV
```

重启 ComfyUI。ComfyTV 的节点会出现在 Add-Node 菜单的 **`ComfyTV`** 分类下，再细分成若干子分类（Project / Input / Generate / Image / Panorama / Video / VideoFX / Keying / Compose / Timeline / Audio / AudioFX / Music / 3D / Material / Storyboard / Bridge）。

### ComfyUI Desktop / macOS / 多个 ComfyUI 实例

如果你用的是 ComfyUI Desktop、在 macOS 上、或机器上装了不止一个 ComfyUI，上面那句相对路径的 `cd ComfyUI/custom_nodes` 很容易进错实例（典型症状：clone 成功了但 ComfyTV 死活不出现）。改成用**绝对路径**装进正在运行的那个实例：

1. **确认正在运行的实例。** 看 ComfyUI 的启动日志，里面会打印它加载的根目录，例如 `/Users/你/Downloads/ComfyUI (1)/ComfyUI`，这个才是要安装的目标实例。
2. **直接 clone 进该实例的 `custom_nodes`，并给路径加引号**（路径里有空格或括号时引号是必需的）。**写成一行**，避免行末多余的续行反斜杠 `\` 把命令拆散：
   ```bash
   git clone https://github.com/jtydhr88/ComfyTV.git "/Users/你/Downloads/ComfyUI (1)/ComfyUI/custom_nodes/ComfyTV"
   ```
   如果一定要换行，`\` 必须是这一行的最后一个字符、后面不能再有任何内容——比如把 `\` 误放在 `cd` 那行末尾，会把下一条命令悄悄接上去，导致 `git clone` 根本没独立执行。
3. **检查目录结构。** `custom_nodes/ComfyTV/` 的第一层必须能看到 `__init__.py`；如果看到的是嵌套的 `ComfyTV/ComfyTV/…`，把里层那个文件夹往上提一层。
4. **完整重启 ComfyUI 后端**（退出并重新打开 Desktop 应用，或停掉再重启服务——不是刷新浏览器）。成功时启动日志里会看到 ComfyTV 加载并注册节点。

---

## 用户指南

完整文档在 **[comfytv.org](https://comfytv.org)**——指南 + 每个节点的参考页，中英双语。指南源文件也可以直接在 [`docs/`](docs/) 浏览：

| 指南 | 覆盖范围 |
|-------|----------------|
| [getting-started.zh.md](docs/getting-started.zh.md) | 安装、画布基础、第一次生成、逐节点 Run、从批量中挑选 |
| [sidebar.zh.md](docs/sidebar.zh.md) | 七页签侧边栏：工作流配置、资产库、提示词片段、Stage 管理、预设、资源、服务器——外加提示词里的 `@` 引用 |
| [generate.zh.md](docs/generate.zh.md) | 文本/图/视频/音频生成，选模型，跑起来 |
| [image-tools.zh.md](docs/image-tools.zh.md) | 裁剪、旋转、镜像、Inpaint、擦除、抠图、放大、扩图、宫格切分、变体、多视角、重打光 |
| [panorama.zh.md](docs/panorama.zh.md) | 加载/查看 360° 全景图，单视角 + 多视角截图 |
| [video-and-audio.zh.md](docs/video-and-audio.zh.md) | 视频与音频全家桶：剪辑、调色、抠像、合成、特效、音频处理 |
| [making-music.zh.md](docs/making-music.zh.md) | 一张画布上的作曲→演奏→合成→混音：MusicXML 格式、每个 Music 节点的全部参数、混响起手参数 |
| [compose.zh.md](docs/compose.zh.md) | 挑选器、A/B 对比，以及更大的编排工具 |
| [roadmap.zh.md](docs/roadmap.zh.md) | 当前能用什么 vs **TODO**（还没接上的后端工作流） |
| [models.zh.md](docs/models.zh.md) | 自带工作流所需的模型文件 + 放置目录 + 下载地址 |
| [custom-workflows.zh.md](docs/custom-workflows.zh.md) | 把你自己的 ComfyUI 工作流以 JSON 形式接进来（不改 Python） |
| [sidebar-config-editor.zh.md](docs/sidebar-config-editor.zh.md) | 用侧边栏 GUI 编辑 stage 输入到工作流节点的绑定 |
| [bridges.zh.md](docs/bridges.zh.md) | 通过 Bridge 节点接入第三方 ComfyUI 插件（mesh2motion、IPAdapter 等） |

---

## 快速上手

1. 拖一个 **Generate → Image** 节点，输入提示词，workflow 选 `Local SD1.5`，点 **Run**。它会出来一批图，自动 spawn 一个 **Image Picker**。
2. 在 Picker 里挑一张。它的 `✏️ Edit` 工具栏提供 Inpaint / Crop / Rotate / Mirror / Grid Split / Upscale / Outpaint / Cutout。
3. Crop / Rotate / Mirror 都在浏览器里跑，不用 Run。
4. 把挑出的图接到一个 **Generate → Video** 节点（`Local LTX I2V`），Run。
5. 串几个 **VideoFX** 节点（调色、辉光、颗粒……）进一个 **FX Chain**，一趟渲染完——多数特效在节点里就有实时预览。
6. 用 **Compose → Compare** 做 A/B 对比。

---

## License

见 [LICENSE](LICENSE)。
