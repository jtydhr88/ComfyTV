[English](image-tools.md) | **简体中文**

# 图像工具

一旦你有了一张图(来自 **Generate → Image** 的批量、**Image Picker** 选出的、或一个 **Load Image** 节点),picker 的 **`✏️ Edit`** 工具栏以及**ComfyTV / Image** 菜单提供一套操作。

- **即时(浏览器端)**,裁剪、旋转、镜像、网格切分。改参数实时更新,立刻可往下游用。
- **生成式**,修改图片、重绘、擦除、扩图、高清、多角度、打光、抠图,以及图像变体(多视角 / 故事网格 preset)。

> 要对单张图操作,从 **Image Picker** 入手 , 它带完整的编辑工具栏。

---

## 裁剪(Crop)*(即时)*

![Crop](images/crop.png)

源图上覆盖一个可拖动的裁剪矩形。

- 拖 **方框** 移动;拖 **边/角** 调整大小。
- **Ratio** 下拉锁定宽高比(1:1、16:9 等);🔒 按钮切换锁定。
- **X / Y / W / H** 输入框可填入精确像素值。
- 裁剪后的图自动生成。

## 旋转(Rotate)*(即时)*

任意角度滑块(−180°…180°)+ 快捷按钮(⟲ 90° / 0° / 180° / ⟳ 90°)。预览实时旋转。

## 镜像(Mirror)*(即时)*

两个开关:**⇋ 水平** 翻转、**⇅ 垂直** 翻转。

## 网格切分(Grid Split)*(即时)*

![九宫格切分](images/grid-split.png)

把一张图切成网格 → 图**批量**。

- 选预设(1×2 / 2×1 / 2×2 / 2×3 / 3×3)或用 **Rows / Cols** 步进器。
- 网格线实时显示切分位置。
- 把输出接到 **Image Picker**。

---

## 修改图片(Image Edit)

提示词驱动的通用图像编辑, 修改、替换、改风格,任何能用语言描述的改动。内置 `Flux Canny Edit` 工作流接收一张输入图 + 一段文字指令。

## 重绘 / 擦除(Inpaint / Erase)

![蒙版画笔](images/painter.png)

源图上叠了一个蒙版画笔。工具:

- **✏️ 画笔**,涂出蒙版区域(笔刷大小 / 不透明度 / 硬度滑块)。
- **🧽 橡皮**,擦除已涂的蒙版。
- **▭ 矩形 / ◯ 椭圆**,拖动画轮廓(标注用)。
- **① 标号**,点击盖一个自动编号的标记。
- **颜色** 应用于画笔 + 形状 + 标号;**Clear** 清空画布。

**Inpaint** 根据提示词重绘蒙版区域,内置 `Flux Fill Inpaint`、`Fooocus SDXL Inpaint`。**Erase** 抹掉蒙版区域、用周围上下文填补,无提示词。内置 `LaMa Erase`(需要装 [`comfyui-inpaint-nodes`](https://github.com/Acly/comfyui-inpaint-nodes) + `big-lama.pt`)。

## 扩图(Outpaint)

把画布向外扩展 , 选要扩哪几条边、扩多少像素,提示词 里**描述整张成品图的样子**。内置 `Flux Fill Outpaint`、`Fooocus SDXL Outpaint`。

## 高清(Upscale)

提高分辨率。内置 `Ultrasharp 4x`(基于 4x-UltraSharp GAN)。

## 多角度(Multiangle)

![Multiangle 相机](images/multiangle.png)

一个 3D 相机 widget:拖手柄(或拖场景)选视角 , 方位角、俯仰、距离。选定的角度变成一段视角 提示词(比如 *"front-right quarter view, eye-level shot, medium shot"*),然后从这个视角重新渲染主体。内置 `Qwen Edit 2511 Multiangle`(Qwen Image Edit + Multiangle LoRA)。

## 打光(Relight)

亮度 / 颜色 / 轮廓光 widget + 可选的自然语言描述会合成成一条光照指令。内置 `Qwen Edit 2509 Relight`(默认,提示词驱动)和 `Qwen Edit 2509 Relight (with reference)` , with-reference 版本要再接一张图到 `light_reference` 槽,模型把参考图的光照风格(方向、颜色、对比)迁移到主体上,主体身份/几何保持不变。

## 抠图(Cutout)

去背景。接图、点运行,输出 PNG 带真实 alpha 透明通道。内置 `BiRefNet Cutout`,需要 `birefnet.safetensors` 放到 `models/background_removal/`(见 [models.zh.md](models.zh.md))。

## 图像变体(Image Variations)

由工具栏 preset 驱动 , 点 preset 自动生成一个 Image Variations stage, workflow 下拉框预选成对应的,点运行就出一组关联图。

| Preset | Workflow | 输出 | 后端 |
|---|---|---|---|
| 🎬 **多机位九宫格** | `Multi-cam 9` | 9 张批量 | ✅ Qwen Multiple-Angles LoRA,单工作流 9 路并行 sampler |
| 👤 **脸部三视图** | `Face 3-View` | 3 张批量(正/45°/侧) | ✅ 同上 |
| 📦 **产品三视图** | `Product 3-View` | 3 张批量(正/侧/背) | ✅ 同上 |
| 🧍 **角色三视图** | `Character 3-View` | 3 张批量(全身正/侧/背) | ✅ 同上 |
| 📖 **剧情推演**(4 连贯) | `Story 4` | 4 张批量 | ✅ Qwen Next-Scene LoRA,单工作流 4 帧串行 |
| 🎞 **25 宫格分镜** | `Storyboard 25` | 25 张批量 | ✅ 同样的链扩展到 25 帧;**~10 帧后会漂** |
| 🎥 **电影级光影** | (路由到 Relight Stage) | 单图 | ✅ |
| ⏱️ **推演 +3s/+5s** | (路由到 Image Edit Stage) | 单图 | ✅ |

注意事项:

- **多视角**(Face / Product / Character / Multi-cam 9) , 每张是同一主体的不同角度。提示词写主体描述("一位 30 多岁的亚洲女商人"),每路的角度关键词自动前缀。
- **序列**(Story 4 / Storyboard 25) , 每一帧基于上一帧生成(Next-Scene LoRA)。Story 4 连贯性好;Storyboard 25 可能 ~10 帧后漂掉。比多视角慢。

---

360° 工具见 [panorama.zh.md](panorama.zh.md);选图、对比见 [compose.zh.md](compose.zh.md)。
