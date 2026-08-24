[English](generate.md) | **简体中文**

# 生成内容

**ComfyTV / Generate** 分组里都是从提示词创建新内容的 stage：Text、Image、Video、Music、Speech、3D Model。

所有生成器的用法一致：输入提示词，在下拉框选一个 **workflow**（模型），点 **▶ Run**。结果显示在节点预览里，并流向下游接线的任何节点。

每个 workflow 下拉框下面都有两个按钮：

- **🔗 Link workflow** —— *使用自定义工作流的推荐方式。*直接从 ComfyUI 自己的工作流库里挑一个链接进来；在 ComfyUI 里编辑保存，ComfyTV 自动读到最新版。见 [custom-workflows.zh.md](custom-workflows.zh.md)。
- **⬆ Upload workflow** —— 从磁盘导入 `.json` 文件，不用重启。

在 stage 管理器里悬停某个工作流可以 **★ 星标设为该 kind 的默认**；stage 卡片上的**预设条**可以保存/调用参数预设。

---

## Image Stage

![Image stage](images/image-run.png)

- **提示词**：主文本框。上游 **Text** 节点内容会追加进来；上游**图片**喂给当前工作流的 `LoadImage`（只有 i2i 工作流会消费）。`@image_N` 记号可以在文中内联引用接进来的图片槽位。
- **workflow** —— 自带：**Local SD1.5**（文生图）、**Local SD1.5 I2I**（图生图）、**Image Ideogram4 T2I**——加上你 Link 或 Upload 进来的任何工作流。
- **resolution / aspect_ratio / batch_size**：目标尺寸档位、画幅、每次 Run 出几张。

**两个输出**：`images` 是本次 Run 的整批；`image` 是你在节点上点选的单张（没点之前默认第一张）。

### 图生图
选 `Local SD1.5 I2I`，把参考图接进 **images** 槽，写提示词，Run。

---

## Video Stage

![Video stage](images/video-run.png)

- **workflow** —— 自带两个家族：
  - **LTX 2.3**（纯视频）：
    - `Local LTX 2.3 T2V` —— 文生视频。
    - `Local LTX 2.3 I2V` —— 图生视频。
    - `Local LTX 2.3 FLF2V` —— 首尾帧生视频。在 **images** 上接**两张**图（起始 + 结束关键帧）。
    - `Local LTX 2.3 IA2V` —— 图 + 音频生视频。
  - **MiniMax H3**（一趟直出**带声音**的视频——环境声、拟音甚至对白）：
    - `Local MiniMax H3 T2V` —— 文生视频+音频。
    - `Local MiniMax H3 FLF2V` —— 首尾帧生视频+音频。
    - `Local MiniMax H3 R2V` —— 多参考：接入多张图（角色设定、场景、道具、风格）和可选的参考音频,在提示词里用 `@image_N` / `<Audio N>` 指名引用,跨镜锁定身份与连续性。H3 工作流内置 **Lightning** LoRA,生成耗时约减半（见 [models.zh.md](models.zh.md)）。
- **resolution / aspect_ratio / duration**：输出尺寸、画幅、时长。
- **audio** 输入 —— IA2V 必需；H3 R2V 作参考音频；其余工作流不用音频。

出片之后，整个[视频套件](video-and-audio.zh.md)——剪辑、调色、抠像、合成、特效——就接手了。

---

## Text Stage

![Text stage](images/text-run.png)

本地 LLM 文本生成（内置 **Qwen3 4B**）。用来扩写提示词、写描述、或喂其他 stage 的上下文槽。

---

## Music Stage

![Music stage](images/audio-run.png)

文生音乐，自带两个工作流：

- **ACE-Step v1 Song** —— 轻量默认。
- **MiniMax Music 3** —— 更高质量的完整歌曲。

共同参数：

- **提示词**：自由 tags——曲风、情绪、BPM、乐器编制。
- **歌词**（可选）：留空 = 纯器乐；非空 = 人声曲目。
- **时长**：滑块（1–240 秒，默认 30）。

输出是一个音频文件。之后[音频套件](video-and-audio.zh.md)（均衡、分轨、混响……）和 [Music 节点](making-music.zh.md)都能接手。

---

## Speech Stage

<!-- TODO(screenshot): Speech Stage 卡片（提示词 + workflow 下拉框） -->
![Speech stage](images/speech-run.png)

文字转语音。自带 **Kokoro TTS** 工作流：输入要念的台词，在工作流参数里选音色，Run。输出是一段音频——可以接进 Video Stage 的 `audio` 输入（IA2V）、Mux Audio 节点或音频套件。

---

## 3D Model Stage

<!-- TODO(screenshot): 3D Model Stage（轨道预览视口） -->
![3D model stage](images/model3d-run.png)

通过 `model` kind 的工作流生成 **3D 模型（GLB）**。自带三个：

- **Hunyuan3D 2.1** —— 图生带贴图网格。
- **MoGe-2 Depth Mesh** —— 单目深度估计图生几何。
- **TripoSplat Gaussian** —— 图生高斯泼溅（也能载入 Scene3D）。

三者所需模型文件见 [models.zh.md](models.zh.md)；也可以 Link 或 Upload 你自己的 `model` kind 工作流。节点内嵌轨道预览；旋转视角后会自动截图进它的图片输出，下游图像 stage 可以直接消费模型的外观。GLB 本体流向 3D 节点——Scene3D、网格操作、材质，详见节点参考。
