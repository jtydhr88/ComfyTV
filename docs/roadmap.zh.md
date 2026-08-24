[English](roadmap.md) | **简体中文**

# 当前能用什么 , 以及 TODO 清单

ComfyTV 还是 pre-release 状态。

图例:✅ 完成 · ⏳ 待支持。

---

## ✅ 完成

| 能力 | 备注 |
|---------|-------|
| **Image · Local SD1.5**(文生图) | 真生成;输出是批量。 |
| **Image · Local SD1.5 I2I**(图生图) | 需要连一张参考图。 |
| **Image · Image Ideogram4 T2I** | Ideogram 4 + Qwen3-VL 文本编码器文生图。 |
| **Image Edit · Flux Canny Edit** | 提示词驱动的图像编辑。 |
| **Inpaint · Flux Fill Inpaint** + **Fooocus SDXL Inpaint** | 蒙版驱动的重绘(蒙版画笔产出 mask)。 |
| **Erase · LaMa Erase** | 无提示词抹除目标。需要装 `Acly/comfyui-inpaint-nodes` + `big-lama.pt`。 |
| **Relight · Flux2 Klein Relight** | 纯前端 3D 灯光球节点在浏览器里渲染光照参考;Image Stage 工作流(Flux-2 Klein 9B + Sun-direction LoRA)把光照迁移到主体上。 |
| **Cutout · BiRefNet Cutout** | 用 ComfyUI 内置 BiRefNet 抠图,输出带 alpha 的 PNG。 |
| **Image Variations · Face 3-View / Product 3-View / Character 3-View / Multi-cam 9** | 单工作流多路并行 KSampler,共享模型 + base latent。Qwen-Image-Edit 2511 + Multiple-Angles LoRA + Lightning 4-step。 |
| **Image Variations · Story 4 / Storyboard 25** | 单工作流 N 帧串行 , 第 N+1 帧用第 N 帧作输入。Qwen-Image-Edit 2509 + Next-Scene LoRA + Lightning 4-step。 |
| **Outpaint · Flux Fill Outpaint** + **Fooocus SDXL Outpaint** | 画布外扩。 |
| **Upscale · Ultrasharp 4x** | 基于 4x-UltraSharp GAN 的放大。 |
| **Multiangle · Qwen Edit 2511 Multiangle** | Qwen Image-Edit + Multiangle LoRA,由 3D 相机驱动。 |
| **Video · Local LTX 2.3**(T2V + I2V + FLF2V + IA2V) | 快;推荐默认。T2V 纯文本;I2V 要一张图;FLF2V 在两张关键帧之间插值;IA2V 跟随音轨节拍(对口型/MV/音效对齐镜头)。 |
| **Video · Local MiniMax H3**(T2V + FLF2V + R2V) | 一趟直出**带声音**的视频。R2V 吃多张图/音频参考,跨镜锁身份。内置 Lightning LoRA(渲染耗时约减半)。 |
| **Audio · MiniMax Music 3** | ACE-Step 之外更高质量的文生音乐。 |
| **3D Model · Hunyuan3D 2.1 / MoGe-2 / TripoSplat** | 图生带贴图网格 / 深度几何 / 高斯泼溅,全部为内置 `model` 工作流。 |
| **导演台 + 总时间轴** | 逐镜生产控制台:生成式 clip、逐段转场、共享参考演员表、内容寻址只重渲改过的段,刻度尺 + 播放头 + 成片统一预览。 |
| **MCP 服务 + ComfyTV Bot** | 45 工具的 agent 端点(stage 层 + 原生图层)与内嵌侧边栏 agent,四个 provider(Claude Code / Codex / Qwen Code / Local LLM)、附件、按 provider 选模型。 |
| **Agent Skills** | SKILL.md 指令包,经 MCP 提供给 agent、经 `/` 面板提供给 Bot;在 设置 → 技能 里管理。 |
| **V2 节点皮肤(实验性)** | 内容优先的 LibTV 风格节点壳,亮暗双色,`enable-v2` 设置控制。 |
| **键盘优先编辑** | 视频轨 widget ←/→ 逐帧 ±1 + Home/End;数字滑块可直接键入数值并自动夹取。 |
| **Video 编辑 · 剪辑 / 裁剪 / 缩放 / 抽帧 / 音视频分离** | 对原片的真实编辑 , 起止剪、裁剪区域、改尺寸、抽一帧、把视频拆成音轨 + 静音视频。不占 GPU、不需要模型。 |
| **视频续接(↪ 动作)** | 一键链:抽源片末帧 → 生成一个新的 Video Stage,把那帧接为 I2V 起始图,后面填提示词点运行即可。 |
| **Text · Qwen3 4B** | 本地 LLM 文本生成。 |
| **Audio Stage · ACE-Step v1 Music** | 文生音乐,走 ACE-Step v1 3.5B(ComfyUI 原生支持)。自由 tags + 可选歌词触发人声 + 每 stage 时长滑块。 |
| **Crop / Rotate / Mirror** | 浏览器端,瞬时,不占 GPU。 |
| **Grid Split** | 切图 → 批量,浏览器端。 |
| **Panorama 查看器 + 当前/多视角截图** | 浏览器里跑。 |
| **Panorama · Qwen-Image-Edit 2511 Image-to-Panorama** | 图生 equirectangular:拿一张普通照片作为正前方,向外推完整 360°。 |
| **Panorama · Qwen-Image 2512 + 360 LoRA** | 文生 equirectangular:不需要输入图,纯文本描述场景就能出整张 360° 全景。用 Qwen-Image 2512 base + 360 LoRA。 |
| **Image Picker / Compare** | 挑选、A/B 对比。 |
| **图片预览缩放/平移**、**蒙版画笔 + 标注工具** | UI 工具。 |
| **Bridge 节点**(5 个入桥) | 任何第三方 ComfyUI 插件都能接入 ComfyTV 流水线。 |
| **持久化** | 编辑器状态 + 上传文件持久化。 |

