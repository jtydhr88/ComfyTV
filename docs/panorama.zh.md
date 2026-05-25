[English](panorama.md) | **简体中文**

# 全景图(360°)

**ComfyTV / Panorama** 分组让你在 3D 里查看一张 equirectangular 或 HDRI 全景图,并从中截取平面视口图 , 全部在浏览器里跑。

![Panorama 查看器](images/panorama.png)

---

## Panorama

一个交互式 360° 查看器。你坐在球心向四周看,拖动改变视角。

### 三种把全景图导入的方式
- **上传**,点 **📤 Upload panorama** 选文件。支持 equirectangular **.jpg / .png / .webp** 和 HDR **.hdr / .exr**。查看器立刻加载,标一个 **manual** 徽章。**上传优先级最高**,会盖过其它路径;要走生成,先 ✕ 清掉上传。
- **图生全景**,workflow 选 `Qwen-Image-Edit 2511 Image-to-Panorama`,把普通照片接到 input,提示词 里可以补充场景延伸方向("向外扩展为草原和远山")。源图变成正前视图,Qwen-Edit 把周围 360° 推出来。
- **文生全景**,workflow 选 `Qwen-Image 2512 + 360 LoRA`。不需要参考图,在提示词框里描述场景就行,模型直接出整张 360° equirectangular。没有参考照片、从零搭环境时用。

上传的文件存到 ComfyUI 的 `input` 文件夹里。**✕ Clear upload** 把手动来源去掉。

> Panorama 节点只显示 3D 查看器,没有平面输出缩略图;在 3D 里拖来查看。

---

## Panorama · Current View(当前视角)

![当前视角截图](images/pano-current.png)

自带一个全景查看器。**拖动瞄准**你要的那一块,松手时**截取**该视口为一张平面图。

- **Aspect** + **Resolution** 下拉框设定截图的形状和尺寸。预览框锁定到选定的宽高比,所见即所得。
- 截出来的图照常往下游流(接编辑器或视频 stage)。

## Panorama · Multi-View(多视角)

![多视角截图](images/pano-multi.png)

**一次性截取全景图周围若干等间距的视口** → 一组图**批量**。

- **View count** 滑块(2–24),从几个方向截。
- **Aspect / Resolution**,单个视口的形状和尺寸。
- 输出是一组图片;接 **Image Picker**。

`View count = 4` 时,视图标注成 Front / Right / Back / Left。

---

## 典型流程

```
Image Stage → Image Picker → Panorama (上传或生成)
                                  │
                                  ├── Current View → (编辑 / 视频)
                                  └── Multi-View   → Image Picker → (编辑)
```

