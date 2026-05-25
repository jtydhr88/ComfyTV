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
| **Relight · Qwen Edit 2509 Relight**(含 with-reference 变体) | 亮度 / 颜色 / 轮廓光 widget 合成自然语言指令;with-reference 版本可以接参考图做光照迁移。 |
| **Cutout · BiRefNet Cutout** | 用 ComfyUI 内置 BiRefNet 抠图,输出带 alpha 的 PNG。 |
| **Image Variations · Face 3-View / Product 3-View / Character 3-View / Multi-cam 9** | 单工作流多路并行 KSampler,共享模型 + base latent。Qwen-Image-Edit 2511 + Multiple-Angles LoRA + Lightning 4-step。 |
| **Image Variations · Story 4 / Storyboard 25** | 单工作流 N 帧串行 , 第 N+1 帧用第 N 帧作输入。Qwen-Image-Edit 2509 + Next-Scene LoRA + Lightning 4-step。 |
| **Outpaint · Flux Fill Outpaint** + **Fooocus SDXL Outpaint** | 画布外扩。 |
| **Upscale · Ultrasharp 4x** | 基于 4x-UltraSharp GAN 的放大。 |
| **Multiangle · Qwen Edit 2511 Multiangle** | Qwen Image-Edit + Multiangle LoRA,由 3D 相机驱动。 |
| **Video · Local LTX 2.3**(T2V + I2V + FLF2V + IA2V) | 快;推荐默认。T2V 纯文本;I2V 要一张图;FLF2V 在两张关键帧之间插值;IA2V 跟随音轨节拍(对口型/MV/音效对齐镜头)。 |
| **Video 编辑 · 剪辑 / 裁剪 / 缩放 / 抽帧 / 音视频分离** | 基于 PyAV 的真实编辑 , 起止剪、裁剪区域、改尺寸、抽一帧、把视频拆成音轨 + 静音视频。不占 GPU,直接在磁盘原片上跑。 |
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

---

## ⏳ 待支持

### 视频编辑
- [ ] **Video Upscale** , 逐帧放大。
- [ ] **Subtitle Erase (Smart) / (Region)** , Region 版还需要按帧的区域框选 UI。

### 音频
- [ ] **Vocals Only / Background Only (Demucs)** , 走 `lum3on/ComfyUI_AudioTools` 的 `AudioStemSeparate`。

### 分镜 & 出图
- [ ] **Storyboard + Shot Images** , Storyboard 跑 LLM 分镜表,Shot Images 逐 shot 出图。

### Timeline
- [ ] **Director Timeline + Timeline Render** , LTX multishot + ffmpeg concat。

### 全景图
- [ ] **Diffusion360 低 VRAM 变体**(SD1.5 base + circular blending), 给没有足够 VRAM 跑 Flux Dev 的用户。需要装 `ArcherFMY/Diffusion360_ComfyUI`。

### 其它
- [ ] 框选式区域选择 UI(Subtitle Erase / 其它区域类工具)。
- [ ] 大视频模型的"快速"预设。
- [ ] 云端 / 远程生成(现在所有东西都跑你本地模型)。
