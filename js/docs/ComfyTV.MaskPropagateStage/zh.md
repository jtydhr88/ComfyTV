# Mask Propagate

> 拿在一帧上画好的蒙版，沿整段运动的片子传播下去。

## 这个节点是做什么的

**Mask Propagate（蒙版传播）** 解算视频帧间的运动，把一张参考蒙版扭曲得跟着它走。你给它一张首帧蒙版图；点 ▶ 运行后，它逐帧跟踪特征点，拟合运动模型，把蒙版重新投影，使其贴住运动的主体或区域——输出整段片子的蒙版视频。

它需要两个输入：源 **video**（`COMFYTV_VIDEO`）和一张匹配 `t_ref` 处帧的 **mask** 图（`COMFYTV_IMAGE`）。若没接蒙版，会报「Mask Propagate needs a first-frame mask image」。输出是一个 `COMFYTV_VIDEO` 蒙版。通过 `ComfyTV/Bridge` 桥接到 ComfyUI 原生节点——详见 https://github.com/jtydhr88/ComfyTV/blob/main/docs/bridges.md。

## 适用场景

- 你有某一帧的干净蒙版（来自 **Split Part** 的 SAM 输出、Roto Mask 等），想推广到整个镜头
- 跟随刚性或近刚性主体的平移、缩放、旋转或倾斜
- 把静止抠像变成运动遮罩，而不用逐帧 roto

## 参数

### model
帧间拟合的运动模型。可选：`translation`、`similarity`、`perspective`。默认 `similarity`。`translation` 只处理纯滑动；`similarity` 加入旋转和缩放；`perspective` 为平面加入倾斜/透视。用能匹配运动的最简单模型。

### t_ref
你的参考蒙版对应帧的时间戳（秒）。范围 `0`–`3600`，步进 `0.05`，默认 `0`。设为你做蒙版那帧的时间。

### max_points
用于解算运动的特征点最大数量。范围 `4`–`64`，默认 `24`。点越多越稳健但也越慢。

### invert
反相传播出的蒙版。布尔，默认关。

## 输入与输出

| 槽位 | 类型 | 含义 |
|---|---|---|
| **video**（输入） | `COMFYTV_VIDEO` | 要传播的片段 |
| **mask**（输入） | `COMFYTV_IMAGE` | 首帧蒙版，匹配 `t_ref` 处的帧 |
| **mask**（输出） | `COMFYTV_VIDEO` | 沿片段跟随运动扭曲后的蒙版 |

## 小贴士

- 参考蒙版必须与 `t_ref` 处的帧对齐——不对齐会让传播从一开始就漂移。
- **Split Part** 的 SAM 蒙版输出是首帧蒙版的天然来源。
- 传播假设变换基本一致；剧烈形变、遮挡或运动模糊会导致滑移。

## 相关节点

- **Split Part** — 产出逐帧 SAM 蒙版作为本节点的种子
- **Roto Mask** — 手绘首帧蒙版
- **Motion Track** — 把运动解算成变换数据（用于钉位/合成）
