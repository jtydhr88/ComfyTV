[English](compose.md) | **简体中文**

# 拼接 & 编排

## 挑选器（Pickers）

![Image picker](images/picker-toolbar.png)
从一批结果里选**一个**。每种媒介都有对应的 picker：

- **Image Picker** —— 来自 Image Stage、Grid Split、Image Variations、Panorama Multi-View……
- **Video Picker** —— 来自 Video Stage 的批量输出。
- **Audio Picker** —— 来自 Music Stage 的批量输出。

共同行为：

- 点缩略图选中，选中项就是 picker 的单项输出。
- Image Picker 带完整的**操作工具栏**（`✏️ Edit`、`🌐 Panorama`、`📐 Multiangle`、`💡 Relight`、各种预设）。
- 生成类 stage **第一次运行时会自动创建**对应的 picker。

---

## Compare（A/B 对比）

![A/B 对比](images/compare.png)

一个前后**滑条**对比器，比较 **image_a**（原图）和 **image_b**（改后）。

---

## 更大的编排工具

当一个 picker 不够用时，ComfyTV 还有更大的编排台面：

- **Storyboard Editor 故事板** —— 多画板绘画工作台（每块板复用完整图层编辑器引擎），带洋葱皮、时间线播放、动画稿/GIF/PDF/ZIP 导出；Fountain 剧本可直接导入成板。

  <!-- TODO(screenshot): 故事板编辑器——几块画板 + 时间线条 -->
  ![故事板编辑器](images/storyboard-editor.png)

- **Sequence**（Video）—— 轻量的轨道式拼装器，见 [video-and-audio.zh.md](video-and-audio.zh.md)。
- **Director 导演台** —— 逐镜生产控制台:clip 时间线上每一段都是生成出来的(文生/图生/参考生视频),带逐段转场、跨镜共享参考演员表、内容寻址缓存(只重渲改过的段),以及带刻度尺、播放头、成片统一预览的**总时间轴**(整片连播,或逐段审片)。详见节点参考里的 Director 各页。