### ✅ 各大套件(不需要 AI 模型 —— 直接作用在素材上)

| 套件 | 备注 |
|---------|-------|
| **视频套件(约 100 个节点)** | 剪辑、调色(曲线/LUT/CDL/HueCorrect)、整套抠像台(PIK/Keyer/Despill/KeyMix/…)、roto + 跟踪 + 蒙版传播、合成(39 混合模式、57 xfade)、粒子、镜头光学、风格化、表达式、示波器、**FX Chain** 一趟渲染。见 [video-and-audio.zh.md](video-and-audio.zh.md)。 |
| **音频套件(30+ 个节点)** | 动态/均衡/响度/降噪/修复、**分轨**(内置能力、无需安装)、噪声抑制、节拍音符提取、卷积 + 算法混响、侧链闪避、音频响应自动化。 |
| **音乐(符号音乐)** | MusicXML 乐谱 + 刻谱、钢琴卷帘打谱器/MIDI 编辑器、演奏 profile、SoundFont 合成器、节拍器、和弦伴奏。见 [making-music.zh.md](making-music.zh.md)。 |
| **2D 图层编辑器 + 故事板** | raster/文字/矢量/调整/填充图层、蒙版、魔棒选区、**PSD 导入导出**;故事板工作台带洋葱皮 + 动画稿/GIF/PDF 导出。 |
| **3D** | Scene3D 工作台(相机关键帧)、几何工坊(网格操作/布尔/烘焙)、PBR 材质 + 按部件绑定、3D 转线稿。 |
| **双库与 Runner** | 资产库、资源库(LUT/字体/SoundFont)、按 stage 预设 + 默认工作流、**远程 ComfyUI 机器作为 Runner**(Servers 页签)带能力预检。 |

---

## ⏳ 待支持

### 视频编辑
- [ ] **Video Upscale** , 逐帧放大。
- [ ] **Subtitle Erase (Smart) / (Region)** , Region 版还需要按帧的区域框选 UI。

### 音频
- [ ] **Vocals Only / Background Only** 便捷 stage , 内置的 **Audio Stem Split** 已覆盖同样能力;这两个工具栏 stage 还需改接到它上面。

### 分镜 & 出图
- [ ] **Storyboard + Shot Images** , Storyboard 跑 LLM 分镜表,Shot Images 逐 shot 出图。

### 全景图
- [ ] **Diffusion360 低 VRAM 变体**(SD1.5 base + circular blending), 给没有足够 VRAM 跑 Flux Dev 的用户。需要装 `ArcherFMY/Diffusion360_ComfyUI`。

### 其它
- [ ] 框选式区域选择 UI(Subtitle Erase / 其它区域类工具)。
- [ ] 大视频模型的"快速"预设。
- [ ] 云端生成(远程**自建** ComfyUI 机器已可通过 Servers 页签作为 Runner 使用;托管/云后端仍待做)。
