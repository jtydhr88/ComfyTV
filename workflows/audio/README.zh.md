[English](README.md) | **简体中文**

# `audio/` 工作流

这个目录下的工作流出现在 **Audio Stage** 下拉框。接收文本提示词(风格 / 情绪 / 乐器)+ 可选的歌词 + 时长,产出一段音乐或音效。

## stage 提供的输入

- **提示词** , 通常写风格/情绪/乐器关键词,如 `soft female vocals, kawaii pop, j-pop, piano, cheerful`。
- **歌词**(可选) , song 模式工作流用;纯器乐 / SFX 工作流可忽略。
- **时长** , 秒数滑块。
- **随机 seed**。

## 工作流需要包含

- 一个 audio save 节点(`SaveAudio` / `SaveAudioMP3` / `SaveAudioOpus` / `SaveAudioAdvanced`,自动检测)。
- 对应模型的 text encode 节点接提示词(ACE-Step 用 `TextEncodeAceStepAudio.tags`)。
- song 模式工作流:一个歌词输入(ACE-Step 用 `TextEncodeAceStepAudio.lyrics`)。
- 一个时长输入(ACE-Step 是 `EmptyAceStepLatentAudio.seconds`,单位秒)。
- `KSampler` 一个,用 stage 的 seed。

加自己的工作流见 [docs/custom-workflows.zh.md](../../docs/custom-workflows.zh.md);各节点上的具体绑定在画布上选中 stage 后通过左侧 **ComfyTV** 侧边栏配,详见 [docs/sidebar-config-editor.zh.md](../../docs/sidebar-config-editor.zh.md)。

## 当前内置

- **ACE-Step v1 Song**(`ace-step-v1-song.json`) , ACE-Step 3.5B 文本到音频,完整支持 song(tags 控制风格、lyrics 控制人声、时长接 stage 的 duration widget)。测试通过。
- **MiniMax Music 3**(`minimax-music3.json`) , 改编自 ComfyUI 官方 `audio_minimax_music_3` 模板。最长约 5 分钟的完整歌曲、结构稳定;提示词 → caption(风格/情绪/人声/编曲,写得越结构化越好),歌词用 `[intro]`/`[verse]`/`[chorus]`/`[bridge]`/`[outro]` 标签控制歌曲结构,时长 → max_duration(模型可能提前收尾)。采样默认值保持官方(30 步、cfg 1.7、euler/simple)。

## 需要的模型

- `ace_step_v1_3.5b.safetensors` , 放进 `models/checkpoints/`。ACE-Step v1 release 提供。
- MiniMax Music 3(都在 Hugging Face `Comfy-Org/MiniMax-Music-3`):`minimax_music3_dit_fp16.safetensors`(低显存可换 `..._int8_convrot`)→ `models/diffusion_models/`,`minimax_music3_text_encoder_pruned_int8_convrot.safetensors` → `models/text_encoders/`,`minimax_music3_dav.safetensors` → `models/vae/`。
