[English](generate.md) | **简体中文**

# 生成内容

**ComfyTV / Generate** 分组里都是从提示词创建新内容的 stage:Text、Image、Video、Audio。

每个生成器用法都一样:输入提示词,从下拉框里选一个 **workflow**(模型),点 **▶ 运行**。结果显示在节点预览里,通过连线流到下游任何东西。

---

## Image Stage

![Image stage](images/image-run.png)

- **提示词**:主文本框。上游 **Text** 节点会拼到提示词后面;上游 **图片** 传给当前工作流的 LoadImage(只有 i2i 工作流会用到)。
- **workflow** 下拉列表 `workflows/image/` 里提供的工作流,现在是**Local SD1.5**(文生图)、**Local SD1.5 I2I**(图生图)、**Image Ideogram4 T2I**。
- **resolution / aspect_ratio / batch_size**:目标分辨率、比例、每次运行的张数。

**输出两路**:`images` 是这次运行的整套图,`image` 是你在节点上点中的那一张。

### 图生图
workflow 选 `Local SD1.5 I2I`,把参考图接到 **images** 槽,提示词写你想改成什么样,运行。

---

## Video Stage

![Video stage](images/video-run.png)

- **workflow** , LTX 2.3 的 4 个变体都已提供:
  - `Local LTX 2.3 T2V` , 文生视频。
  - `Local LTX 2.3 I2V` , 图生视频。
  - `Local LTX 2.3 FLF2V` , 首末帧生视频。在 **images** 上接 **两张**(起始 + 结尾关键帧)。
  - `Local LTX 2.3 IA2V` , 图 + 音频生视频。
- **resolution / aspect_ratio / duration**:输出尺寸、比例、时长。
- **audio** 输入 , IA2V 必填,其它 LTX 工作流不用音频。

---

## Text Stage

![Video stage](images/text-run.png)

通过本地 LLM 生成文本(内置 **Qwen3 4B**)。用它扩写 提示词、写描述, 或其它 stage 的 context 槽。

---

## Audio Stage
![Video stage](images/audio-run.png)

文生音乐,走 **ACE-Step v1 3.5B**;

- **提示词**:自由 tags , 流派、情绪、BPM、乐器。
- **Lyrics**(可选):空 = 纯器乐;有内容 = 带人声。
- **Duration**:滑块(1–240 秒,默认 30)。

输出一个 FLAC 音频。

---

