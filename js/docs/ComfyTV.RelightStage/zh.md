> 纯前端光源节点:3D 灯光球编辑器 + 提示词透传。没有 Run —— 把它的输出接给 Image Stage。

## 这个节点是做什么的

**Relight(打光)** 是一个光源*来源*节点,自身不运行任何工作流,而是给下游 stage 提供两个输出:

| 输出 | 类型 | 内容 |
|---|---|---|
| **3D 灯光**(`light_render`) | `COMFYTV_IMAGE` | 灯光球场景(黏土球 + 你摆的灯)在浏览器里按固定影棚视角渲染的图 |
| **灯光提示词**(`light_prompt`) | `COMFYTV_TEXT` | 节点提示词,原样透传 |

卡片承载一个 3D 视口,可摆放 定向 / 点 / 聚光 灯(拖拽手柄、颜色、强度、锥角),并带一键**灯光预设**(三点布光、伦勃朗光、蝴蝶光、轮廓逆光、侧光)。每次编辑约 1 秒后自动重新渲染并上传参考 PNG。

## 适用场景

- 在任意图像 stage 上点**打光**按钮 —— 会自动生成本节点 + 一个预选 **Flux2 Klein Relight** 工作流的 Image Stage,并连好线:主体 → `images[0]`,本节点的 **3D 灯光** → `images[1]`。
- 想迁移某张照片的光照时,改用 **Load Image from Asset** 节点接到 `images[1]`。
- **灯光提示词**可以接进任何 texts 槽复用你的光照描述。

## 工作原理

- 灯光球渲染用固定输出视角(相机 (0,6,8)、fov 35),结果可复现。
- 渲染图 URL 存在隐藏 widget 里;下游图像 stage 把它当普通上游图消费。
- 打光工作流本体在 `workflows/image/flux2klein-relight.json`(Flux-2 Klein 9B + Sun-direction LoRA,4 步)。

## 参数

### main_prompt

自由文本的光照描述,原样从**灯光提示词**输出。

### 灯光球区

灯光增删(chips)、每盏灯的类型 / 颜色 / 强度 / 范围 / 锥角、视口内拖拽手柄、预设行、手柄显隐、输出视角复位、锁定相机。

## 操作步骤

1. 在图像 stage 上点**打光** —— 节点对自动生成并连好线。
2. 在 3D 视口里点一个预设或手动摆灯。
3. (可选)在提示词里补充光照描述。
4. **▶ 运行那个 Image Stage**(不是本节点),得到重打光结果。

## 完整指南(推荐阅读)

> 本页只覆盖**单个节点**。端到端工作流、多 stage 管线、类型转换与设计思路见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs):

| 指南 | 内容 |
| --- | --- |
| [快速上手](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐 stage Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、inpaint、outpaint、放大、多角度、变体方案 |
| [模型文件](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 每个工作流需要的权重与存放路径 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南索引** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **打光工作流目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/image |
| **工作流 README** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/image/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## FAQ

**Q: 为什么没有 Run 按钮?**
A: 本节点和素材加载节点一样是来源节点 —— 打光工作流由下游 Image Stage 运行。

**Q: 下游没反应?**
A: 确认灯光球里至少有一盏灯(或已选参考图),连出去的输出才真正携带图片。

## 相关节点

- **Color Grade**、**Cutout**、**Multiangle**、**Image Edit**、**Load Image from Asset**
