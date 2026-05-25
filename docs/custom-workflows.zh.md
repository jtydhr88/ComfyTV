[English](custom-workflows.md) | **简体中文**

# 自定义工作流

ComfyTV 每个 阶段 的 **workflow** 下拉框，背后都是 `custom_nodes/ComfyTV/workflows/<kind>/` 目录下的一个 JSON 文件。把文件放进去，重启 ComfyUI。**无需改 Python 代码。**

```
workflows/
  image/                                ← Image Stage
    my-workflow.json                    GUI 工作流导出
    my-workflow_preset.json             可选 preset (内置默认绑定)
  image-edit/   inpaint/   erase/   outpaint/   upscale/   multiangle/
  relight/   cutout/   multiview/   sequence/
  video/        text/       audio/      audio-vocal/    audio-bg/
  shot-images/  storyboard/  panorama/  timeline/
```

完整 类别 列表：`text, image, shot-images, video, audio, storyboard, panorama, timeline, upscale, outpaint, inpaint, erase, image-edit, multiangle, relight, cutout, multiview, sequence, audio-vocal, audio-bg`。

**文件放在哪个文件夹就属于哪个 类别**。每个已上线 类别 在自己目录下有 `README.md` 说明运行时输入和工作流需要的节点。请先看相关的 per-kind README：

- [`workflows/audio/README.zh.md`](../workflows/audio/README.zh.md)
- [`workflows/image/README.zh.md`](../workflows/image/README.zh.md)
- [`workflows/image-edit/README.zh.md`](../workflows/image-edit/README.zh.md)
- [`workflows/inpaint/README.zh.md`](../workflows/inpaint/README.zh.md)
- [`workflows/outpaint/README.zh.md`](../workflows/outpaint/README.zh.md)
- [`workflows/upscale/README.zh.md`](../workflows/upscale/README.zh.md)
- [`workflows/cutout/README.zh.md`](../workflows/cutout/README.zh.md)
- [`workflows/erase/README.zh.md`](../workflows/erase/README.zh.md)
- [`workflows/relight/README.zh.md`](../workflows/relight/README.zh.md)
- [`workflows/multiangle/README.zh.md`](../workflows/multiangle/README.zh.md)
- [`workflows/multiview/README.zh.md`](../workflows/multiview/README.zh.md)
- [`workflows/sequence/README.zh.md`](../workflows/sequence/README.zh.md)

---

## 如何使用自定义工作流

1. **ComfyUI 里 Workflow → 导出**(默认 GUI 格式,**不要**用 "Save (API Format)")。
2. 保存为 `workflows/<kind>/<name>.json`。
3. **重启 ComfyUI**。下拉框里就会出现这个新工作流。

ComfyTV 自动:把文件名人化作为下拉框标签(`my-workflow` → "My Workflow")、用文件夹名注册 kind、检测 `SaveImage` / `SaveVideo` / `PreviewImage` 节点作为结果出口。

---

## 配置 stage 输入怎么接

工作流接进来之后,大多数情况下你需要告诉 ComfyTV:stage 面板里输入的提示词接到哪个节点、上游的图接到哪个 LoadImage、seed 用什么。

**通过侧边栏改**:画布上点中 stage,左侧 **ComfyTV** 侧边栏里逐个 widget 设。改完即生效,不必重启。详细操作见 [sidebar-config-editor.zh.md](sidebar-config-editor.zh.md)。

**想分享给别人**:侧边栏底部有 **⇩ 导出 preset.json** 按钮,把当前绑定打包成 `<name>_preset.json`。和工作流 JSON 一起发出去,对方第一次加载就会自动应用你的绑定。

> 一般情况下你**不需要手写** `_preset.json`，用侧边栏配,要分享就导出。如果你确实想知道 `_preset.json` 的 JSON 格式,参考内置的例子: `workflows/inpaint/flux-fill-inpaint_preset.json`、`workflows/video/local-ltx-2.3-t2v_preset.json`。

---

## 重新导出后更新

ComfyUI 里重新导出工作流(换模型版本、加一步),**直接覆盖 `workflows/<kind>/<name>.json` 就行**。ComfyTV 检测到文件修改时间变了,下次该 stage 用这个工作流时会重新读一遍。

只要绑定引用的节点 ID 还存在,绑定继续工作。重命名或删除了节点,运行时会报:

> `inputs references missing workflow node "X",did the API workflow get re-exported with different node ids?`

打开侧边栏,把指向旧 id 的绑定改到新 id 上。

---