[English](sidebar-config-editor.md) | **简体中文**

# 侧边栏配置编辑器

每个 ComfyTV stage 都跑在它下拉框选中的 **workflow** 上。**ComfyTV** 侧边栏标签让你查看和编辑「stage 输入怎么映射到工作流节点」,不用碰任何磁盘文件,改完即生效。

> 这里编辑的是和 `_preset.json` 同一套绑定接口（见 [custom-workflows.zh.md](custom-workflows.zh.md) 里的「完整路径」）。侧边栏面向终端用户调整内置默认。

---

## 打开编辑器

1. ComfyUI 画布左侧侧边栏，点 **ComfyTV** 标签。
2. 画布上点任一 ComfyTV stage（Image Stage、Inpaint、Upscale 等）。侧边栏立刻显示该 stage 当前选中工作流的配置。

![侧边栏显示选中 stage 的工作流](images/sidebar-overview.png)

顶部显示 stage 的 kind 徽章和当前选中的 workflow 标签。如果该工作流是第一次见到、还没被任何 stage 选中过,会看到提示让你先在画布上的某个 stage 上选中它一次。

如果工作流里有 **Note / MarkdownNote** 节点,内容会汇总成可折叠的"工作流笔记"块显示在最上面 , 工作流作者用这种方式给使用者留说明。

底部有"说明"区显示 preset 的 `description` 字段。

> stage 没有 `workflow` 下拉框时侧边栏保持空(Crop / Rotate / Mirror 等 transform stage、Load Image / Load Video 等 loader stage)。选中它们会看到空状态。

---

## Widget 列表

工作流笔记下面是这个工作流里所有可编辑 widget,按节点分组,每个节点是一块可折叠的卡片。节点头展示节点标题、`(节点类型)`、`#id`,右边一个 `已绑定数 / 总数` 计数。

每个 widget 行有三块:

- **`.<widget 名>`** , 比如 `.seed`、`.text`、`.filename_prefix`。
- **值编辑器** , 该 widget 原本的输入控件(数字框 / 文本框 / 下拉 / 开关)。直接改这里 = 把工作流出厂值替换成你输入的常量。当这一行已经被绑到 stage 输入(下拉里选了非 `(use this value)` 的项)时,值编辑器会变灰禁用 , 因为运行时这里的值是上游推过来的。
- **绑定到:** , 下一节讲。

---

## 绑定选项（`Bind to`）
![img.png](images/bindto.png)
下拉里出现的就是 stage 自己暴露的输入。你看到的标签和含义：

| 标签 | 运行时取什么 |
|---|---|
| **(use this value)** | 用这一行 Value 填的常量,例如模型文件名 |
| **Stage prompt** | stage 主提示词框里输入的文本 |
| **Stage negative prompt** / **Stage seed** / **Stage batch size** / **Stage lyrics** / **Stage scale** / **Stage duration (s)** / **Stage generate audio** / **Stage mask (painter output)** / **Stage pad left/top/right/bottom** / **Stage feathering** / **Stage LLM max output length** | 对应 stage widget 的当前值;具体出现哪些取决于 stage 类型 |
| **Stage width** / **Stage height** / **Stage video length** | 由 stage 的 resolution + aspect_ratio + duration 推导出来 |
| **Upstream image #N** | 接进 stage 的第 N 张图 |
| **Upstream image + painted mask (alpha)** | 仅 Inpaint / Erase。上游图 + 画笔 mask 烘进 alpha 通道后的合成图;工作流如果从 `LoadImage` 的 MASK 输出取 mask(而不是单独的 `LoadImageMask` 节点),就把 `LoadImage` 的 `image` 输入绑到这一项 |
| **Upstream video #N** / **Upstream audio #N** / **Upstream text #N** | 其它上游类型同理 |

---

## 保存和校验

改值或换绑定**立刻保存**。画布上所有 stage 的接线校验会随每次保存重跑,改动是否影响上游接口立刻能看到。

保存失败会内联报错。

---

## 修改工作流本身

侧边栏**只改绑定**。要改工作流本身(重命名节点、加一步、换个 model loader),在 ComfyUI 主画布打开 `workflows/<kind>/<name>.json`,可视化编辑,保存覆盖原文件。下次再有 stage 选中这个工作流时,ComfyTV 检测到文件修改时间变了会自动重新读一遍,新结构立刻可用,不用重启。现有绑定只要引用的节点 ID 还存在就继续工作。

---

## 导出为可分享的 preset

侧边栏底部有一个 **⇩ 导出 preset.json** 按钮。点它把当前的绑定 + 元数据下载为一个 JSON 文件，文件名是 `<工作流-slug>_preset.json`。

下载下来的文件就是标准 `_preset.json` 格式(详见 [custom-workflows.zh.md](custom-workflows.zh.md#配置-stage-输入怎么接))。典型流程:

1. 把工作流 JSON 放进 `workflows/<kind>/`。
2. 在某个 stage 上选中它、准备完成,在侧边栏里调整绑定到你满意。
3. 点 **导出 preset.json**。
4. 把下载到的文件存到工作流 JSON 同目录,命名为 `<name>_preset.json`。
5. 把这对文件(`<name>.json` + `<name>_preset.json`)分享给别人。对方第一次在 stage 上选中这个工作流时,你调好的默认值会自动应用。

按钮在工作流第一次被选中、准备完成前会禁用。

---

## 重置到内置 preset

侧边栏底部 **导出 preset.json** 按钮旁有 **↻ 重置为内置 preset** 按钮。点它清空当前工作流的所有绑定和元数据,重新读取磁盘上的 `_preset.json` 应用一次。你自己改过的内容会丢失。

工作流如果没有 `_preset.json` 文件,按钮会报错 `no shipped preset for this workflow`。

---

## 相关文档

- [custom-workflows.zh.md](custom-workflows.zh.md) , 怎么打包自己的工作流 + `_preset.json`
- 各 kind 的 `workflows/<kind>/README.md` , 每种 stage 的运行时约定(stage 输入有哪些、工作流需要哪些节点)
