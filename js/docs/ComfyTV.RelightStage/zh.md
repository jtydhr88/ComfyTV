> 用亮度/颜色/轮廓光控件或参考图 AI 重打光，保留主体，点 ▶ 运行 `workflows/relight/`。

## 这个节点是做什么的

**Relight（打光）** 在不改变主体身份与几何的前提下，按新的光照条件**重新渲染**上游图片。节点提供 **亮度**、**颜色**、**轮廓光（rim light）** 滑块/取色器，可选 **main_prompt** 补充自然语言；也可选 **with reference** workflow 并接第二张参考图迁移光照风格。

**生成式** Stage，需 **▶ 运行**。与 **Color Grade**（浏览器 GLSL 即时调色）互补：Relight 是 AI 重绘光影。

## 适用场景

- 产品/人像偏平，想要戏剧光或黄金时刻
- Image Picker 快捷方案「电影级光影」会会跳转到 Relight 节点
- 抠图后 **Cutout** → Relight 统一光感
- 有参考剧照时，用 **(with reference)** 变种

## 工作原理

- Stage 在服务端把 brightness / color / rim_light / main_prompt **自动拼成**一条英文光照指令，传给 Qwen Edit Relight workflow。
- **快照**：改滑块后需重新 Run。
- with-reference 版：`images` 自动增长槽位 — 第 1 张主体，第 2 张光照参考。

## 类型说明

> **术语提示**：`COMFYTV_*` 是 ComfyTV 保存在项目里的结果引用；ComfyUI 原生的 `IMAGE`/`VIDEO`/`AUDIO` 是**运行时才在内存里**的数据，二者不能直接连线，需用 **Bridge** 转换。

| 类型 | 说明 |
|---|---|
| `COMFYTV_IMAGE` | 主输入与输出 |
| 第 2 张 `COMFYTV_IMAGE` | 仅 with-reference workflow |

Bridge：[bridges.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.zh.md)

## 界面与参数说明

### images / image（输入）

- 默认 **image** 或 autogrow **images** 第 1 槽：要打光的主体。
- 选 **Qwen Edit 2509 Relight (with reference)** 时，第 2 槽接参考光照图。

### workflow

[`workflows/relight/`](https://github.com/jtydhr88/ComfyTV/tree/main/workflows/relight) — [README.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/workflows/relight/README.zh.md)

| 内置 | 说明 |
|---|---|
| **Qwen Edit 2509 Relight** | 默认；仅 prompt + 控件驱动 |
| **Qwen Edit 2509 Relight (with reference)** | 需第 2 张参考图 |

模型见 [models.zh.md](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md)（Qwen Edit 2509 + Relight LoRA + Lightning LoRA）。

### brightness（0–100，默认 50）

越高整体越亮；过低会偏暗压抑。

### color（取色，默认 #ffffff）

给光加色偏（暖金、冷蓝等）。

### rim_light（布尔）

开启后增加轮廓光，分离主体与背景。

### main_prompt（可选）

追加描述，如 *「柔和窗光从左侧」*；会与自动指令拼接。

### 自定义参数（custom_params）

侧栏随机种子（seed）等。

## 输出说明

| 输出 | 类型 |
|---|---|
| **image** | 重打光后 `COMFYTV_IMAGE` |

## 新手一步一步

1. 下载 Relight 所需 Qwen 模型与 LoRA。
2. 添加 **Relight**，主体图接入 **images[0]** 或 **image**。
3. workflow 选 **Qwen Edit 2509 Relight**。
4. 调 **brightness / color / rim_light**；可选填 main_prompt。
5. **▶ 运行**。
6. 要模仿某张剧照光：换 with-reference workflow，参考图接第 2 槽 → 再 Run。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |
| [图像工具](https://github.com/jtydhr88/ComfyTV/blob/main/docs/image-tools.zh.md) | 裁剪、Inpaint、扩图、放大、多角度、变体 preset 等完整说明 |
| [模型文件清单](https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md) | 各 workflow 所需 主模型与 LoRA 小模型 与放置目录 |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **本节点 workflow 目录** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows/relight |
| **本节点 workflow 说明** | https://github.com/jtydhr88/ComfyTV/blob/main/workflows/relight/README.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |

## 常见问题

**Q：和 Color Grade 有什么区别？**  
A：Grade 是即时调色；Relight 是 AI 重打光，需 Run + 模型。

**Q：参考图被忽略了？**  
A：选对 workflow 变体、接好第 2 个输入槽，并重新 Run。

## 相关节点

- **Color Grade** — 即时调色
- **Cutout** — 抠图后打光
- **Multiangle** — 换视角（不同 LoRA）
- **Image Edit**
